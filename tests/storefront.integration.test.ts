import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Session } from "@shopify/shopify-api";
import { accountLogin, sessionMerchant } from "../src/modules/auth/store";
import { saveConnection } from "../src/modules/integrations/shopify/connections";
import { changeShipping } from "../src/modules/shipping/repository";
import { closeStoragePool } from "../src/modules/storage/database";
import { defaultFormSettings } from "../src/modules/forms/settings";
import { storefrontRequest } from "../src/modules/storefront/http";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";
const base = process.env.POSTGRES_TEST_URL,
  shop = "fixture.myshopify.com",
  productId = "gid://shopify/Product/1",
  variantId = "gid://shopify/ProductVariant/11",
  secret = "synthetic-client-secret";
let admin: Pool,
  schema: string,
  directory: string,
  merchant: string,
  price: string,
  status: string,
  published: boolean,
  apiVersion: string,
  fail: boolean;
function signed(
  operation: string,
  params: Record<string, string> = {},
  body?: unknown,
  origin = "https://fixture-store.example",
) {
  const q = new URLSearchParams({
    shop,
    timestamp: String(Math.trunc(Date.now() / 1000)),
    path_prefix: "/apps/dz-cod",
    logged_in_customer_id: "",
    ...params,
  });
  const canonical = [...q.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("");
  q.set(
    "signature",
    createHmac("sha256", secret).update(canonical).digest("hex"),
  );
  return new Request(
    `https://app.example.test/api/storefront/${operation}?${q}`,
    {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json", origin } : {},
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}
async function boot() {
  const response = await storefrontRequest(
    signed("bootstrap", {
      product: productId,
      origin: "https://fixture-store.example",
    }),
    "bootstrap",
  );
  expect(response.status).toBe(200);
  return response.json();
}
const input = () => ({
  productId,
  variantId,
  quantity: 1,
  mode: "legacy58",
  wilayaCode: "11",
  communeId: "dz:commune:359",
});
async function quote(context: string, extra = {}) {
  return storefrontRequest(
    signed("quote", {}, { context, input: { ...input(), ...extra } }),
    "quote",
  );
}
describe.skipIf(!base)(
  "Signed Shopify storefront validation-only transport",
  () => {
    beforeEach(async () => {
      admin = new Pool({ connectionString: base });
      schema = "sf_" + randomUUID().replaceAll("-", "");
      directory = mkdtempSync(join(tmpdir(), "dz-sf-"));
      const client = await admin.connect();
      try {
        await client.query("BEGIN");
        await client.query(`CREATE SCHEMA ${schema}`);
        await client.query("SELECT set_config('search_path',$1,true)", [
          schema,
        ]);
        await client.query(readFileSync("scripts/postgres-schema.sql", "utf8"));
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      const url = new URL(base!);
      url.searchParams.set("options", `-c search_path=${schema}`);
      vi.stubEnv("DATABASE_URL", url.toString());
      vi.stubEnv("NODE_ENV", "test");
      for (const name of ["AUTH", "SHIPPING", "ORDERS", "CHECKOUT"])
        vi.stubEnv(name + "_DATABASE_PATH", join(directory, name + ".sqlite"));
      vi.stubEnv(
        "INTEGRATIONS_ENCRYPTION_KEY",
        randomBytes(32).toString("hex"),
      );
      vi.stubEnv("SHOPIFY_CLIENT_ID", "synthetic-client");
      vi.stubEnv("SHOPIFY_CLIENT_SECRET", secret);
      vi.stubEnv(
        "SHOPIFY_REDIRECT_URI",
        "https://app.example.test/api/integrations/shopify/callback",
      );
      vi.stubEnv("SHOPIFY_SHOP", shop);
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "0");
      for (const flag of [
        "DZ_BOOTSTRAP_MODE",
        "DZ_LOCAL_DEMO",
        "DZ_DISABLE_EXTERNAL_INTEGRATIONS",
        "DZ_AUTH_TEST_BYPASS",
      ])
        vi.stubEnv(flag, "");
      const token = await accountLogin(
        "storefront@example.test",
        "fixture-password",
        "Fixture",
      );
      merchant = (await sessionMerchant(token))!;
      await saveConnection(
        merchant,
        shop,
        "synthetic-offline-access",
        "read_products",
        new Session({
          id: `offline_${shop}`,
          shop,
          state: "",
          isOnline: false,
          accessToken: "synthetic-offline-access",
          scope: "read_products",
          expires: new Date(Date.now() + 3600000),
          refreshToken: "synthetic-refresh",
          refreshTokenExpires: new Date(Date.now() + 7200000),
        }),
        "gid://shopify/Shop/55",
      );
      await changeShipping(merchant, "legacy58", 0, {
        genericOffice: true,
        entries: [
          {
            scope: "default",
            target: "*",
            rule: {
              available: true,
              home: { enabled: true, price: 700 },
              office: { enabled: true, price: 555 },
              eta: "",
            },
          },
        ],
      });
      price = "1200.00";
      status = "ACTIVE";
      published = true;
      apiVersion = "2026-10";
      fail = false;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: unknown, options: RequestInit) => {
          expect(String(url)).toBe(
            `https://${shop}/admin/api/2026-10/graphql.json`,
          );
          expect(
            new Headers(options.headers).get("x-shopify-access-token"),
          ).toBe("synthetic-offline-access");
          const { query, variables } = JSON.parse(String(options.body));
          expect(query.trim()).toMatch(/^query /);
          expect(query).not.toMatch(/mutation|orderCreate|inventoryAdjust/);
          if (fail) throw new Error("private connection details");
          const product =
            variables.id === productId
              ? {
                  id: productId,
                  title: "Fixture product",
                  status,
                  onlineStoreUrl: published
                    ? "https://fixture-store.example/products/fixture"
                    : null,
                  featuredImage: { url: "https://cdn.shopify.com/fixture.jpg" },
                  variants: {
                    nodes: [
                      {
                        id: variantId,
                        title: "Black",
                        price,
                        inventoryQuantity: 100,
                        image: null,
                        selectedOptions: [{ name: "Colour", value: "Black" }],
                      },
                      {
                        id: "gid://shopify/ProductVariant/12",
                        title: "Brown",
                        price: "1400.00",
                        inventoryQuantity: 3,
                        image: null,
                        selectedOptions: [],
                      },
                    ],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                }
              : null;
          return Response.json(
            {
              data: {
                shop: {
                  id: "gid://shopify/Shop/55",
                  currencyCode: "DZD",
                  primaryDomain: { url: "https://fixture-store.example" },
                },
                product,
              },
            },
            { headers: { "x-shopify-api-version": apiVersion } },
          );
        }),
      );
    });
    afterEach(async () => {
      await closeStoragePool();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
      rmSync(directory, { recursive: true, force: true });
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });
    it("loads the current published product without a merchant cookie and exposes no private credentials", async () => {
      const response = await storefrontRequest(
        signed("bootstrap", {
          product: productId,
          origin: "https://fixture-store.example",
        }),
        "bootstrap",
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        phase: 2,
        submission: "validate_only",
        product: {
          id: productId,
          demo: false,
          variants: [{ id: variantId, priceMinor: 120000 }, {}],
        },
      });
      expect(body.wilayas).toHaveLength(58);
      expect(body.design.title).toBe("أكمل معلومات طلبك");
      expect(body.design.officePickupInstructions).toBe("");
      expect(body.context).toBeTypeOf("string");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(JSON.stringify(body)).not.toMatch(
        /synthetic-offline-access|synthetic-refresh|synthetic-client-secret|encrypted_|merchantId/,
      );
    });
    it("reuses shipping prices, validates customer input, and never writes data or creates orders", async () => {
      const snapshot = async () =>
        (
          await admin.query(
            `SELECT (SELECT json_agg(x) FROM ${schema}.shopify_connections x) AS connection,(SELECT json_agg(x) FROM ${schema}.shopify_session_metadata x) AS metadata,(SELECT json_agg(x) FROM ${schema}.shipping_rules x) AS shipping,(SELECT count(*) FROM ${schema}.orders) AS orders,(SELECT count(*) FROM ${schema}.shopify_order_outbox) AS jobs`,
          )
        ).rows;
      const before = await snapshot();
      const url = new URL(process.env.DATABASE_URL!);
      url.searchParams.set(
        "options",
        `-c search_path=${schema} -c default_transaction_read_only=on`,
      );
      vi.stubEnv("DATABASE_URL", url.toString());
      const b = await boot();
      const q = await (await quote(b.context)).json();
      expect(q.methods).toMatchObject({
        home: { available: true, totalMinor: 190000 },
        office: { available: true, totalMinor: 175500 },
      });
      const validated = await storefrontRequest(
        signed(
          "validate",
          {},
          {
            context: b.context,
            quoteToken: q.quoteToken,
            customer: {
              ...input(),
              name: "اسم تجريبي",
              phone: "+213551234567",
              method: "office",
              address: "",
            },
          },
        ),
        "validate",
      );
      expect(validated.status).toBe(200);
      expect(await validated.json()).toMatchObject({
        validated: true,
        persisted: false,
        shopifyOrderCreated: false,
      });
      expect(await snapshot()).toEqual(before);
      expect(process.env.DZ_SHOPIFY_ORDER_SYNC).toBe("0");
    });
    it.each(["missing", "tampered", "expired", "duplicate"] as const)(
      "refuses %s App Proxy signatures before any Shopify call",
      async (kind) => {
        let request = signed("bootstrap", {
          product: productId,
          origin: "https://fixture-store.example",
          ...(kind === "expired"
            ? { timestamp: String(Math.trunc(Date.now() / 1000) - 180) }
            : {}),
        });
        const url = new URL(request.url);
        if (kind === "missing") url.searchParams.delete("signature");
        if (kind === "tampered")
          url.searchParams.set("shop", "other.myshopify.com");
        if (kind === "duplicate") url.searchParams.append("shop", shop);
        request = new Request(url);
        const result = await storefrontRequest(request, "bootstrap");
        expect(result.status).toBe(401);
        expect(fetch).not.toHaveBeenCalled();
      },
    );
    it("rejects unsigned direct requests while keeping merchant APIs protected", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const request = new NextRequest(
        "https://app.example.test/api/storefront/bootstrap?product=" +
          encodeURIComponent(productId),
      );
      expect((await proxy(request)).status).toBe(200);
      expect((await storefrontRequest(request, "bootstrap")).status).toBe(401);
      expect(
        (
          await proxy(
            new NextRequest("https://app.example.test/api/orders", {
              method: "POST",
            }),
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await proxy(
            new NextRequest("https://app.example.test/api/storefront/create"),
          )
        ).status,
      ).toBe(401);
    });
    it("binds CSRF context to shop, product and storefront origin", async () => {
      const b = await boot();
      const calls = vi.mocked(fetch).mock.calls.length;
      expect((await quote(b.context + "bad")).status).toBe(403);
      expect(
        (
          await storefrontRequest(
            signed(
              "quote",
              {},
              { context: b.context, input: input() },
              "https://evil.example",
            ),
            "quote",
          )
        ).status,
      ).toBe(403);
      expect(
        (await quote(b.context, { productId: "gid://shopify/Product/999" }))
          .status,
      ).toBe(403);
      expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
      expect(
        (
          await storefrontRequest(
            signed("bootstrap", {
              product: productId,
              origin: "https://evil.example",
            }),
            "bootstrap",
          )
        ).status,
      ).toBe(403);
    });
    it("does not trust a client merchant selector or a different signed shop", async () => {
      const b = await storefrontRequest(
        signed("bootstrap", {
          product: productId,
          origin: "https://fixture-store.example",
          store: randomUUID(),
        }),
        "bootstrap",
      );
      expect(b.status).toBe(200);
      const calls = vi.mocked(fetch).mock.calls.length;
      const wrong = await storefrontRequest(
        signed("bootstrap", {
          shop: "other.myshopify.com",
          product: productId,
          origin: "https://fixture-store.example",
        }),
        "bootstrap",
      );
      expect(wrong.status).toBe(404);
      expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
    });
    it.each([
      "DRAFT",
      "ARCHIVED",
      "unpublished",
      "api-fallback",
      "network",
    ] as const)(
      "blocks %s products/responses without demo fallback",
      async (kind) => {
        if (kind === "unpublished") published = false;
        else if (kind === "api-fallback") apiVersion = "2026-07";
        else if (kind === "network") fail = true;
        else status = kind;
        const response = await storefrontRequest(
          signed("bootstrap", {
            product: productId,
            origin: "https://fixture-store.example",
          }),
          "bootstrap",
        );
        expect(response.status).not.toBe(200);
        expect(JSON.stringify(await response.json())).not.toMatch(
          /private connection|synthetic-offline/,
        );
      },
    );
    it("revalidates price changes, variant membership, quantity, phone and home address on the server", async () => {
      const b = await boot(),
        q = await (await quote(b.context)).json();
      const customer = {
        ...input(),
        name: "اسم تجريبي",
        phone: "0551234567",
        method: "home",
        address: "عنوان تجريبي 123",
      };
      for (const changes of [
        { phone: "123" },
        { address: "" },
        { quantity: 0 },
        { quantity: 11 },
      ])
        expect(
          (
            await storefrontRequest(
              signed(
                "validate",
                {},
                {
                  context: b.context,
                  quoteToken: q.quoteToken,
                  customer: { ...customer, ...changes },
                },
              ),
              "validate",
            )
          ).status,
        ).toBe(400);
      expect(
        (
          await quote(b.context, {
            variantId: "gid://shopify/ProductVariant/999",
          })
        ).status,
      ).toBe(400);
      expect((await quote(b.context, { quantity: 11 })).status).toBe(400);
      expect((await quote(b.context, { unitPriceMinor: 1 })).status).toBe(400);
      price = "1300.00";
      const changed = await storefrontRequest(
        signed(
          "validate",
          {},
          { context: b.context, quoteToken: q.quoteToken, customer },
        ),
        "validate",
      );
      expect(changed.status).toBe(409);
      expect(await changed.json()).toEqual({ code: "PRICE_CHANGED" });
    });
    it("honours explicit home/office disablement and the generic-office policy", async () => {
      await changeShipping(merchant, "legacy58", 1, {
        genericOffice: false,
        entries: [
          {
            scope: "wilaya",
            target: "11",
            rule: {
              available: true,
              home: { enabled: false, price: 700 },
              office: { enabled: true, price: 555 },
              eta: "",
            },
          },
        ],
      });
      const b = await boot(),
        q = await (await quote(b.context)).json();
      expect(q.methods.home).toMatchObject({
        available: false,
        amountMinor: null,
        totalMinor: null,
      });
      expect(q.methods.office).toMatchObject({
        available: false,
        amountMinor: null,
        totalMinor: null,
      });
    });
    it("does not invent missing shipping rates and rejects mismatched geography", async () => {
      await admin.query(`DELETE FROM ${schema}.shipping_rules`);
      const b = await boot(),
        q = await (await quote(b.context)).json();
      expect(q.methods.home.available).toBe(false);
      expect(q.methods.office.available).toBe(false);
      expect((await quote(b.context, { wilayaCode: "07" })).status).toBe(400);
    });
    it("refuses expired/unusable Offline tokens without refresh or remote calls", async () => {
      await saveConnection(
        merchant,
        shop,
        "synthetic-offline-access",
        "read_products",
        new Session({
          id: `offline_${shop}`,
          shop,
          state: "",
          isOnline: false,
          accessToken: "synthetic-offline-access",
          scope: "read_products",
          expires: new Date(Date.now() - 1000),
          refreshToken: "synthetic-refresh",
          refreshTokenExpires: new Date(Date.now() + 7200000),
        }),
        "gid://shopify/Shop/55",
      );
      const response = await storefrontRequest(
        signed("bootstrap", {
          product: productId,
          origin: "https://fixture-store.example",
        }),
        "bootstrap",
      );
      expect(response.status).toBe(503);
      expect(fetch).not.toHaveBeenCalled();
    });
    it("exposes the saved field policy, order, font and colours without product-form overrides", async () => {
      const settings = {
        ...defaultFormSettings,
        title: "إعدادات متجري",
        buttonColor: "#123456",
        fontFamily: "serif",
        fontSize: 18,
        locale: "fr",
        contact: { name: "optional", phone: "hidden", address: "optional" },
        order: [...defaultFormSettings.order].reverse(),
      };
      const url = new URL(process.env.DATABASE_URL!);
      const pool = new Pool({ connectionString: url.toString() });
      try {
        await pool.query(
          "INSERT INTO form_settings VALUES($1,$2) ON CONFLICT(merchant_id) DO UPDATE SET settings=excluded.settings",
          [merchant, JSON.stringify(settings)],
        );
      } finally {
        await pool.end();
      }
      const { design, context } = await boot();
      expect(design).toMatchObject({
        title: settings.title,
        buttonColor: settings.buttonColor,
        contact: settings.contact,
        order: settings.order,
        fontFamily: "serif",
        fontSize: 18,
        locale: "fr",
      });
      const q = await (await quote(context)).json();
      const customer = {
        ...input(),
        method: "office",
        name: "",
        phone: "",
        address: "",
      };
      const out = await storefrontRequest(
        signed("validate", {}, { context, customer, quoteToken: q.quoteToken }),
        "validate",
      );
      expect(out.status).toBe(200);
      expect(await out.json()).toMatchObject({
        validated: true,
        persisted: false,
        shopifyOrderCreated: false,
      });
      const forged = await storefrontRequest(
        signed(
          "validate",
          {},
          {
            context,
            customer: { ...customer, phone: "0555123456" },
            quoteToken: q.quoteToken,
          },
        ),
        "validate",
      );
      expect(forged.status).toBe(400);
    });
    it("enforces hidden quantity and fixed geography on the server", async () => {
      const settings = {
        ...defaultFormSettings,
        elements: {
          ...defaultFormSettings.elements,
          quantity: false,
          geography: false,
        },
        fixedWilaya: "11",
        fixedCommune: "dz:commune:359",
      };
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        await pool.query(
          "INSERT INTO form_settings VALUES($1,$2) ON CONFLICT(merchant_id) DO UPDATE SET settings=excluded.settings",
          [merchant, JSON.stringify(settings)],
        );
      } finally {
        await pool.end();
      }
      const { context } = await boot();
      expect((await quote(context)).status).toBe(200);
      expect((await quote(context, { quantity: 2 })).status).toBe(400);
      expect(
        (
          await quote(context, {
            wilayaCode: "07",
            communeId: "dz:commune:2000",
          })
        ).status,
      ).toBe(400);
    });
    it("never accepts a creation operation and returns only validation flags", async () => {
      expect(
        (await storefrontRequest(signed("orders", {}, {}), "orders")).status,
      ).toBe(404);
      const response = await storefrontRequest(
        signed("bootstrap", {}, {}),
        "bootstrap",
      );
      expect(response.status).toBe(405);
      expect(fetch).not.toHaveBeenCalled();
    });
  },
);
