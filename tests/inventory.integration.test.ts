import { beforeAll, afterAll, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  getCheckoutCatalog,
  saveProduct,
} from "../src/modules/checkout/repository";
import {
  changeShipping,
  getShippingState,
} from "../src/modules/shipping/repository";
import { priceCheckout } from "../src/modules/checkout/service";
import {
  createOrder,
  listOrders,
  setOrderStatus,
} from "../src/modules/orders/repository";
const dir = mkdtempSync(join(tmpdir(), "dz-inventory-"));
process.env.CHECKOUT_DATABASE_PATH = join(dir, "catalog.sqlite");
process.env.SHIPPING_DATABASE_PATH = join(dir, "shipping.sqlite");
process.env.ORDERS_DATABASE_PATH = join(dir, "orders.sqlite");
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const merchant = "inventory";
const input = {
  productId: "demo-bag",
  variantId: "olive",
  quantity: 1,
  mode: "legacy58" as const,
  wilayaCode: "28",
  communeId: "dz:commune:1006",
};
let winner: string;
const customer = {
  ...input,
  name: "عميل اختبار",
  phone: "0552222222",
  method: "home",
  address: "شارع الاختبار رقم ١٢",
};
beforeAll(async () => {
  const c = await getCheckoutCatalog(merchant);
  await saveProduct(merchant, c.revision, {
    ...c.products[0],
    variants: c.products[0].variants.map((v) => ({ ...v, stock: 1 })),
  });
  const s = await getShippingState(merchant, "legacy58");
  await changeShipping(merchant, "legacy58", s.revision, {
    entries: [
      {
        scope: "default",
        target: "*",
        rule: {
          available: true,
          home: { enabled: true, price: 0 },
          office: { enabled: false, price: null },
          eta: "",
        },
      },
    ],
  });
});
it("cannot oversell the last item under concurrent independent submissions", async () => {
  const q = await priceCheckout(merchant, input);
  const results = await Promise.allSettled([
    createOrder(merchant, { customer, quoteToken: q.quoteToken }, randomUUID()),
    createOrder(merchant, { customer, quoteToken: q.quoteToken }, randomUUID()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  const result = results.find((r) => r.status === "fulfilled")!;
  if (result.status !== "fulfilled") throw new Error("Missing order");
  winner = result.value.order.id;
  expect(await listOrders(merchant)).toHaveLength(1);
  expect(
    (await getCheckoutCatalog(merchant)).products[0].variants[0].stock,
  ).toBe(0);
});
it("cancellation returns a reservation once and cannot reactivate a cancelled order", async () => {
  await setOrderStatus(merchant, winner, "cancelled");
  await setOrderStatus(merchant, winner, "cancelled");
  expect(
    (await getCheckoutCatalog(merchant)).products[0].variants[0].stock,
  ).toBe(1);
  await expect(setOrderStatus(merchant, winner, "confirmed")).rejects.toThrow();
});
it("rolls back stock if the order insert fails after the reservation", async () => {
  const q = await priceCheckout(merchant, input);
  const db = new DatabaseSync(process.env.ORDERS_DATABASE_PATH!);
  db.exec(
    "CREATE TRIGGER reject_order BEFORE INSERT ON orders BEGIN SELECT RAISE(ABORT,'fixture rejection'); END;",
  );
  db.close();
  await expect(
    createOrder(merchant, { customer, quoteToken: q.quoteToken }, randomUUID()),
  ).rejects.toThrow();
  expect(
    (await getCheckoutCatalog(merchant)).products[0].variants[0].stock,
  ).toBe(1);
  expect(await listOrders(merchant)).toHaveLength(1);
  const cleanup = new DatabaseSync(process.env.ORDERS_DATABASE_PATH!);
  cleanup.exec("DROP TRIGGER reject_order");
  cleanup.close();
});
