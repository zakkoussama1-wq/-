import { DatabaseSync } from "node:sqlite";
import { resolve, join } from "node:path";
import type { AdministrativeMode } from "../contracts";
import type { LocationOption } from "./schema";
import { normalizeSearch } from "./normalize.mjs";
function withDatabase<T>(read: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(
    process.env.GEOGRAPHY_DATABASE_PATH
      ? resolve(/* turbopackIgnore: true */ process.env.GEOGRAPHY_DATABASE_PATH)
      : join(process.cwd(), "data", "geography.sqlite"),
    { readOnly: true },
  );
  try {
    return read(db);
  } finally {
    db.close();
  }
}
export function listWilayas(
  mode: AdministrativeMode,
  query = "",
): LocationOption[] {
  return withDatabase((db) =>
    db
      .prepare(
        "SELECT code, name_ar, name_latin FROM wilayas WHERE CAST(code AS INTEGER)<=? AND search LIKE ? ORDER BY code",
      )
      .all(mode === "legacy58" ? 58 : 69, `%${normalizeSearch(query)}%`)
      .map((row) => ({
        id: `dz:wilaya:${row.code}`,
        code: String(row.code),
        nameAr: String(row.name_ar),
        nameLatin: String(row.name_latin),
      })),
  );
}
export function listCommunes(
  mode: AdministrativeMode,
  wilayaCode: string,
  query = "",
): LocationOption[] {
  if (
    !/^\d{2}$/.test(wilayaCode) ||
    Number(wilayaCode) < 1 ||
    Number(wilayaCode) > (mode === "legacy58" ? 58 : 69)
  )
    throw new RangeError("Invalid wilaya code for this administrative mode");
  // The column comes solely from a closed enum, never from user-controlled SQL.
  const column = mode === "legacy58" ? "legacy_code" : "updated_code";
  return withDatabase((db) =>
    db
      .prepare(
        `SELECT id,name_ar,name_latin FROM communes WHERE ${column}=? AND search LIKE ? ORDER BY name_ar,id`,
      )
      .all(wilayaCode, `%${normalizeSearch(query)}%`)
      .map((row) => ({
        id: String(row.id),
        nameAr: String(row.name_ar),
        nameLatin: String(row.name_latin),
      })),
  );
}
