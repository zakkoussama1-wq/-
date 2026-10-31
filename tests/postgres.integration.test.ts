import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import {
  accountLogin,
  sessionMerchant,
  validSession,
  logout,
} from "../src/modules/auth/store";
import {
  getCheckoutCatalog,
  saveProduct,
  updateDiscount,
} from "../src/modules/checkout/repository";
import {
  getShippingState,
  changeShipping,
} from "../src/modules/shipping/repository";
import { priceCheckout } from "../src/modules/checkout/service";
import {
  createOrder,
  listOrders,
  setOrderStatus,
} from "../src/modules/orders/repository";
import { closeStoragePool } from "../src/modules/storage/database";
const enabled = !!process.env.POSTGRES_TEST_URL;
const schema = "dz_test_" + randomUUID().replaceAll("-", "");
let admin: Pool;
let a: string, b: string;
describe.skipIf(!enabled)("real PostgreSQL backend", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.POSTGRES_TEST_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.POSTGRES_TEST_URL!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    a = (await sessionMerchant(
      await accountLogin(
        "pg-a@example.test",
        "postgres-test-password-a",
        "متجر أول",
      ),
    ))!;
    b = (await sessionMerchant(
      await accountLogin(
        "pg-b@example.test",
        "postgres-test-password-b",
        "متجر ثان",
      ),
    ))!;
  });
  afterAll(async () => {
    await closeStoragePool();
    if (admin) {
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  });
  it("persists tenant-scoped catalog, shipping and discount in PostgreSQL", async () => {
    expect((await getCheckoutCatalog(a)).products).toHaveLength(1);
    const s = await getShippingState(a, "legacy58");
    await changeShipping(a, "legacy58", s.revision, {
      entries: [
        {
          scope: "default",
          target: "*",
          rule: {
            available: true,
            home: { enabled: true, price: 500.5 },
            office: { enabled: false, price: null },
            eta: "يومان",
          },
        },
      ],
    });
    expect((await getShippingState(b, "legacy58")).entries).toEqual([]);
    const c = await getCheckoutCatalog(a);
    await updateDiscount(a, c.revision, { type: "fixed", value: 25000 });
    expect((await getCheckoutCatalog(b)).discount.type).toBe("none");
  });
  it("creates exactly one order for concurrent retries, isolates merchants and preserves status", async () => {
    const input = {
      productId: "demo-bag",
      variantId: "olive",
      quantity: 2,
      mode: "legacy58" as const,
      wilayaCode: "28",
      communeId: "dz:commune:1006",
    };
    const quote = await priceCheckout(a, input);
    expect(quote.methods.home.totalMinor).toBe(805050);
    const body = {
      customer: {
        ...input,
        name: "عميل تجريبي",
        phone: "0551234567",
        method: "home",
        address: "شارع الاستقلال رقم ١٢",
      },
      quoteToken: quote.quoteToken,
    };
    const key = randomUUID();
    const results = await Promise.all([
      createOrder(a, body, key),
      createOrder(a, body, key),
    ]);
    expect(results[0].order.id).toBe(results[1].order.id);
    expect(results.filter((r) => r.duplicate)).toHaveLength(1);
    expect(await listOrders(a)).toHaveLength(1);
    expect(await listOrders(b)).toEqual([]);
    await expect(
      setOrderStatus(b, results[0].order.id, "confirmed"),
    ).rejects.toThrow();
    await setOrderStatus(a, results[0].order.id, "fulfilled");
    expect((await listOrders(a))[0].status).toBe("fulfilled");
  });
  it("persists and revokes session credentials in PostgreSQL", async () => {
    const token = await accountLogin(
      "pg-a@example.test",
      "postgres-test-password-a",
    );
    expect(await validSession(token)).toBe(true);
    expect(await sessionMerchant(token)).toBe(a);
    await logout(token);
    expect(await validSession(token)).toBe(false);
  });
  it("reserves PostgreSQL stock and cancels atomically without overselling", async () => {
    const c = await getCheckoutCatalog(a);
    await saveProduct(a, c.revision, {
      ...c.products[0],
      variants: c.products[0].variants.map((v) => ({ ...v, stock: 1 })),
    });
    const input = {
      productId: "demo-bag",
      variantId: "olive",
      quantity: 1,
      mode: "legacy58" as const,
      wilayaCode: "28",
      communeId: "dz:commune:1006",
    };
    const quote = await priceCheckout(a, input);
    const body = {
      customer: {
        ...input,
        name: "عميل اختبار",
        phone: "0552222222",
        method: "home",
        address: "شارع الاختبار ١٢",
      },
      quoteToken: quote.quoteToken,
    };
    const results = await Promise.allSettled([
      createOrder(a, body, randomUUID()),
      createOrder(a, body, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getCheckoutCatalog(a)).products[0].variants[0].stock).toBe(0);
    const result = results.find((r) => r.status === "fulfilled")!;
    if (result.status !== "fulfilled") throw new Error("Missing order");
    await setOrderStatus(a, result.value.order.id, "cancelled");
    await setOrderStatus(a, result.value.order.id, "cancelled");
    expect((await getCheckoutCatalog(a)).products[0].variants[0].stock).toBe(1);
  });
});
