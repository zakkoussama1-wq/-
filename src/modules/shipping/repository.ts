import { Database as DatabaseSync } from "../storage/database";
import { mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import catalog from "../../../data/geography/catalog.json";
import {
  entrySchema,
  type RuleEntry,
  type RuleTarget,
  type ShippingState,
} from "./schema";
import type { AdministrativeMode } from "../contracts";
export class ConflictError extends Error {}
export function validateTarget(mode: AdministrativeMode, target: RuleTarget) {
  if (target.scope === "default" && target.target === "*") return;
  if (
    target.scope === "wilaya" &&
    catalog.wilayas.some(
      (w) =>
        w.code === target.target &&
        Number(w.code) <= (mode === "legacy58" ? 58 : 69),
    )
  )
    return;
  if (
    target.scope === "commune" &&
    catalog.communes.some((c) => c.id === target.target)
  )
    return;
  throw new RangeError("معرف منطقة الشحن غير صالح للنظام المحدد.");
}
export function shippingDatabasePath() {
  return process.env.SHIPPING_DATABASE_PATH
    ? resolve(/* turbopackIgnore: true */ process.env.SHIPPING_DATABASE_PATH)
    : join(process.cwd(), "data", "shipping.sqlite");
}
async function database() {
  const path = shippingDatabasePath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  await db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS shipping_settings(merchant_id TEXT NOT NULL,mode TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,generic_office INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(merchant_id,mode));
 CREATE TABLE IF NOT EXISTS shipping_rules(merchant_id TEXT NOT NULL,mode TEXT NOT NULL,scope TEXT NOT NULL,target TEXT NOT NULL,rule_json TEXT NOT NULL,PRIMARY KEY(merchant_id,mode,scope,target),FOREIGN KEY(merchant_id,mode) REFERENCES shipping_settings(merchant_id,mode));`);
  return db;
}
export async function readShippingSnapshot(
  db: DatabaseSync,
  merchant: string,
  mode: AdministrativeMode,
  prefix = "",
): Promise<ShippingState> {
  const settings = await db
    .prepare(
      `SELECT revision,generic_office FROM ${prefix}shipping_settings WHERE merchant_id=? AND mode=?`,
    )
    .get(merchant, mode);
  const entries = (
    await db
      .prepare(
        `SELECT scope,target,rule_json FROM ${prefix}shipping_rules WHERE merchant_id=? AND mode=? ORDER BY scope,target`,
      )
      .all(merchant, mode)
  ).map((row) =>
    entrySchema.parse({
      scope: row.scope,
      target: row.target,
      rule: JSON.parse(String(row.rule_json)),
    }),
  );
  return {
    mode,
    revision: Number(settings?.revision ?? 0),
    genericOffice: Boolean(settings?.generic_office ?? false),
    entries,
    communeParents: Object.fromEntries(
      entries
        .filter((e) => e.scope === "commune")
        .map((e) => {
          const c = catalog.communes.find((c) => c.id === e.target);
          return [
            e.target,
            (mode === "legacy58"
              ? c?.legacyWilayaCode
              : c?.updatedWilayaCode) ?? "",
          ];
        }),
    ),
    communeNames: Object.fromEntries(
      entries
        .filter((e) => e.scope === "commune")
        .map((e) => [
          e.target,
          catalog.communes.find((c) => c.id === e.target)?.nameAr ??
            "بلدية غير معروفة",
        ]),
    ),
  };
}
export async function getShippingState(
  merchant: string,
  mode: AdministrativeMode,
): Promise<ShippingState> {
  const db = await database();
  try {
    await db.exec("BEGIN");
    const state = await readShippingSnapshot(db, merchant, mode);
    await db.exec("COMMIT");
    return state;
  } finally {
    await db.close();
  }
}
export async function changeShipping(
  merchant: string,
  mode: AdministrativeMode,
  revision: number,
  change: {
    entries?: RuleEntry[];
    reset?: RuleTarget[];
    genericOffice?: boolean;
  },
): Promise<ShippingState> {
  const targets = change.entries ?? change.reset ?? [];
  const seen = new Set<string>();
  for (const target of targets) {
    validateTarget(mode, target);
    const key = target.scope + ":" + target.target;
    if (seen.has(key)) throw new RangeError("منطقة الشحن مكررة في العملية.");
    seen.add(key);
  }
  const db = await database();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`shipping:${merchant}:${mode}`);
    await db
      .prepare(
        "INSERT OR IGNORE INTO shipping_settings(merchant_id,mode) VALUES(?,?)",
      )
      .run(merchant, mode);
    const state = await readShippingSnapshot(db, merchant, mode);
    if (state.revision !== revision)
      throw new ConflictError(
        "تغيرت الأسعار في جلسة أخرى. أعد تحميل البيانات قبل الحفظ.",
      );
    if (change.entries) {
      const stmt = db.prepare(
        "INSERT INTO shipping_rules VALUES(?,?,?,?,?) ON CONFLICT(merchant_id,mode,scope,target) DO UPDATE SET rule_json=excluded.rule_json",
      );
      for (const entry of change.entries) {
        const validated = entrySchema.parse(entry);
        await stmt.run(
          merchant,
          mode,
          validated.scope,
          validated.target,
          JSON.stringify(validated.rule),
        );
      }
    }
    if (change.reset) {
      const stmt = db.prepare(
        "DELETE FROM shipping_rules WHERE merchant_id=? AND mode=? AND scope=? AND target=?",
      );
      for (const target of change.reset)
        await stmt.run(merchant, mode, target.scope, target.target);
    }
    if (change.genericOffice !== undefined)
      await db
        .prepare(
          "UPDATE shipping_settings SET generic_office=? WHERE merchant_id=? AND mode=?",
        )
        .run(Number(change.genericOffice), merchant, mode);
    await db
      .prepare(
        "UPDATE shipping_settings SET revision=revision+1 WHERE merchant_id=? AND mode=?",
      )
      .run(merchant, mode);
    const next = await readShippingSnapshot(db, merchant, mode);
    await db.exec("COMMIT");
    return next;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
export function findCommune(
  mode: AdministrativeMode,
  wilayaCode: string,
  communeId: string,
) {
  const commune = catalog.communes.find((c) => c.id === communeId);
  if (
    !commune ||
    (mode === "legacy58"
      ? commune.legacyWilayaCode
      : commune.updatedWilayaCode) !== wilayaCode
  )
    throw new RangeError("البلدية لا تنتمي إلى الولاية المحددة في هذا النظام.");
  return commune;
}
