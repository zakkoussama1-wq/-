import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getCheckoutCatalog,
  updateDiscount,
} from "../src/modules/checkout/repository";
import {
  priceCheckout,
  validateCheckout,
  CheckoutError,
} from "../src/modules/checkout/service";
import { checkoutPost, readCatalog } from "../src/modules/checkout/http";
import {
  changeShipping,
  getShippingState,
} from "../src/modules/shipping/repository";
import { ConflictError } from "../src/modules/shipping/repository";
const directory = mkdtempSync(join(tmpdir(), "dz-checkout-test-"));
const previous = {
  checkout: process.env.CHECKOUT_DATABASE_PATH,
  shipping: process.env.SHIPPING_DATABASE_PATH,
  merchant: process.env.LOCAL_MERCHANT_ID,
};
const input = {
  productId: "demo-bag",
  variantId: "olive",
  quantity: 2,
  mode: "legacy58" as const,
  wilayaCode: "28",
  communeId: "dz:commune:1006",
};
const customer = {
  ...input,
  name: "محمد أمين",
  phone: "+213551234567",
  method: "home" as const,
  address: "شارع الاستقلال رقم ١٢",
};
const rule = {
  available: true,
  home: { enabled: true, price: 600.5 },
  office: { enabled: true, price: 300 },
  eta: "يومان",
};
async function seed(merchant: string) {
  const s = await getShippingState(merchant, "legacy58");
  await changeShipping(merchant, "legacy58", s.revision, {
    entries: [{ scope: "default", target: "*", rule }],
    genericOffice: true,
  });
}
beforeAll(async () => {
  process.env.CHECKOUT_DATABASE_PATH = join(directory, "checkout.sqlite");
  process.env.SHIPPING_DATABASE_PATH = join(directory, "shipping.sqlite");
  process.env.LOCAL_MERCHANT_ID = "http-checkout";
  await seed("a");
  await seed("http-checkout");
});
afterAll(() => {
  for (const [name, value] of [
    ["CHECKOUT_DATABASE_PATH", previous.checkout],
    ["SHIPPING_DATABASE_PATH", previous.shipping],
    ["LOCAL_MERCHANT_ID", previous.merchant],
  ]) {
    if (value === undefined) delete process.env[name!];
    else process.env[name!] = value;
  }
  rmSync(directory, { recursive: true, force: true });
});
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("canonical checkout pricing", () => {
  it("reads persisted canonical demo product and both method prices", async () => {
    const q = await priceCheckout("a", input);
    expect(q).toMatchObject({
      subtotalMinor: 780000,
      discountMinor: 0,
      demo: true,
    });
    expect(q.methods.home).toMatchObject({
      amountMinor: 60050,
      totalMinor: 840050,
    });
    expect(q.methods.office).toMatchObject({
      amountMinor: 30000,
      totalMinor: 810000,
    });
    expect(q.quoteToken).toHaveLength(64);
  });
  it("updates quantity, variant and discount with exact DZD math", async () => {
    const c = await getCheckoutCatalog("a");
    await updateDiscount("a", c.revision, { type: "percent", value: 1000 });
    expect(await priceCheckout("a", input)).toMatchObject({
      subtotalMinor: 780000,
      discountMinor: 78000,
    });
    const q = await priceCheckout("a", {
      ...input,
      variantId: "black",
      quantity: 3,
    });
    expect(q).toMatchObject({ subtotalMinor: 1260000, discountMinor: 126000 });
    expect(q.methods.home.totalMinor).toBe(1194050);
    expect((await getCheckoutCatalog("a")).discount).toEqual({
      type: "percent",
      value: 1000,
    });
  });
  it("isolates product, discount and shipping state between merchants", async () => {
    expect((await getCheckoutCatalog("b")).discount.type).toBe("none");
    expect((await priceCheckout("b", input)).methods.home.available).toBe(
      false,
    );
    const db = new DatabaseSync(process.env.CHECKOUT_DATABASE_PATH!);
    const product = (await getCheckoutCatalog("b")).products[0];
    await db
      .prepare(
        "UPDATE checkout_products SET product_json=? WHERE merchant_id=? AND id=?",
      )
      .run(
        JSON.stringify({
          ...product,
          variants: product.variants.map((v) => ({ ...v, priceMinor: 10000 })),
        }),
        "b",
        product.id,
      );
    await db.close();
    expect((await priceCheckout("b", input)).subtotalMinor).toBe(20000);
    expect((await priceCheckout("b", input)).unitPriceMinor).toBe(10000);
    expect((await priceCheckout("a", input)).subtotalMinor).toBe(780000);
  });
  it("validates actual parents and rejects unknown variants and browser price injection", async () => {
    await expect(
      priceCheckout("a", { ...input, wilayaCode: "16" }),
    ).rejects.toThrow(RangeError);
    await expect(
      priceCheckout("a", { ...input, variantId: "other" }),
    ).rejects.toThrow(CheckoutError);
    await expect(
      priceCheckout("a", { ...input, totalMinor: 1 } as typeof input),
    ).rejects.toThrow();
    await expect(
      priceCheckout("a", { ...input, mode: "updated69" }),
    ).rejects.toThrow(RangeError);
  });
  it("uses commune overrides including free delivery and blocks disabled methods", async () => {
    let s = await getShippingState("a", "legacy58");
    s = await changeShipping("a", "legacy58", s.revision, {
      entries: [
        {
          scope: "commune",
          target: input.communeId,
          rule: {
            ...rule,
            home: { enabled: true, price: 0 },
            office: { enabled: false, price: null },
          },
        },
      ],
    });
    const q = await priceCheckout("a", input);
    expect(q.methods.home).toMatchObject({
      available: true,
      amountMinor: 0,
      source: "commune",
    });
    expect(q.methods.office.available).toBe(false);
    await expect(
      validateCheckout("a", {
        customer: { ...customer, method: "office", address: "" },
        quoteToken: q.quoteToken,
      }),
    ).rejects.toThrow(CheckoutError);
    await changeShipping("a", "legacy58", s.revision, {
      reset: [{ scope: "commune", target: input.communeId }],
    });
  });
  it("validates customer information without persisting an order or PII", async () => {
    const q = await priceCheckout("a", input);
    const result = await validateCheckout("a", {
      customer,
      quoteToken: q.quoteToken,
    });
    expect(result).toMatchObject({ validated: true, persisted: false });
    expect(result).not.toHaveProperty("orderId");
    expect(result).not.toHaveProperty("customer");
    const db = new DatabaseSync(process.env.CHECKOUT_DATABASE_PATH!);
    expect(
      (
        await db
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all()
      )
        .map((t) => t.name)
        .sort(),
    ).toEqual(["checkout_products", "checkout_settings"]);
    await db.close();
  });
  it("rejects outdated price tokens after settings changes and caps discounts", async () => {
    const before = await priceCheckout("a", input);
    const c = await getCheckoutCatalog("a");
    await updateDiscount("a", c.revision, { type: "fixed", value: 1000000000 });
    await expect(
      validateCheckout("a", { customer, quoteToken: before.quoteToken }),
    ).rejects.toThrow(/تغيرت الأسعار/);
    const q = await priceCheckout("a", input);
    expect(q.discountMinor).toBe(q.subtotalMinor);
    expect(q.methods.home.totalMinor).toBe(60050);
    await expect(
      updateDiscount("a", c.revision, { type: "none", value: 0 }),
    ).rejects.toThrow(ConflictError);
  });
  it("rejects confirmation after a price rule is disabled and generic office off", async () => {
    const q = await priceCheckout("a", input);
    const s = await getShippingState("a", "legacy58");
    await changeShipping("a", "legacy58", s.revision, {
      entries: [
        { scope: "wilaya", target: "28", rule: { ...rule, available: false } },
      ],
      genericOffice: false,
    });
    await expect(
      validateCheckout("a", { customer, quoteToken: q.quoteToken }),
    ).rejects.toThrow(/غير متاح/);
    expect((await priceCheckout("a", input)).methods.office.available).toBe(
      false,
    );
  });
});
describe("checkout HTTP errors and trust boundaries", () => {
  it("returns current prices and validates on the server", async () => {
    expect((await readCatalog()).status).toBe(200);
    const response = await checkoutPost(request(input), "quote");
    expect(response.status).toBe(200);
    const q = await response.json();
    const result = await checkoutPost(
      request({ customer, quoteToken: q.quoteToken }),
      "validate",
    );
    expect(result.status).toBe(200);
    expect((await result.json()).persisted).toBe(false);
  });
  it("rejects missing address, invalid phone, totals, tenant selection and imaginary offices", async () => {
    const q = await priceCheckout("http-checkout", input);
    for (const change of [
      { address: "" },
      { phone: "123" },
      { total: 1 },
      { merchantId: "other" },
      { officeId: "made-up" },
    ])
      expect(
        (
          await checkoutPost(
            request({
              customer: { ...customer, ...change },
              quoteToken: q.quoteToken,
            }),
            "validate",
          )
        ).status,
      ).toBe(400);
    expect(
      (await checkoutPost(request({ ...input, merchantId: "other" }), "quote"))
        .status,
    ).toBe(400);
  });
  it("returns price-change conflict and never silently accepts a stale total", async () => {
    const q = await priceCheckout("http-checkout", input);
    const s = await getShippingState("http-checkout", "legacy58");
    await changeShipping("http-checkout", "legacy58", s.revision, {
      entries: [
        {
          scope: "default",
          target: "*",
          rule: { ...rule, home: { enabled: true, price: 800 } },
        },
      ],
    });
    expect(
      (
        await checkoutPost(
          request({ customer, quoteToken: q.quoteToken }),
          "validate",
        )
      ).status,
    ).toBe(409);
  });
  it("guards same-origin writes and invalid discount percentages", async () => {
    expect(
      (await checkoutPost(request(input, "http://evil.invalid"), "quote"))
        .status,
    ).toBe(403);
    expect(
      (
        await checkoutPost(
          request({ revision: 0, discount: { type: "percent", value: 10001 } }),
          "discount",
        )
      ).status,
    ).toBe(400);
  });
  it("returns 503 on inaccessible product storage without substituting browser prices", async () => {
    const saved = process.env.CHECKOUT_DATABASE_PATH;
    process.env.CHECKOUT_DATABASE_PATH = directory;
    try {
      expect((await readCatalog()).status).toBe(503);
      expect((await checkoutPost(request(input), "quote")).status).toBe(503);
    } finally {
      process.env.CHECKOUT_DATABASE_PATH = saved;
    }
  });
});
