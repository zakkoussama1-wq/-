import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { authDb } from "../src/modules/auth/store";
import { closeStoragePool } from "../src/modules/storage/database";
import { accountLogin, sessionMerchant } from "../src/modules/auth/store";
import {
  saveConnection,
  connectionCredential,
  uninstallConnection,
} from "../src/modules/integrations/shopify/connections";
import {
  authenticatedShopTenant,
  localMerchantId,
} from "../src/modules/merchants/local-context";
import {
  readTenantSecret,
  writeTenantSecret,
} from "../src/modules/merchants/vault";
import { GET as products } from "../src/app/api/products/route";
import {
  getCheckoutCatalog,
  saveProduct,
} from "../src/modules/checkout/repository";
import {
  getShippingState,
  changeShipping,
} from "../src/modules/shipping/repository";
import { Database } from "../src/modules/storage/database";
import { priceCheckout } from "../src/modules/checkout/service";
import { createOrder, setOrderStatus } from "../src/modules/orders/repository";
import { GET as orders } from "../src/app/api/orders/route";

const dir = mkdtempSync(join(tmpdir(), "dz-multitenant-"));
let a: string, b: string, ta: string, tb: string;
let admin: Pool | undefined;
const schema = "tenant_" + randomBytes(12).toString("hex");
const request = (token: string, query = "") =>
  new Request("https://app.example.test/api/products" + query, {
    headers: { cookie: `dz_session=${token}` },
  });
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  if (process.env.POSTGRES_TEST_URL) {
    admin = new Pool({ connectionString: process.env.POSTGRES_TEST_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.POSTGRES_TEST_URL);
    url.searchParams.set("options", `-c search_path=${schema}`);
    vi.stubEnv("DATABASE_URL", url.toString());
  }
  vi.stubEnv("DZ_LOCAL_DEMO", "");
  for (const name of ["AUTH", "ORDERS", "SHIPPING", "CHECKOUT"])
    vi.stubEnv(name + "_DATABASE_PATH", join(dir, name + ".sqlite"));
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
  ta = await accountLogin(
    "tenant-a@example.test",
    "fixture-password-a",
    "Tenant A",
  );
  tb = await accountLogin(
    "tenant-b@example.test",
    "fixture-password-b",
    "Tenant B",
  );
  a = (await sessionMerchant(ta))!;
  b = (await sessionMerchant(tb))!;
  await saveConnection(
    a,
    "a.myshopify.com",
    "token-a",
    "read_products",
    undefined,
    "gid://shopify/Shop/101",
  );
  await saveConnection(
    b,
    "b.myshopify.com",
    "token-b",
    "read_products",
    undefined,
    "gid://shopify/Shop/202",
  );
});
afterAll(async () => {
  await closeStoragePool();
  if (admin) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

it("binds stable Shopify identifiers to real accounts and rejects browser-selected shops", async () => {
  expect((await authenticatedShopTenant(request(ta))).shopId).toBe(
    "gid://shopify/Shop/101",
  );
  expect((await authenticatedShopTenant(request(tb))).shopId).toBe(
    "gid://shopify/Shop/202",
  );
  await expect(
    authenticatedShopTenant(request(ta, `?store=${b}`)),
  ).rejects.toThrow();
  await expect(authenticatedShopTenant(request(""))).rejects.toThrow();
  await expect(
    saveConnection(
      b,
      "c.myshopify.com",
      "forged",
      "read_products",
      undefined,
      "gid://shopify/Shop/101",
    ),
  ).rejects.toThrow();
});
it("scopes catalog HTTP reads to the session even if another tenant URL is supplied", async () => {
  const catalog = await getCheckoutCatalog(a);
  await saveProduct(a, catalog.revision, {
    ...catalog.products[0],
    name: "PRIVATE-A-PRODUCT",
  });
  const response = await products(request(tb, `?store=${a}`));
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain("PRIVATE-A-PRODUCT");
  expect((await getCheckoutCatalog(a)).products[0].name).toBe(
    "PRIVATE-A-PRODUCT",
  );
});
it("keeps shipping mutations and provider credentials isolated", async () => {
  const state = await getShippingState(a, "legacy58");
  await changeShipping(a, "legacy58", state.revision, {
    entries: [
      {
        scope: "default",
        target: "*",
        rule: {
          available: true,
          home: { enabled: true, price: 777 },
          office: { enabled: false, price: null },
          eta: "",
        },
      },
    ],
  });
  expect((await getShippingState(b, "legacy58")).entries).toEqual([]);
  await writeTenantSecret(request(ta), "meta", "PRIVATE-A-AD-CREDENTIAL");
  await writeTenantSecret(request(tb), "meta", "PRIVATE-B-AD-CREDENTIAL");
  expect(await readTenantSecret(request(ta), "meta")).toBe(
    "PRIVATE-A-AD-CREDENTIAL",
  );
  expect(await readTenantSecret(request(tb), "meta")).toBe(
    "PRIVATE-B-AD-CREDENTIAL",
  );
  await expect(
    readTenantSecret(request(tb, `?store=${a}`), "meta"),
  ).rejects.toThrow();
  if (!admin)
    expect(
      readFileSync(join(dir, "AUTH.sqlite")).includes(
        Buffer.from("PRIVATE-A-AD-CREDENTIAL"),
      ),
    ).toBe(false);
  const db = await authDb();
  try {
    expect(
      JSON.stringify(
        await db.prepare("SELECT encrypted_value FROM tenant_secrets").all(),
      ),
    ).not.toContain("PRIVATE-A-AD-CREDENTIAL");
  } finally {
    await db.close();
  }
});
it("does not expose another tenant's customer data or CSV and refuses cross-tenant order updates", async () => {
  const input = {
    productId: "demo-bag",
    variantId: "olive",
    quantity: 1,
    mode: "legacy58" as const,
    wilayaCode: "28",
    communeId: "dz:commune:1006",
  };
  const quote = await priceCheckout(a, input);
  const order = await createOrder(
    a,
    {
      customer: {
        ...input,
        name: "PRIVATE-A-CUSTOMER",
        phone: "0551234567",
        method: "home",
        address: "Fixture address 12",
      },
      quoteToken: quote.quoteToken,
    },
    crypto.randomUUID(),
  );
  for (const query of [`?store=${a}`, `?store=${a}&format=csv`]) {
    const response = await orders(request(tb, query));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("PRIVATE-A-CUSTOMER");
  }
  await expect(
    setOrderStatus(b, order.order.id, "confirmed"),
  ).rejects.toThrow();
});

it.skipIf(!process.env.POSTGRES_TEST_URL)(
  "validates production identity and repeatable migration on actual PostgreSQL",
  async () => {
    const client = await admin!.connect();
    try {
      await client.query(`SET search_path TO ${schema}`);
      const migration = readFileSync(
        "scripts/migrations/002_verified_shop_tenants.sql",
        "utf8",
      );
      await client.query(migration);
      await client.query(migration);
    } finally {
      await client.query("RESET search_path");
      client.release();
    }
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(await localMerchantId(request(ta))).toBe(a);
      expect(await localMerchantId(request(tb))).toBe(b);
      await expect(
        localMerchantId(request(tb, `?store=${a}`), true),
      ).rejects.toThrow();
      await expect(localMerchantId(request(""))).rejects.toThrow();
    } finally {
      vi.stubEnv("NODE_ENV", "test");
    }
  },
);

it("disables only the uninstalled shop, leaving the other tenant and credentials intact", async () => {
  await uninstallConnection(
    "a.myshopify.com",
    "event-a",
    "fixture-hash",
    new Date(Date.now() + 1000).toISOString(),
  );
  await expect(authenticatedShopTenant(request(ta))).rejects.toThrow();
  expect((await authenticatedShopTenant(request(tb))).merchantId).toBe(b);
  expect((await connectionCredential(b)).accessToken).toBe("token-b");
});
it("fails closed without a production identity or PostgreSQL and ignores fallback merchant variables", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LOCAL_MERCHANT_ID", b);
  const previousUrl = process.env.DATABASE_URL ?? "";
  vi.stubEnv("DATABASE_URL", "");
  try {
    await expect(localMerchantId()).rejects.toThrow();
    await expect(localMerchantId(request(""), true)).rejects.toThrow();
    expect(() => new Database(join(dir, "must-not-create.sqlite"))).toThrow(
      "PostgreSQL",
    );
  } finally {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", previousUrl);
  }
});
