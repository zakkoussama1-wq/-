import { GET as ordersRoute } from "../src/app/api/orders/route";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { Session } from "@shopify/shopify-api";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  accountLogin,
  authDb,
  sessionMerchant,
} from "../src/modules/auth/store";
import { saveConnection } from "../src/modules/integrations/shopify/connections";
import { requestedShopifyScopes } from "../src/modules/integrations/shopify/sdk";
import { changeShipping } from "../src/modules/shipping/repository";
import { localCommerceAdapter } from "../src/modules/commerce/adapter";
import {
  createOrder,
  listOrders,
  setOrderStatus,
} from "../src/modules/orders/repository";
import { closeStoragePool } from "../src/modules/storage/database";
import {
  openOutbox,
  prepareOrderTrial,
  requestOrderSync,
} from "../src/modules/orders/shopify/outbox";
import { processNextOrderSync } from "../src/modules/orders/shopify/worker";
import {
  buildOrderPayload,
  type RemoteOrder,
} from "../src/modules/orders/shopify/client";
import { GET as readinessRoute } from "../src/app/api/orders/shopify-sync/readiness/route";
import { POST as trialRoute } from "../src/app/api/orders/shopify-sync/trial/route";
import { POST as retryRoute } from "../src/app/api/orders/shopify-sync/route";

// A deliberately mocked introspection contract, NOT a claim of live Shopify verification.
const scalar = (name: string) => ({ kind: "SCALAR", name });
const input = (name: string) => ({ kind: "INPUT_OBJECT", name });
const required = (ofType: unknown) => ({ kind: "NON_NULL", ofType });
const list = (ofType: unknown) => ({ kind: "LIST", ofType });
const field = (name: string, type: unknown) => ({
  name,
  type,
  defaultValue: null,
});
const object = (fields: Record<string, unknown>) => ({
  kind: "INPUT_OBJECT",
  inputFields: Object.entries(fields).map(([n, t]) => field(n, t)),
});
function mockedSchema(source: boolean): Record<string, unknown> {
  const s = scalar("String"),
    b = scalar("Boolean"),
    i = scalar("Int");
  return {
    Mutation: {
      kind: "OBJECT",
      fields: [
        {
          name: "orderCreate",
          args: [
            field("order", required(input("OrderCreateOrderInput"))),
            field("options", input("OrderCreateOptionsInput")),
          ],
        },
      ],
    },
    Order: {
      kind: "OBJECT",
      fields: [
        { name: "id", args: [] },
        ...(source ? [{ name: "sourceIdentifier", args: [] }] : []),
      ],
    },
    OrderCreateOrderInput: object({
      currency: { kind: "ENUM", name: "CurrencyCode" },
      financialStatus: { kind: "ENUM", name: "OrderCreateFinancialStatus" },
      taxesIncluded: b,
      taxLines: list(input("TaxLineInput")),
      tags: list(s),
      customAttributes: list(input("AttributeInput")),
      ...(source ? { sourceIdentifier: s } : {}),
      phone: s,
      lineItems: list(input("OrderCreateLineItemInput")),
      shippingAddress: input("MailingAddressInput"),
      shippingLines: list(input("OrderCreateShippingLineInput")),
      note: s,
      discountCode: input("OrderCreateDiscountCodeInput"),
    }),
    OrderCreateOptionsInput: object({
      inventoryBehaviour: {
        kind: "ENUM",
        name: "OrderCreateInventoryBehaviour",
      },
      sendReceipt: b,
      sendFulfillmentReceipt: b,
    }),
    CurrencyCode: { kind: "ENUM", enumValues: [{ name: "DZD" }] },
    OrderCreateFinancialStatus: {
      kind: "ENUM",
      enumValues: [{ name: "PENDING" }],
    },
    OrderCreateInventoryBehaviour: {
      kind: "ENUM",
      enumValues: [{ name: "BYPASS" }],
    },
    AttributeInput: object({ key: required(s), value: required(s) }),
    OrderCreateLineItemInput: object({
      variantId: scalar("ID"),
      quantity: required(i),
      priceSet: input("MoneyBagInput"),
    }),
    OrderCreateShippingLineInput: object({
      title: s,
      priceSet: input("MoneyBagInput"),
    }),
    MoneyBagInput: object({ shopMoney: required(input("MoneyInput")) }),
    MoneyInput: object({
      amount: required(scalar("Decimal")),
      currencyCode: { kind: "ENUM", name: "CurrencyCode" },
    }),
    MailingAddressInput: object({
      firstName: s,
      phone: s,
      countryCode: { kind: "ENUM", name: "CountryCode" },
      province: s,
      city: s,
      address1: s,
    }),
    CountryCode: { kind: "ENUM", enumValues: [{ name: "DZ" }] },
    OrderCreateDiscountCodeInput: object({
      itemFixedDiscountCode: input("OrderCreateFixedDiscountInput"),
    }),
    OrderCreateFixedDiscountInput: object({
      code: s,
      amountSet: input("MoneyBagInput"),
    }),
    TaxLineInput: object({ title: s }),
  };
}
const base = process.env.POSTGRES_TEST_URL;
const domain = "fixture.myshopify.com",
  shopId = "gid://shopify/Shop/55";
let admin: Pool,
  schema: string,
  directory: string,
  merchant: string,
  token: string;
let schemas: Record<string, unknown>,
  remotes: RemoteOrder[],
  creates: number,
  hide: boolean,
  deny: boolean,
  scopes: string[],
  version: string;
let behavior:
  "success" | "timeout" | "throttle" | "invalid" | "mismatch" | "partial";
let sentPayload: Record<string, unknown> | undefined;
let storeTaxesIncluded: boolean;
const response = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "x-shopify-api-version": version },
  });
async function offlineSession(scope = "read_products,write_orders") {
  await saveConnection(
    merchant,
    domain,
    "fixture-token",
    scope,
    new Session({
      id: `offline_${domain}`,
      shop: domain,
      state: "",
      isOnline: false,
      accessToken: "fixture-token",
      scope,
      expires: new Date(Date.now() + 3600000),
      refreshToken: "fixture-refresh",
      refreshTokenExpires: new Date(Date.now() + 7200000),
    }),
    shopId,
  );
}
async function prepare(discount = 0) {
  const productId = "gid://shopify/Product/1";
  const input = {
    productId,
    variantId: "gid://shopify/ProductVariant/1",
    quantity: 1,
    mode: "legacy58" as const,
    wilayaCode: "11",
    communeId: "dz:commune:359",
  };
  const quote = await localCommerceAdapter.quote(merchant, input, productId);
  if (discount) {
    quote.discountMinor = discount;
    for (const method of Object.values(quote.methods))
      if (method.totalMinor !== null) method.totalMinor -= discount;
  }
  const body = {
    customer: {
      ...input,
      name: "مستخدم تجريبي",
      phone: "0551234567",
      method: "office",
      address: "",
    },
    quoteToken: quote.quoteToken,
  };
  return { input, quote, body };
}
async function saved() {
  const { input, body } = await prepare();
  const result = await createOrder(
    merchant,
    body,
    randomUUID(),
    input.productId,
  );
  return result.order;
}
async function job(id: string) {
  const db = await openOutbox();
  try {
    return (await db
      .prepare(
        "SELECT * FROM shopify_order_outbox WHERE merchant_id=? AND order_id=?",
      )
      .get(merchant, id))!;
  } finally {
    await db.close();
  }
}
async function enable() {
  vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "1");
}
function retryRequest(
  id: string,
  cookie = token,
  origin = "https://app.example.test",
) {
  return new Request("https://app.example.test/api/orders/shopify-sync", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: `dz_session=${cookie}`,
    },
    body: JSON.stringify({ id }),
  });
}

describe.skipIf(!base)(
  "Shopify COD durable outbox with isolated PostgreSQL",
  () => {
    beforeEach(async () => {
      directory = mkdtempSync(join(tmpdir(), "dz-order-sync-"));
      schema = "order_sync_" + randomBytes(10).toString("hex");
      admin = new Pool({ connectionString: base });
      await admin.query(`CREATE SCHEMA ${schema}`);
      const url = new URL(base!);
      url.searchParams.set("options", `-c search_path=${schema}`);
      vi.stubEnv("DATABASE_URL", url.toString());
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "all");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", "");
      for (const name of ["AUTH", "SHIPPING", "ORDERS", "CHECKOUT"])
        vi.stubEnv(`${name}_DATABASE_PATH`, join(directory, name + ".sqlite"));
      vi.stubEnv(
        "INTEGRATIONS_ENCRYPTION_KEY",
        randomBytes(32).toString("hex"),
      );
      vi.stubEnv("SHOPIFY_CLIENT_ID", "fixture-client");
      vi.stubEnv("SHOPIFY_CLIENT_SECRET", "fixture-secret");
      vi.stubEnv(
        "SHOPIFY_REDIRECT_URI",
        "https://app.example.test/api/integrations/shopify/callback",
      );
      vi.stubEnv("SHOPIFY_SHOP", domain);
      for (const flag of [
        "DZ_SHOPIFY_ORDER_SYNC",
        "DZ_LOCAL_DEMO",
        "DZ_AUTH_TEST_BYPASS",
        "DZ_BOOTSTRAP_MODE",
        "DZ_DISABLE_EXTERNAL_INTEGRATIONS",
      ])
        vi.stubEnv(flag, "");
      token = await accountLogin(
        "sync@example.test",
        "fixture-password",
        "Fixture",
      );
      merchant = (await sessionMerchant(token))!;
      await offlineSession();
      schemas = mockedSchema(true);
      remotes = [];
      creates = 0;
      hide = false;
      deny = false;
      scopes = ["read_products", "write_orders"];
      version = "2026-10";
      behavior = "success";
      sentPayload = undefined;
      storeTaxesIncluded = false;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url, options) => {
          expect(String(url)).toBe(
            `https://${domain}/admin/api/2026-10/graphql.json`,
          );
          const { query, variables = {} } = JSON.parse(String(options?.body));
          if (deny) return response({}, 403);
          if (query.includes("DzCatalog"))
            return response({
              data: {
                shop: {
                  id: shopId,
                  currencyCode: "DZD",
                  taxesIncluded: storeTaxesIncluded,
                },
                products: {
                  nodes: [
                    {
                      id: "gid://shopify/Product/1",
                      title: "Fixture product",
                      description: "",
                      status: "ACTIVE",
                      images: { nodes: [] },
                      variants: {
                        nodes: [
                          {
                            id: "gid://shopify/ProductVariant/1",
                            title: "Default",
                            sku: "TEST-SKU",
                            price: "1200.00",
                            inventoryQuantity: 100,
                            inventoryPolicy: "DENY",
                            image: null,
                            selectedOptions: [],
                          },
                        ],
                        pageInfo: { hasNextPage: false, endCursor: null },
                      },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            });
          if (
            query.includes("DzOrderAccess") ||
            query.includes("DzOrderReadiness")
          )
            return response({
              data: {
                shop: {
                  id: shopId,
                  currencyCode: "DZD",
                  taxesIncluded: storeTaxesIncluded,
                },
                currentAppInstallation: {
                  accessScopes: scopes.map((handle) => ({ handle })),
                },
              },
            });
          if (query.includes("DzOrderType"))
            return response({
              data: { __type: schemas[variables.name] ?? null },
            });
          if (query.includes("DzProtectedDataReadiness"))
            return response({
              data: {
                orders: {
                  nodes: [
                    {
                      shippingAddress: {
                        firstName: "Synthetic",
                        phone: "synthetic-phone",
                        address1: "Synthetic address",
                      },
                    },
                  ],
                },
              },
            });
          if (query.includes("DzReadCod"))
            return response({
              data: {
                order: remotes.find((o) => o.id === variables.id) ?? null,
              },
            });
          if (query.includes("DzFindCod"))
            return response({
              data: {
                orders: {
                  nodes: hide ? [] : remotes,
                  pageInfo: { hasNextPage: false },
                },
              },
            });
          expect(query).toContain("mutation DzCreateCod");
          creates++;
          sentPayload = variables;
          expect(variables.options).toEqual({
            inventoryBehaviour: "BYPASS",
            sendReceipt: false,
            sendFulfillmentReceipt: false,
          });
          expect(variables.order.financialStatus).toBe("PENDING");
          expect(variables.order.transactions).toBeUndefined();
          if (behavior === "throttle") return response({}, 429);
          if (behavior === "invalid")
            return response({
              data: {
                orderCreate: {
                  order: null,
                  userErrors: [
                    {
                      field: ["shippingAddress"],
                      message:
                        "Private customer data must not be copied into logs",
                    },
                  ],
                },
              },
            });
          const o = variables.order;
          const amount =
            Number(o.lineItems[0].priceSet.shopMoney.amount) *
              o.lineItems[0].quantity +
            Number(o.shippingLines[0].priceSet.shopMoney.amount) -
            Number(
              o.discountCode?.itemFixedDiscountCode?.amountSet.shopMoney
                .amount ?? 0,
            );
          const remote: RemoteOrder = {
            id: "gid://shopify/Order/123",
            name: "#123",
            displayFinancialStatus: "PENDING",
            ...(o.sourceIdentifier
              ? { sourceIdentifier: o.sourceIdentifier }
              : {}),
            customAttributes: o.customAttributes,
            totalPriceSet: {
              shopMoney: {
                amount: (behavior === "mismatch" ? amount + 1 : amount).toFixed(
                  2,
                ),
                currencyCode: "DZD",
              },
            },
            totalOutstandingSet: {
              shopMoney: { amount: amount.toFixed(2), currencyCode: "DZD" },
            },
            totalShippingPriceSet: o.shippingLines[0].priceSet,
            totalDiscountsSet: {
              shopMoney: {
                amount: Number(
                  o.discountCode?.itemFixedDiscountCode?.amountSet.shopMoney
                    .amount ?? 0,
                ).toFixed(2),
                currencyCode: "DZD",
              },
            },
            totalTaxSet: { shopMoney: { amount: "0.00", currencyCode: "DZD" } },
            lineItems: {
              nodes: [
                {
                  quantity: o.lineItems[0].quantity,
                  originalUnitPriceSet: o.lineItems[0].priceSet,
                  variant: { id: o.lineItems[0].variantId },
                },
              ],
            },
          };
          remotes.push(remote);
          if (behavior === "partial")
            return response({
              data: { orderCreate: null },
              errors: [
                {
                  message: "private-fixture-data",
                  path: ["orderCreate", "order", "lineItems"],
                  extensions: { code: "ACCESS_DENIED" },
                },
              ],
            });
          if (behavior === "timeout")
            throw new Error("Lost response after remote commit");
          return response({
            data: { orderCreate: { order: remote, userErrors: [] } },
          });
        }),
      );
      vi.stubEnv("NODE_ENV", "production");
      await changeShipping(merchant, "legacy58", 0, {
        genericOffice: true,
        entries: [
          {
            scope: "wilaya",
            target: "11",
            rule: {
              available: true,
              home: { enabled: true, price: 700 },
              office: { enabled: true, price: 555 },
              eta: "",
            },
          },
        ],
      });
    });
    afterEach(async () => {
      await closeStoragePool();
      if (admin) {
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
      }
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    });
    it("defaults off, saves lead and outbox atomically and deduplicates the local save", async () => {
      const { input, body } = await prepare();
      const key = randomUUID();
      const a = await createOrder(merchant, body, key, input.productId);
      const b = await createOrder(merchant, body, key, input.productId);
      expect(a.order.id).toBe(b.order.id);
      expect((await job(a.order.id)).state).toBe("queued");
      expect(await processNextOrderSync()).toBe(false);
      expect(creates).toBe(0);
      expect((await listOrders(merchant))[0].shopifySync).toMatchObject({
        enabled: false,
        state: "queued",
      });
    });
    it("rolls the local save back when insertion of its sync job fails", async () => {
      const { input, body } = await prepare();
      await listOrders(merchant);
      await admin.query(
        `ALTER TABLE ${schema}.shopify_order_outbox ADD CONSTRAINT reject_job CHECK(state <> 'queued')`,
      );
      await expect(
        createOrder(merchant, body, randomUUID(), input.productId),
      ).rejects.toMatchObject({ code: "23514" });
      expect(await listOrders(merchant)).toHaveLength(0);
      expect(creates).toBe(0);
    });
    it("creates an unpaid order with exact shipping/address, binds its ID and does not resend on concurrent retry", async () => {
      const order = await saved();
      await enable();
      expect(
        new Session({
          id: "scope",
          shop: domain,
          state: "",
          isOnline: false,
          scope: "write_orders",
        }).isScopeIncluded(["read_orders"]),
      ).toBe(true);
      expect(requestedShopifyScopes()).toEqual([
        "read_products",
        "write_orders",
      ]);
      await Promise.all([processNextOrderSync(), processNextOrderSync()]);
      expect(creates).toBe(1);
      expect(await job(order.id)).toMatchObject({
        state: "synced",
        shopify_order_id: "gid://shopify/Order/123",
        dispatched: 1,
      });
      const payload = sentPayload as {
        order: {
          sourceIdentifier: string;
          shippingAddress: Record<string, unknown>;
          shippingLines: unknown[];
        };
      };
      expect(payload.order.sourceIdentifier).toBe(`dz-cod-${order.id}`);
      expect(payload.order.shippingAddress.city).toBe("Idles");
      expect(payload.order.shippingAddress.address1).toBeUndefined();
      expect(payload.order.shippingAddress.phone).toBe("+213551234567");
      expect(remotes[0].totalPriceSet.shopMoney.amount).toBe("1755.00");
      await requestOrderSync(merchant, order.id);
      expect(await processNextOrderSync()).toBe(false);
      expect(creates).toBe(1);
    });
    it("requires verifiable offline session and write_orders, but no separate read_orders", async () => {
      const order = await saved();
      await enable();
      const db = await authDb();
      try {
        await db
          .prepare("DELETE FROM shopify_session_metadata WHERE merchant_id=?")
          .run(merchant);
      } finally {
        await db.close();
      }
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("reauthorization");
      expect(creates).toBe(0);
      await offlineSession("read_products");
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).error_code).toBe("WRITE_ORDERS_REQUIRED");
      await offlineSession();
      scopes = ["read_products"];
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("reauthorization");
      scopes = ["read_products", "write_orders"];
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(creates).toBe(1);
    });
    it("reconciles a timeout after creation rather than creating again, even if access is temporarily denied", async () => {
      const order = await saved();
      await enable();
      behavior = "timeout";
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "uncertain",
        dispatched: 1,
      });
      expect(creates).toBe(1);
      deny = true;
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "uncertain",
        dispatched: 1,
      });
      deny = false;
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(creates).toBe(1);
    });

    it("keeps the dispatch fence after a partial GraphQL error following a remote commit", async () => {
      const order = await saved();
      await enable();
      behavior = "partial";
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "uncertain",
        dispatched: 1,
      });
      expect(creates).toBe(1);
      hide = true;
      behavior = "success";
      for (let i = 0; i < 2; i++) {
        await requestOrderSync(merchant, order.id);
        await processNextOrderSync();
      }
      expect(creates).toBe(1);
      expect((await job(order.id)).state).toBe("uncertain");
      // New worker/client instance after a lost lease still only reconciles.
      await admin.query(
        `UPDATE ${schema}.shopify_order_outbox SET state='processing',lease_until=0,next_attempt=0`,
      );
      hide = false;
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(creates).toBe(1);
    });
    it("persists the single-order fence across workers, stale configuration, restarts and queued backlog", async () => {
      const old = await saved();
      const selected = await saved();
      const other = await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", selected.id);
      await prepareOrderTrial(merchant, selected.id);
      await expect(
        prepareOrderTrial(merchant, selected.id),
      ).resolves.toMatchObject({ prepared: true });
      const oldBefore = await job(old.id),
        otherBefore = await job(other.id);
      await enable();
      await Promise.all([
        processNextOrderSync(),
        processNextOrderSync(),
        processNextOrderSync(),
      ]);
      expect(creates).toBe(1);
      expect((await job(selected.id)).state).toBe("synced");
      expect(await job(old.id)).toEqual(oldBefore);
      expect(await job(other.id)).toEqual(otherBefore);
      await expect(requestOrderSync(merchant, old.id)).rejects.toThrow(
        "TRIAL_SCOPE_DENIED",
      );
      // A misconfigured worker cannot override the database's durable trial.
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "all");
      expect(await processNextOrderSync()).toBe(false);
      await expect(
        admin.query(
          `UPDATE ${schema}.shopify_order_outbox SET dispatched=1 WHERE order_id=$1`,
          [old.id],
        ),
      ).rejects.toThrow("TRIAL_SCOPE_DENIED");
      await expect(
        admin.query(`DELETE FROM ${schema}.shopify_order_trial`),
      ).rejects.toThrow("TRIAL_BINDING_IMMUTABLE");
      await expect(
        admin.query(`TRUNCATE ${schema}.shopify_order_trial`),
      ).rejects.toThrow("TRIAL_BINDING_IMMUTABLE");
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", other.id);
      expect(await processNextOrderSync()).toBe(false);
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "0");
      await expect(prepareOrderTrial(merchant, other.id)).rejects.toThrow(
        "TRIAL_ALREADY_BOUND",
      );
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", selected.id);
      await enable();
      await closeStoragePool();
      expect(await processNextOrderSync()).toBe(false);
      expect(creates).toBe(1);
    });
    it("fails closed when trial is not prepared or an in-flight worker exists", async () => {
      const order = await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", order.id);
      await enable();
      expect(await processNextOrderSync()).toBe(false);
      await expect(prepareOrderTrial(merchant, order.id)).rejects.toThrow(
        "DISABLE_SYNC_BEFORE_TRIAL",
      );
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "0");
      await admin.query(
        `UPDATE ${schema}.shopify_order_outbox SET state='processing'`,
      );
      await expect(prepareOrderTrial(merchant, order.id)).rejects.toThrow(
        "TRIAL_WORKERS_IN_FLIGHT",
      );
      expect(creates).toBe(0);
    });
    it("authenticates trial preparation and preserves the server-selected local ID", async () => {
      const order = await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", order.id);
      expect((await trialRoute(retryRequest(order.id, ""))).status).toBe(401);
      expect(
        (
          await trialRoute(
            retryRequest(order.id, token, "https://evil.example"),
          )
        ).status,
      ).toBe(403);
      const other = await saved();
      expect((await trialRoute(retryRequest(other.id))).status).toBe(409);
      expect((await trialRoute(retryRequest(order.id))).status).toBe(200);
      expect(creates).toBe(0);
    });

    it("rejects trial preparation for another verified merchant's order", async () => {
      const order = await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", order.id);
      const otherToken = await accountLogin(
        "trial-other@example.test",
        "fixture-password",
        "Other trial",
      );
      const otherMerchant = (await sessionMerchant(otherToken))!;
      await saveConnection(
        otherMerchant,
        "trial-other.myshopify.com",
        "trial-fixture-token",
        "read_products,write_orders",
        new Session({
          id: "offline_trial-other.myshopify.com",
          shop: "trial-other.myshopify.com",
          state: "",
          isOnline: false,
          accessToken: "trial-fixture-token",
          scope: "read_products,write_orders",
        }),
        "gid://shopify/Shop/77",
      );
      const response = await trialRoute(retryRequest(order.id, otherToken));
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: "TRIAL_ORDER_INVALID" });
      expect(
        (
          await admin.query(
            `SELECT count(*)::integer AS count FROM ${schema}.shopify_order_trial`,
          )
        ).rows[0].count,
      ).toBe(0);
      expect((await trialRoute(retryRequest(order.id))).status).toBe(200);
      const wrongOwner = await trialRoute(retryRequest(order.id, otherToken));
      expect(wrongOwner.status).toBe(409);
      expect(
        (
          await admin.query(
            `SELECT merchant_id,order_id FROM ${schema}.shopify_order_trial`,
          )
        ).rows,
      ).toEqual([{ merchant_id: merchant, order_id: order.id }]);
      expect(creates).toBe(0);
    });
    it("reapplies the additive migration without rewriting existing orders, jobs or the trial binding", async () => {
      const selected = await saved();
      await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", selected.id);
      await prepareOrderTrial(merchant, selected.id);
      const snapshot = async () =>
        (
          await admin.query(
            `SELECT (SELECT json_agg(x ORDER BY id) FROM ${schema}.orders x) AS orders,(SELECT json_agg(x ORDER BY order_id) FROM ${schema}.shopify_order_outbox x) AS jobs,(SELECT json_agg(x) FROM ${schema}.shopify_order_trial x) AS trial`,
          )
        ).rows;
      const before = await snapshot();
      const migration = readFileSync(
        "scripts/migrations/005_shopify_single_order_trial.sql",
        "utf8",
      );
      const client = await admin.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('search_path',$1,true)", [
          schema,
        ]);
        await client.query(migration);
        await client.query(migration);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      expect(await snapshot()).toEqual(before);
      expect(creates).toBe(0);
    });

    it("exposes preparation eligibility only for the configured order in the authenticated merchant list", async () => {
      const selected = await saved();
      const other = await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", selected.id);
      const request = () =>
        new Request("https://app.example.test/api/orders", {
          headers: { cookie: `dz_session=${token}` },
        });
      const response = await ordersRoute(request());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(
        data.orders.find((o: { id: string }) => o.id === selected.id)
          .shopifySync.trialPreparationAllowed,
      ).toBe(true);
      expect(
        data.orders.find((o: { id: string }) => o.id === other.id).shopifySync
          .trialPreparationAllowed,
      ).toBe(false);
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "1");
      const enabled = await (await ordersRoute(request())).json();
      expect(
        enabled.orders.every(
          (o: { shopifySync: { trialPreparationAllowed: boolean } }) =>
            !o.shopifySync.trialPreparationAllowed,
        ),
      ).toBe(true);
      expect(creates).toBe(0);
    });
    it("readiness authenticates in READ ONLY transactions and sends queries only, without changing rows", async () => {
      const order = await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", order.id);
      await prepareOrderTrial(merchant, order.id);
      const snapshot = async () =>
        (
          await admin.query(
            `SELECT (SELECT json_agg(x) FROM ${schema}.shopify_order_outbox x) AS jobs,(SELECT json_agg(x) FROM ${schema}.shopify_connections x) AS credentials,(SELECT json_agg(x) FROM ${schema}.shopify_session_metadata x) AS metadata,(SELECT json_agg(x) FROM ${schema}.shopify_order_trial x) AS trial`,
          )
        ).rows;
      const before = await snapshot();
      const req = (cookie = token, extra = "") =>
        new Request(
          `https://app.example.test/api/orders/shopify-sync/readiness?id=${order.id}${extra}`,
          { headers: { cookie: `dz_session=${cookie}` } },
        );
      expect((await readinessRoute(req(""))).status).toBe(401);
      expect(
        (await readinessRoute(req(token, "&store=other-merchant"))).status,
      ).toBe(403);
      const readonlyURL = new URL(process.env.DATABASE_URL!);
      readonlyURL.searchParams.set(
        "options",
        `-c search_path=${schema} -c default_transaction_read_only=on`,
      );
      vi.stubEnv("DATABASE_URL", readonlyURL.toString());
      const response = await readinessRoute(req());
      expect(response.status).toBe(200);
      const report = await response.json();
      expect(report).toMatchObject({
        readOnly: true,
        ready: true,
        syncEnabled: false,
      });
      expect(JSON.stringify(report)).not.toMatch(
        /fixture-token|Synthetic address|synthetic-phone/,
      );
      expect(await snapshot()).toEqual(before);
      expect(creates).toBe(0);
      for (const call of vi.mocked(fetch).mock.calls)
        expect(JSON.parse(String(call[1]?.body)).query).not.toMatch(
          /^mutation/,
        );
    });

    it("readiness refuses another merchant's order and never claims protected access from an empty result", async () => {
      const order = await saved();
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
      vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", order.id);
      await prepareOrderTrial(merchant, order.id);
      const otherToken = await accountLogin(
        "other-probe@example.test",
        "fixture-password",
        "Other fixture",
      );
      const otherMerchant = (await sessionMerchant(otherToken))!;
      await saveConnection(
        otherMerchant,
        "other-fixture.myshopify.com",
        "other-fixture-token",
        "read_products,write_orders",
        new Session({
          id: "offline_other-fixture.myshopify.com",
          shop: "other-fixture.myshopify.com",
          state: "",
          isOnline: false,
          accessToken: "other-fixture-token",
          scope: "read_products,write_orders",
        }),
        "gid://shopify/Shop/66",
      );
      const req = (cookie = token) =>
        new Request(
          `https://app.example.test/api/orders/shopify-sync/readiness?id=${order.id}`,
          { headers: { cookie: `dz_session=${cookie}` } },
        );
      const calls = vi.mocked(fetch).mock.calls.length;
      expect((await readinessRoute(req(otherToken))).status).toBe(404);
      expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
      const original = fetch;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url, options) => {
          const { query } = JSON.parse(String(options?.body));
          if (query.includes("DzProtectedDataReadiness"))
            return response({ data: { orders: { nodes: [] } } });
          return original(url, options);
        }),
      );
      const report = await (await readinessRoute(req())).json();
      expect(report).toMatchObject({
        ready: false,
        checks: {
          protectedData: {
            status: "unverified",
            code: "PROTECTED_DATA_NOT_PROVEN",
          },
        },
      });
      const before = await job(order.id);
      await admin.query(
        `DROP TRIGGER dz_trial_dispatch ON ${schema}.shopify_order_outbox`,
      );
      const missingFence = await (await readinessRoute(req())).json();
      expect(missingFence).toMatchObject({
        ready: false,
        checks: { databaseFence: { status: "blocked" } },
      });
      // No schema-initialization helper silently repairs the dropped trigger.
      expect(
        (
          await admin.query(
            `SELECT 1 FROM pg_trigger WHERE tgrelid='${schema}.shopify_order_outbox'::regclass AND tgname='dz_trial_dispatch'`,
          )
        ).rows,
      ).toHaveLength(0);
      expect(creates).toBe(0);
      expect(
        (
          await admin.query(
            `SELECT state,dispatched FROM ${schema}.shopify_order_outbox WHERE order_id=$1`,
            [order.id],
          )
        ).rows[0],
      ).toMatchObject({ state: before.state, dispatched: before.dispatched });
    });
    it("never recreates an ambiguous order when the search index has not found it yet", async () => {
      const order = await saved();
      await enable();
      behavior = "timeout";
      await processNextOrderSync();
      hide = true;
      for (let n = 0; n < 3; n++) {
        await requestOrderSync(merchant, order.id);
        await processNextOrderSync();
        expect((await job(order.id)).state).toBe("uncertain");
      }
      expect(creates).toBe(1);
      hide = false;
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
    });
    it("recovers an expired processing lease through reconciliation only", async () => {
      const order = await saved();
      await enable();
      behavior = "timeout";
      await processNextOrderSync();
      await admin.query(
        `UPDATE ${schema}.shopify_order_outbox SET state='processing',lease_until=0,next_attempt=0`,
      );
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(creates).toBe(1);
    });
    it("keeps the local order and a safe review state when Shopify rejects customer data", async () => {
      const order = await saved();
      await enable();
      behavior = "invalid";
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "review",
        error_code: "SHOPIFY_VALIDATION",
        dispatched: 0,
      });
      expect(await listOrders(merchant)).toHaveLength(1);
      expect(JSON.stringify(await job(order.id))).not.toContain(
        "Private customer data",
      );
      behavior = "success";
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
    });
    it("respects throttling and retries only an explicit rejection with no created order", async () => {
      const order = await saved();
      await enable();
      behavior = "throttle";
      await processNextOrderSync();
      const failed = await job(order.id);
      expect(failed.state).toBe("retryable");
      expect(failed.dispatched).toBe(0);
      expect(Number(failed.next_attempt)).toBeGreaterThan(Date.now());
      behavior = "success";
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(remotes).toHaveLength(1);
    });
    it("stores the returned ID but refuses to call a mismatched total synced or create a replacement", async () => {
      const order = await saved();
      await enable();
      behavior = "mismatch";
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "review",
        shopify_order_id: "gid://shopify/Order/123",
        dispatched: 1,
      });
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect(creates).toBe(1);
      expect((await job(order.id)).state).toBe("review");
    });
    it("uses custom reference matching when sourceIdentifier is absent from the actual contract", async () => {
      const order = await saved();
      await enable();
      schemas = mockedSchema(false);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(
        (sentPayload as { order: Record<string, unknown> }).order
          .sourceIdentifier,
      ).toBeUndefined();
    });
    it("blocks unsupported fields or API fallback before any mutation", async () => {
      const order = await saved();
      await enable();
      schemas.OrderCreateOptionsInput = object({
        inventoryBehaviour: {
          kind: "ENUM",
          name: "OrderCreateInventoryBehaviour",
        },
      });
      await processNextOrderSync();
      expect((await job(order.id)).error_code).toBe("SCHEMA_UNSUPPORTED_FIELD");
      expect(creates).toBe(0);
      schemas = mockedSchema(true);
      version = "2026-07";
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).error_code).toBe("API_VERSION_MISMATCH");
      expect(creates).toBe(0);
    });
    it("maps a real snapshot discount and refuses an unexplained tax difference", async () => {
      const order = await saved();
      order.quote.discountMinor = 10000;
      for (const method of Object.values(order.quote.methods))
        if (method.totalMinor !== null) method.totalMinor -= 10000;
      await admin.query(`UPDATE ${schema}.orders SET data=$1 WHERE id=$2`, [
        JSON.stringify(order),
        order.id,
      ]);
      await enable();
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(remotes[0].totalPriceSet.shopMoney.amount).toBe("1655.00");
      order.quote.methods.office.totalMinor! += 1;
      expect(() => buildOrderPayload(order, true, shopId)).toThrow(
        "TAX_BREAKDOWN_REQUIRED",
      );
    });
    it("authenticates, scopes and checks CSRF on retry while preserving defaults off", async () => {
      const order = await saved();
      expect((await retryRoute(retryRequest(order.id))).status).toBe(503);
      await enable();
      expect((await retryRoute(retryRequest(order.id, "invalid"))).status).toBe(
        401,
      );
      expect(
        (
          await retryRoute(
            retryRequest(order.id, token, "https://evil.example"),
          )
        ).status,
      ).toBe(403);
      expect((await retryRoute(retryRequest(randomUUID()))).status).toBe(404);
      expect((await retryRoute(retryRequest(order.id))).status).toBe(202);
      expect(creates).toBe(0);
    });
    it("recovers when Shopify succeeded but persisting its response failed", async () => {
      const order = await saved();
      await enable();
      await admin.query(
        `CREATE FUNCTION ${schema}.fail_synced() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='synced' THEN RAISE EXCEPTION 'fixture storage failure'; END IF; RETURN NEW; END $$`,
      );
      await admin.query(
        `CREATE TRIGGER fail_sync_write BEFORE UPDATE ON ${schema}.shopify_order_outbox FOR EACH ROW EXECUTE FUNCTION ${schema}.fail_synced()`,
      );
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "uncertain",
        dispatched: 1,
      });
      expect(creates).toBe(1);
      await admin.query(
        `DROP TRIGGER fail_sync_write ON ${schema}.shopify_order_outbox`,
      );
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("synced");
      expect(creates).toBe(1);
    });
    it("refuses multiple remote matches, unsupported inventory policy and cancelled local leads", async () => {
      const order = await saved();
      await enable();
      vi.stubEnv(
        "DZ_SHOPIFY_ORDER_INVENTORY_POLICY",
        "DECREMENT_OBEYING_POLICY",
      );
      await processNextOrderSync();
      expect((await job(order.id)).error_code).toBe(
        "INVENTORY_POLICY_UNSUPPORTED",
      );
      expect(creates).toBe(0);
      vi.stubEnv("DZ_SHOPIFY_ORDER_INVENTORY_POLICY", "BYPASS");
      await requestOrderSync(merchant, order.id);
      behavior = "timeout";
      await processNextOrderSync();
      remotes.push({ ...remotes[0], id: "gid://shopify/Order/999" });
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "review",
        error_code: "MULTIPLE_REMOTE_MATCHES",
        dispatched: 1,
      });
      expect(creates).toBe(1);
    });

    it("does not send cancelled leads and can enqueue previously saved leads without duplicating the local order", async () => {
      const order = await saved();
      const db = await openOutbox();
      try {
        await db
          .prepare(
            "DELETE FROM shopify_order_outbox WHERE merchant_id=? AND order_id=?",
          )
          .run(merchant, order.id);
      } finally {
        await db.close();
      }
      expect((await listOrders(merchant))[0].shopifySync?.state).toBe(
        "not_queued",
      );
      await enable();
      expect((await retryRoute(retryRequest(order.id))).status).toBe(202);
      expect(await listOrders(merchant)).toHaveLength(1);
      await setOrderStatus(merchant, order.id, "cancelled");
      await processNextOrderSync();
      expect((await job(order.id)).state).toBe("cancelled");
      expect(creates).toBe(0);
      expect((await retryRoute(retryRequest(order.id))).status).toBe(409);
    });
    it("does not attach an unrelated order returned by search to the local lead", async () => {
      const order = await saved();
      await enable();
      behavior = "timeout";
      await processNextOrderSync();
      remotes[0].customAttributes = [];
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect(await job(order.id)).toMatchObject({
        state: "review",
        error_code: "REMOTE_REFERENCE_MISMATCH",
        shopify_order_id: null,
        dispatched: 1,
      });
      expect(creates).toBe(1);
    });

    it("forwards real home delivery data and quantity, but blocks an unrepresented tax-inclusive policy", async () => {
      const { input, body } = await prepare();
      const priced = { ...input, quantity: 2 };
      const quote = await localCommerceAdapter.quote(
        merchant,
        priced,
        input.productId,
      );
      const created = await createOrder(
        merchant,
        {
          ...body,
          customer: {
            ...body.customer,
            quantity: 2,
            method: "home",
            address: "عنوان محلي اختباري 12",
          },
          quoteToken: quote.quoteToken,
        },
        randomUUID(),
        input.productId,
      );
      await enable();
      storeTaxesIncluded = true;
      await processNextOrderSync();
      expect((await job(created.order.id)).error_code).toBe(
        "TAX_BREAKDOWN_REQUIRED",
      );
      expect(creates).toBe(0);
      storeTaxesIncluded = false;
      await requestOrderSync(merchant, created.order.id);
      await processNextOrderSync();
      expect((await job(created.order.id)).state).toBe("synced");
      expect(remotes[0].totalPriceSet.shopMoney.amount).toBe("3100.00");
      const payload = sentPayload as {
        order: {
          shippingAddress: { address1: string };
          lineItems: { quantity: number }[];
        };
      };
      expect(payload.order.shippingAddress.address1).toBe(
        "عنوان محلي اختباري 12",
      );
      expect(payload.order.lineItems[0].quantity).toBe(2);
    });

    it("does not send a changed persisted payload under the original idempotency reference", async () => {
      const order = await saved();
      await enable();
      behavior = "invalid";
      await processNextOrderSync();
      const row = await job(order.id);
      const changed = JSON.parse(String(row.payload_json));
      changed.order.lineItems[0].quantity = 2;
      await admin.query(
        `UPDATE ${schema}.shopify_order_outbox SET payload_json=$1 WHERE order_id=$2`,
        [JSON.stringify(changed), order.id],
      );
      await requestOrderSync(merchant, order.id);
      await processNextOrderSync();
      expect((await job(order.id)).error_code).toBe("PAYLOAD_CORRUPT");
      expect(creates).toBe(1);
      expect(remotes).toHaveLength(0);
    });
  },
);
