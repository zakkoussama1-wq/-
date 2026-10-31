import { describe, expect, it } from "vitest";
import { demoSubtotal, previewSchema } from "../src/modules/demo";
import { formatDzd } from "../src/lib/i18n";
describe("preview validation", () => {
  it.each(["0551234567", "0661234567", "0771234567"])(
    "accepts Algerian mobile %s",
    (phone) => {
      expect(
        previewSchema.safeParse({ name: "محمد أمين", phone, quantity: 1 })
          .success,
      ).toBe(true);
    },
  );
  it.each(["123", "0451234567", "05512345678", "<script>", ""])(
    "rejects invalid phone %s",
    (phone) => {
      expect(
        previewSchema.safeParse({ name: "محمد أمين", phone, quantity: 1 })
          .success,
      ).toBe(false);
    },
  );
  it("rejects empty names and invalid quantity", () => {
    expect(
      previewSchema.safeParse({ name: " ", phone: "0551234567", quantity: 0 })
        .success,
    ).toBe(false);
  });
  it("calculates demo product subtotal and bounds quantities", () => {
    expect(demoSubtotal(3)).toBe(11700);
    for (const q of [0, 11, 1.5, NaN]) expect(() => demoSubtotal(q)).toThrow();
  });
  it("formats dinars", () => {
    expect(formatDzd(3900)).toMatch(/3.*900/);
    expect(formatDzd(3900)).toContain("د.ج");
    expect(formatDzd(320.5)).toMatch(/320.*5/);
  });
});
