import { describe, expect, it } from "vitest";
import catalog from "../data/geography/catalog.json";
import audit from "../data/geography/audit.json";
import transfers from "../data/geography/transfers-2026.json";
import { normalizeSearch } from "../src/modules/geography/normalize.mjs";
import {
  geographySelectionReducer,
  initialGeographySelection,
} from "../src/modules/geography/selection";
import { communeParamsSchema } from "../src/modules/geography/schema";
describe("reviewed geographic catalog", () => {
  it("has 58 legacy / 69 updated wilayas and exactly the same 1541 communes", () => {
    expect(catalog.defaultMode).toBe("legacy58");
    expect(catalog.wilayas).toHaveLength(69);
    expect(catalog.wilayas.filter((w) => Number(w.code) <= 58)).toHaveLength(
      58,
    );
    expect(catalog.communes).toHaveLength(1541);
    expect(new Set(catalog.communes.map((c) => c.legacyWilayaCode)).size).toBe(
      58,
    );
    expect(new Set(catalog.communes.map((c) => c.updatedWilayaCode)).size).toBe(
      69,
    );
  });
  it("has no duplicate stable identifiers, empty names or orphan communes", () => {
    expect(new Set(catalog.communes.map((c) => c.id)).size).toBe(1541);
    expect(new Set(catalog.communes.map((c) => c.sourceId)).size).toBe(1541);
    expect(new Set(catalog.wilayas.map((w) => w.id)).size).toBe(69);
    const codes = new Set(catalog.wilayas.map((w) => w.code));
    for (const c of catalog.communes) {
      expect(codes.has(c.legacyWilayaCode)).toBe(true);
      expect(codes.has(c.updatedWilayaCode)).toBe(true);
      expect(c.nameAr.trim()).not.toBe("");
      expect(c.nameLatin.trim()).not.toBe("");
    }
  });
  it("retains all source stable IDs across the mode mapping and applies all reviewed transfers", () => {
    const map = new Map(transfers.map((t) => [t.sourceId, t]));
    expect(map.size).toBe(108);
    for (const c of catalog.communes) {
      const t = map.get(c.sourceId);
      if (t) {
        expect(c.legacyWilayaCode).toBe(t.from);
        expect(c.updatedWilayaCode).toBe(t.to);
      } else expect(c.legacyWilayaCode).toBe(c.updatedWilayaCode);
    }
    expect(audit.candidateDisagreements).toHaveLength(38);
    expect(audit.primaryVerification).toBe("pending-network-access");
  });
  it.each([
    ["59", 12],
    ["60", 8],
    ["61", 5],
    ["62", 4],
    ["63", 4],
    ["64", 6],
    ["65", 10],
    ["66", 8],
    ["67", 21],
    ["68", 23],
    ["69", 7],
  ])("matches transcribed legal commune count for wilaya %s", (code, count) => {
    expect(
      catalog.communes.filter((c) => c.updatedWilayaCode === code),
    ).toHaveLength(count);
  });
  it("maps Bou Saada and Ain El Melh from M'Sila to Bou Saada, and keeps Tabelbala in Beni Abbes", () => {
    for (const id of [1006, 996]) {
      const c = catalog.communes.find((c) => c.sourceId === id)!;
      expect(c.legacyWilayaCode).toBe("28");
      expect(c.updatedWilayaCode).toBe("68");
    }
    expect(catalog.communes.find((c) => c.sourceId === 996)?.nameAr).toBe(
      "عين الملح",
    );
    expect(catalog.communes.find((c) => c.sourceId === 1006)?.nameAr).toBe(
      "بوسعادة",
    );
    const t = catalog.communes.find((c) => c.nameLatin === "Tabelbala")!;
    expect(t.legacyWilayaCode).toBe("52");
    expect(t.updatedWilayaCode).toBe("52");
  });
});
describe("normalization and selection boundaries", () => {
  it.each([
    ["أَدرَار", "ادرار"],
    ["M’Sila", "msila"],
    ["M'Sila", "msila"],
    ["Aïn El Melh", "ainelmelh"],
    ["إِلـى", "الي"],
  ])("folds %s without modifying display data", (value, expected) =>
    expect(normalizeSearch(value)).toBe(expected),
  );
  it("clears dependent selections immediately on mode or wilaya change", () => {
    const selected = {
      mode: "legacy58" as const,
      wilayaCode: "28",
      communeId: "dz:commune:1006",
    };
    expect(
      geographySelectionReducer(selected, { type: "wilaya", value: "16" }),
    ).toEqual({ ...selected, wilayaCode: "16", communeId: "" });
    expect(
      geographySelectionReducer(selected, { type: "mode", value: "updated69" }),
    ).toEqual({ ...initialGeographySelection, mode: "updated69" });
    expect(
      geographySelectionReducer(selected, { type: "wilaya", value: "28" }),
    ).toEqual(selected);
  });
  it("rejects malformed requests", () => {
    for (const params of [
      { mode: "unknown", wilayaCode: "28" },
      { wilayaCode: "28' OR 1=1" },
      { wilayaCode: "28", q: "a".repeat(101) },
    ])
      expect(communeParamsSchema.safeParse(params).success).toBe(false);
  });
});
