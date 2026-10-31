import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { listCommunes, listWilayas } from "../src/modules/geography/repository";
import { geographyResponse } from "../src/modules/geography/http";
const directory = mkdtempSync(join(tmpdir(), "dz-geography-test-"));
const database = join(directory, "geo.sqlite");
const previous = process.env.GEOGRAPHY_DATABASE_PATH;
beforeAll(() => {
  process.env.GEOGRAPHY_DATABASE_PATH = database;
  execFileSync(process.execPath, ["scripts/seed-geography.mjs"], {
    cwd: resolve("."),
    env: { ...process.env, GEOGRAPHY_DATABASE_PATH: database },
  });
});
afterAll(() => {
  if (previous === undefined) delete process.env.GEOGRAPHY_DATABASE_PATH;
  else process.env.GEOGRAPHY_DATABASE_PATH = previous;
  rmSync(directory, { recursive: true, force: true });
});
describe("persistent SQLite geography", () => {
  it("queries both complete administrative systems from disk", () => {
    expect(listWilayas("legacy58")).toHaveLength(58);
    expect(listWilayas("updated69")).toHaveLength(69);
    for (const mode of ["legacy58", "updated69"] as const) {
      let total = 0;
      for (const w of listWilayas(mode))
        total += listCommunes(mode, w.code!).length;
      expect(total).toBe(1541);
    }
  });
  it("filters Arabic, Latin, punctuation and diacritics while enforcing parent relationships", () => {
    expect(listWilayas("legacy58", "M’Sila")[0].code).toBe("28");
    expect(listWilayas("legacy58", "المَسِيلَة")[0].code).toBe("28");
    expect(listCommunes("legacy58", "28", "Bou Saada")[0].id).toBe(
      "dz:commune:1006",
    );
    expect(listCommunes("legacy58", "28", "عين الملح")[0].id).toBe(
      "dz:commune:996",
    );
    expect(listCommunes("updated69", "28", "Bou Saada")).toEqual([]);
    expect(listCommunes("updated69", "68", "Bou Saada")).toHaveLength(1);
    expect(listCommunes("legacy58", "16", "Bou Saada")).toEqual([]);
    expect(listWilayas("legacy58", "zzzz")).toEqual([]);
  });
  it("rejects invalid wilaya mode pairs and SQL-shaped code input", () => {
    expect(() => listCommunes("legacy58", "68")).toThrow(RangeError);
    expect(() => listCommunes("updated69", "99")).toThrow(RangeError);
    expect(() => listCommunes("legacy58", "28 OR 1=1")).toThrow(RangeError);
  });
  it("persists records and foreign-key constraints across connections", () => {
    const db = new DatabaseSync(database);
    db.exec("PRAGMA foreign_keys=ON");
    expect(
      db.prepare("SELECT COUNT(*) AS total FROM communes").get()?.total,
    ).toBe(1541);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(() =>
      db
        .prepare("UPDATE communes SET legacy_code='99' WHERE source_id=1006")
        .run(),
    ).toThrow();
    db.close();
  });
  it("seeding is repeatable without duplicates", () => {
    execFileSync(process.execPath, ["scripts/seed-geography.mjs"], {
      env: { ...process.env, GEOGRAPHY_DATABASE_PATH: database },
    });
    expect(listCommunes("legacy58", "28")).toHaveLength(47);
    expect(listCommunes("updated69", "68")).toHaveLength(23);
  });
  it("serves validated data and returns 400 for invalid requests", async () => {
    const ok = geographyResponse(
      new Request("http://localhost/api/geography/wilayas"),
      "wilayas",
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).items).toHaveLength(58);
    for (const query of [
      "mode=unknown&wilayaCode=28",
      "wilayaCode=68",
      "wilayaCode=99",
      "wilayaCode=xx",
    ]) {
      expect(
        geographyResponse(
          new Request(`http://localhost/api/geography/communes?${query}`),
          "communes",
        ).status,
      ).toBe(400);
    }
  });
  it("fails with a useful 503 response instead of substituting sample data when the database is missing", async () => {
    process.env.GEOGRAPHY_DATABASE_PATH = join(directory, "missing.sqlite");
    try {
      const response = geographyResponse(
        new Request("http://localhost/api/geography/wilayas"),
        "wilayas",
      );
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("تعذر تحميل");
    } finally {
      process.env.GEOGRAPHY_DATABASE_PATH = database;
    }
  });
});
