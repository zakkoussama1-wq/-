import { describe, it, expect } from "vitest";
import { amounts, toMinor } from "../src/modules/checkout/money";
import {
  checkoutInputSchema,
  pricingInputSchema,
  discountSchema,
  normalizePhone,
} from "../src/modules/checkout/schema";
const valid = {
  productId: "demo-bag",
  variantId: "olive",
  quantity: 1,
  mode: "legacy58",
  wilayaCode: "28",
  communeId: "dz:commune:1006",
  name: "محمد أمين",
  phone: "0551234567",
  method: "home",
  address: "شارع الاستقلال رقم ١٢",
};
describe("complete COD validation", () => {
  it.each([
    "0551234567",
    "+213551234567",
    "00213551234567",
    "05 51-23-45-67",
    "٠٥٥١٢٣٤٥٦٧",
    "۰۵۵۱۲۳۴۵۶۷",
  ])("normalizes valid Algerian mobile %s", (phone) => {
    expect(checkoutInputSchema.parse({ ...valid, phone }).phone).toBe(
      "0551234567",
    );
  });
  it.each(["0451234567", "+33123456789", "05512345678", "<script>", ""])(
    "rejects invalid Algerian phone %s",
    (phone) =>
      expect(checkoutInputSchema.safeParse({ ...valid, phone }).success).toBe(
        false,
      ),
  );
  it.each([
    { name: " " },
    { name: "<script>alert(1)</script>" },
    { phone: "\u0000" },
    { address: "قصير" },
    { address: "123456789" },
    { address: "<img src=x>" },
    { quantity: 0 },
    { quantity: 11 },
    { quantity: 1.1 },
    { communeId: "" },
    { wilayaCode: "" },
  ])("rejects invalid required data %o", (change) =>
    expect(checkoutInputSchema.safeParse({ ...valid, ...change }).success).toBe(
      false,
    ),
  );
  it("requires a home address only for home delivery", () => {
    expect(
      checkoutInputSchema.safeParse({ ...valid, address: "" }).success,
    ).toBe(false);
    expect(
      checkoutInputSchema.safeParse({ ...valid, method: "office", address: "" })
        .success,
    ).toBe(true);
  });
  it("rejects client-selected totals, discounts, merchants and imaginary offices", () => {
    for (const change of [
      { total: 1 },
      { discount: 100 },
      { merchantId: "other" },
      { officeId: "fake" },
    ])
      expect(
        checkoutInputSchema.safeParse({ ...valid, ...change }).success,
      ).toBe(false);
    expect(pricingInputSchema.safeParse({ ...valid }).success).toBe(false);
  });
  it("normalizes whitespace and never accepts local prefixes from other countries", () => {
    expect(
      checkoutInputSchema.parse({ ...valid, name: " محمد   أمين " }).name,
    ).toBe("محمد أمين");
    expect(normalizePhone("00213551234567")).toBe("0551234567");
  });
});
describe("integer centime totals", () => {
  it("computes fixed and percent discounts without applying them to shipping", () => {
    expect(amounts(390000, 2, { type: "fixed", value: 50000 })).toEqual({
      subtotalMinor: 780000,
      discountMinor: 50000,
      netMinor: 730000,
    });
    expect(amounts(390000, 2, { type: "percent", value: 1250 })).toEqual({
      subtotalMinor: 780000,
      discountMinor: 97500,
      netMinor: 682500,
    });
  });
  it("caps fixed discounts at subtotal and handles percent rounding deterministically", () => {
    expect(amounts(100, 1, { type: "fixed", value: 500 })).toMatchObject({
      netMinor: 0,
      discountMinor: 100,
    });
    expect(
      amounts(101, 1, { type: "percent", value: 5000 }).discountMinor,
    ).toBe(51);
    expect(amounts(10, 1, { type: "none", value: 0 }).discountMinor).toBe(0);
  });
  it("rejects invalid discount settings", () => {
    for (const d of [
      { type: "none", value: 1 },
      { type: "fixed", value: -1 },
      { type: "percent", value: 10001 },
      { type: "percent", value: 0.1 },
    ])
      expect(discountSchema.safeParse(d).success).toBe(false);
  });
  it("converts shipping fractions into exact integer centimes", () => {
    expect(toMinor(320.5)).toBe(32050);
    expect(toMinor(0)).toBe(0);
    expect(() => toMinor(0.001)).toThrow();
    expect(() => amounts(1.5, 1, { type: "none", value: 0 })).toThrow();
  });
});
