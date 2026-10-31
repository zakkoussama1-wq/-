import { it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  createOrder,
  listOrders,
  setOrderStatus,
  exportOrders,
} from "../src/modules/orders/repository";
import {
  getShippingState,
  changeShipping,
} from "../src/modules/shipping/repository";
import { priceCheckout } from "../src/modules/checkout/service";
import { authenticate, validSession, logout } from "../src/modules/auth/store";
const dir = mkdtempSync(join(tmpdir(), "dz-order-tests-"));
process.env.ORDERS_DATABASE_PATH = join(dir, "orders.sqlite");
process.env.SHIPPING_DATABASE_PATH = join(dir, "shipping.sqlite");
process.env.CHECKOUT_DATABASE_PATH = join(dir, "checkout.sqlite");
process.env.AUTH_DATABASE_PATH = join(dir, "auth.sqlite");
afterAll(() => rmSync(dir, { recursive: true, force: true }));
it("persists orders, deduplicates retries, scopes merchants and updates status", async () => {
  const s = await getShippingState("a", "legacy58");
  await changeShipping("a", "legacy58", s.revision, {
    entries: [
      {
        scope: "default",
        target: "*",
        rule: {
          available: true,
          home: { enabled: true, price: 500 },
          office: { enabled: false, price: null },
          eta: "",
        },
      },
    ],
  });
  const input = {
    productId: "demo-bag",
    variantId: "olive",
    quantity: 1,
    mode: "legacy58" as const,
    wilayaCode: "28",
    communeId: "dz:commune:1006",
  };
  const q = await priceCheckout("a", input);
  const data = {
    customer: {
      ...input,
      name: "عميل تجريبي",
      phone: "0551234567",
      method: "home",
      address: "شارع الاستقلال ١٢",
    },
    quoteToken: q.quoteToken,
  };
  const key = randomUUID();
  const first = await createOrder("a", data, key);
  expect(first.duplicate).toBe(false);
  expect((await createOrder("a", data, key)).order.id).toBe(first.order.id);
  expect(await listOrders("a")).toHaveLength(1);
  expect(await listOrders("b")).toEqual([]);
  await expect(
    setOrderStatus("b", first.order.id, "confirmed"),
  ).rejects.toThrow();
  await setOrderStatus("a", first.order.id, "fulfilled");
  expect((await listOrders("a"))[0].status).toBe("fulfilled");
  expect(exportOrders(await listOrders("a"))).toContain("عميل تجريبي");
  await expect(
    createOrder(
      "a",
      { ...data, customer: { ...data.customer, quantity: 2 } },
      key,
    ),
  ).rejects.toThrow();
});
it("stores salted password hashes and revocable expiring opaque sessions", async () => {
  const token = await authenticate("local-test-password-123", true);
  expect(await validSession(token)).toBe(true);
  await expect(authenticate("wrong-password-123")).rejects.toThrow();
  await expect(authenticate("another-password-123", true)).rejects.toThrow();
  await logout(token);
  expect(await validSession(token)).toBe(false);
  expect(
    await validSession(await authenticate("local-test-password-123")),
  ).toBe(true);
});
