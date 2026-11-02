import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { closeStoragePool } from "../src/modules/storage/database";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, createHmac } from "node:crypto";
import {
  accountLogin,
  sessionMerchant,
  authDb,
} from "../src/modules/auth/store";
import { saveConnection } from "../src/modules/integrations/shopify/connections";
import {
  readShopifyCatalog,
  catalogSyncStatus,
  invalidateShopifyCatalog,
  priceMinor,
  shopifyCatalogMode,
} from "../src/modules/integrations/shopify/catalog";
import { POST as webhook } from "../src/app/api/shopify/webhooks/route";
import { getCheckoutCatalog } from "../src/modules/checkout/repository";
const domain = "fixture.myshopify.com",
  gid = "gid://shopify/Shop/55",
  secret = "fixture-secret";
it("keeps production on Shopify mode when external integration is disabled, with no local fallback", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DZ_DISABLE_EXTERNAL_INTEGRATIONS", "1");
  expect(shopifyCatalogMode()).toBe(true);
  await expect(readShopifyCatalog(merchant)).rejects.toThrow("disabled");
});
let dir: string,
  merchant: string,
  deleted: boolean,
  fail: boolean,
  currency: string,
  calls: number;
let admin: Pool | undefined, schema: string;
const variant = (id: number) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  title: "Blue / L",
  sku: `SKU-${id}`,
  price: "1200.50",
  inventoryQuantity: id === 1 ? 3 : 0,
  inventoryPolicy: "DENY",
  image: { url: "https://cdn.shopify.com/variant.webp" },
  selectedOptions: [
    { name: "Color", value: "Blue" },
    { name: "Size", value: "L" },
  ],
});
const product = (id: number) => ({
  id: `gid://shopify/Product/${id}`,
  title: `Shopify ${id}`,
  description: "Shopify description",
  status: "ACTIVE",
  images: { nodes: [{ url: "https://cdn.shopify.com/product.webp" }] },
  variants: {
    nodes: [variant(id)],
    pageInfo: { hasNextPage: id === 1, endCursor: id === 1 ? "v1" : null },
  },
});
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "dz-shopify-catalog-"));
  vi.stubEnv("AUTH_DATABASE_PATH", join(dir, "auth.sqlite"));
  vi.stubEnv("CHECKOUT_DATABASE_PATH", join(dir, "checkout.sqlite"));
  vi.stubEnv("DATABASE_URL", "");
  if (process.env.POSTGRES_TEST_URL) {
    schema = "catalog_" + randomBytes(12).toString("hex");
    admin = new Pool({ connectionString: process.env.POSTGRES_TEST_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.POSTGRES_TEST_URL);
    url.searchParams.set("options", `-c search_path=${schema}`);
    vi.stubEnv("DATABASE_URL", url.toString());
  }
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
  vi.stubEnv("SHOPIFY_CLIENT_ID", "fixture-client");
  vi.stubEnv("SHOPIFY_CLIENT_SECRET", secret);
  vi.stubEnv(
    "SHOPIFY_REDIRECT_URI",
    "https://app.example.test/api/integrations/shopify/callback",
  );
  vi.stubEnv("SHOPIFY_SHOP", domain);
  vi.stubEnv("DZ_LOCAL_DEMO", "");
  vi.stubEnv("DZ_DISABLE_EXTERNAL_INTEGRATIONS", "");
  const token = await accountLogin(
    "catalog@example.test",
    "fixture-password",
    "Fixture",
  );
  merchant = (await sessionMerchant(token))!;
  await saveConnection(
    merchant,
    domain,
    "fixture-token",
    "read_products",
    undefined,
    gid,
  );
  deleted = false;
  fail = false;
  currency = "DZD";
  calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, options) => {
      expect(String(input)).toBe(
        `https://${domain}/admin/api/2026-10/graphql.json`,
      );
      calls++;
      const body = JSON.parse(String(options?.body));
      if (body.query.includes("DzCatalogVariants"))
        return Response.json({
          data: {
            product: {
              variants: {
                nodes: [variant(3)],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      if (fail && body.variables?.after)
        return Response.json({
          errors: [{ message: "fixture-provider-failure" }],
        });
      return Response.json({
        data: {
          shop: { id: gid, currencyCode: currency },
          products: {
            nodes: body.variables?.after ? [product(2)] : [product(1)],
            pageInfo: {
              hasNextPage: !deleted && !body.variables?.after,
              endCursor: !deleted && !body.variables?.after ? "p1" : null,
            },
          },
        },
      });
    }),
  );
});
afterEach(async () => {
  await closeStoragePool();
  if (admin) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    admin = undefined;
  }
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
it.skipIf(!process.env.POSTGRES_TEST_URL)(
  "applies catalog migration twice on PostgreSQL without losing the snapshot",
  async () => {
    const first = await readShopifyCatalog(merchant);
    const client = await admin!.connect();
    try {
      await client.query(`SET search_path TO ${schema}`);
      const sql = readFileSync(
        "scripts/migrations/003_shopify_catalog.sql",
        "utf8",
      );
      await client.query(sql);
      await client.query(sql);
    } finally {
      await client.query("RESET search_path");
      client.release();
    }
    expect(await readShopifyCatalog(merchant)).toEqual(first);
  },
);
it("imports all product/variant pages with authoritative image, SKU, options, exact DZD price and availability", async () => {
  const catalog = await readShopifyCatalog(merchant);
  expect(catalog.products.map((p) => p.id)).toEqual([
    "gid://shopify/Product/1",
    "gid://shopify/Product/2",
  ]);
  expect(catalog.products[0]).toMatchObject({
    demo: false,
    imageUrl: "https://cdn.shopify.com/product.webp",
    variants: [
      {
        sku: "SKU-1",
        priceMinor: 120050,
        stock: 3,
        selectedOptions: [
          { name: "Color", value: "Blue" },
          { name: "Size", value: "L" },
        ],
      },
      { sku: "SKU-3", stock: 0 },
    ],
  });
  expect(calls).toBe(3);
  expect(await readShopifyCatalog(merchant)).toEqual(catalog);
  expect(calls).toBe(3);
  expect((await catalogSyncStatus(merchant)).needsSync).toBe(false);
});
it("reconciles updates and deletions atomically without touching local products or historical data", async () => {
  const local = await getCheckoutCatalog(merchant);
  await readShopifyCatalog(merchant);
  deleted = true;
  await invalidateShopifyCatalog(domain, "delivery-1", "hash");
  expect((await catalogSyncStatus(merchant)).needsSync).toBe(true);
  const latest = await readShopifyCatalog(merchant);
  expect(latest.products).toHaveLength(1);
  expect(latest.revision).toBe(2);
  expect(await getCheckoutCatalog(merchant)).toEqual(local);
  await invalidateShopifyCatalog(domain, "delivery-1", "hash");
  expect((await catalogSyncStatus(merchant)).needsSync).toBe(false);
});
it("does not publish partial catalogs on failure and recovers on retry", async () => {
  const initial = await readShopifyCatalog(merchant);
  fail = true;
  await expect(readShopifyCatalog(merchant, true)).rejects.toThrow();
  expect((await catalogSyncStatus(merchant)).error).toBe("sync_failed");
  const db = await authDb();
  try {
    const row = await db
      .prepare("SELECT payload FROM shopify_catalog WHERE merchant_id=?")
      .get(merchant);
    expect(JSON.parse(String(row!.payload))).toEqual(initial);
  } finally {
    await db.close();
  }
  fail = false;
  expect((await readShopifyCatalog(merchant)).revision).toBe(2);
});
it("rejects unverified merchants, foreign currency and prices it cannot represent safely", async () => {
  await expect(readShopifyCatalog("other-merchant")).rejects.toThrow();
  expect(calls).toBe(0);
  currency = "USD";
  await expect(readShopifyCatalog(merchant)).rejects.toThrow();
  for (const value of ["1.001", "NaN", "-1", "1000000000000000"])
    expect(() => priceMinor(value)).toThrow();
});
it("verifies product webhook signatures and uses only the verified shop mapping for invalidation", async () => {
  await readShopifyCatalog(merchant);
  const body = JSON.stringify({ id: 1 });
  const request = (signature: string, shop = domain) =>
    new Request("https://app.example.test/api/shopify/webhooks", {
      method: "POST",
      body,
      headers: {
        "X-Shopify-Hmac-Sha256": signature,
        "X-Shopify-Topic": "products/update",
        "X-Shopify-Shop-Domain": shop,
        "X-Shopify-API-Version": "2026-10",
        "X-Shopify-Webhook-Id": "event-1",
      },
    });
  expect((await webhook(request("invalid"))).status).toBe(401);
  expect((await catalogSyncStatus(merchant)).needsSync).toBe(false);
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  expect(
    (await webhook(request(signature, "unknown.myshopify.com"))).status,
  ).toBe(200);
  expect((await catalogSyncStatus(merchant)).needsSync).toBe(false);
  expect((await webhook(request(signature))).status).toBe(200);
  expect((await catalogSyncStatus(merchant)).needsSync).toBe(true);
});
