import { describe, it, expect } from "vitest";
import { calculateShipping } from "../src/modules/shipping/calculator";
import {
  exportShippingCsv,
  importShippingCsv,
  csvHeaders,
} from "../src/modules/shipping/csv";
import {
  ruleSchema,
  mutationSchema,
  type ShippingRule,
  type ShippingState,
  type RuleEntry,
} from "../src/modules/shipping/schema";
const rule = (price: number): ShippingRule => ({
  available: true,
  home: { enabled: true, price },
  office: { enabled: true, price: price + 50 },
  eta: "يومان",
});
const state = (entries: RuleEntry[], genericOffice = true): ShippingState => ({
  mode: "legacy58",
  revision: 0,
  entries,
  genericOffice,
});
describe("authoritative shipping precedence", () => {
  const all: RuleEntry[] = [
    { scope: "default", target: "*", rule: rule(800) },
    { scope: "wilaya", target: "28", rule: rule(600) },
    { scope: "commune", target: "dz:commune:1006", rule: rule(400) },
  ];
  it("uses commune over wilaya over default", () => {
    expect(
      calculateShipping(state(all), "28", "dz:commune:1006", "home"),
    ).toMatchObject({ amount: 400, source: "commune" });
    expect(
      calculateShipping(state(all), "28", "dz:commune:996", "home"),
    ).toMatchObject({ amount: 600, source: "wilaya" });
    expect(
      calculateShipping(state(all), "16", "dz:commune:1", "home"),
    ).toMatchObject({ amount: 800, source: "default" });
  });
  it("has no invented rate when unconfigured", () =>
    expect(
      calculateShipping(state([]), "28", "dz:commune:1006", "home"),
    ).toMatchObject({ available: false, amount: null, source: "unavailable" }));
  it("treats zero as configured free shipping", () =>
    expect(
      calculateShipping(
        state([{ scope: "default", target: "*", rule: rule(0) }]),
        "28",
        "dz:commune:1006",
        "home",
      ),
    ).toMatchObject({ available: true, amount: 0 }));
  it.each(["available", "home"])(
    "explicit disabled %s at commune blocks fallback",
    (key) => {
      const blocked = {
        ...rule(400),
        ...(key === "available"
          ? { available: false }
          : { home: { enabled: false, price: null } }),
      };
      expect(
        calculateShipping(
          state([...all.slice(0, 2), { ...all[2], rule: blocked }]),
          "28",
          "dz:commune:1006",
          "home",
        ).available,
      ).toBe(false);
    },
  );
  it("requires generic office opt-in as well as an office rate", () => {
    expect(
      calculateShipping(state(all, false), "28", "dz:commune:1006", "office")
        .available,
    ).toBe(false);
    expect(
      calculateShipping(state(all), "28", "dz:commune:1006", "office").amount,
    ).toBe(450);
  });
  it("does not fall back for a missing enabled price", () =>
    expect(
      calculateShipping(
        state([
          {
            ...all[1],
            rule: { ...rule(0), home: { enabled: true, price: null } },
          },
          all[0],
        ]),
        "28",
        "dz:commune:1006",
        "home",
      ).available,
    ).toBe(false));
});
describe("money and CSV validation", () => {
  it.each([-1, Infinity, NaN, 0.001, 10000001])(
    "rejects invalid DZD amount %s",
    (price) => expect(ruleSchema.safeParse(rule(price)).success).toBe(false),
  );
  it("accepts nonnegative prices with up to 2 decimals", () =>
    expect(ruleSchema.safeParse(rule(123.45)).success).toBe(true));
  it("requires a price for enabled methods", () =>
    expect(
      ruleSchema.safeParse({ ...rule(2), home: { enabled: true, price: null } })
        .success,
    ).toBe(false));
  it("roundtrips Arabic, quotes, commas, newlines, zero, null and spreadsheet text safely", () => {
    for (const eta of [
      "يوم، يومان",
      'مرحبا, "تجربة"\nثانية',
      "=1+1",
      "'=1+1",
      "@text",
    ]) {
      const rows: RuleEntry[] = [
        {
          scope: "default",
          target: "*",
          rule: { ...rule(0), eta, office: { enabled: false, price: null } },
        },
      ];
      const csv = exportShippingCsv(rows);
      expect(importShippingCsv(csv)).toEqual(rows);
      if (eta.startsWith("=")) expect(csv).toContain("'=1+1");
    }
  });
  it("rejects invalid CSV rather than accepting partial rows", () => {
    const good = exportShippingCsv([
      { scope: "wilaya", target: "28", rule: rule(300) },
    ]);
    for (const bad of [
      good + "ولاية,16,1,1,-1,0,,\r\n",
      good + good.split("\r\n")[1] + "\r\n",
      csvHeaders.join(",") + '\n"not closed',
      "bad headers\n1,2",
    ]) {
      expect(() => importShippingCsv(bad)).toThrow();
    }
  });
  it("refuses client-selected merchant IDs and unknown quote totals", () =>
    expect(
      mutationSchema.safeParse({
        action: "settings",
        mode: "legacy58",
        revision: 0,
        genericOffice: true,
        merchantId: "other",
      }).success,
    ).toBe(false));
});
