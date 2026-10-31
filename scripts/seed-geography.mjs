import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSearch } from "../src/modules/geography/normalize.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const raw = readFileSync(resolve(root, "data/geography/catalog.json"), "utf8");
const catalog = JSON.parse(raw);
const hash = createHash("sha256").update(raw).digest("hex");
const target = resolve(
  process.env.GEOGRAPHY_DATABASE_PATH ?? resolve(root, "data/geography.sqlite"),
);
mkdirSync(dirname(target), { recursive: true });
// Build outside the live file; failed imports cannot replace the last valid catalog.
const temp = `${target}.${process.pid}.tmp`;
rmSync(temp, { force: true });
const db = new DatabaseSync(temp);
let closed = false;
try {
  db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE wilayas(code TEXT PRIMARY KEY,name_ar TEXT NOT NULL,name_latin TEXT NOT NULL,search TEXT NOT NULL);
 CREATE TABLE communes(id TEXT PRIMARY KEY,source_id INTEGER UNIQUE NOT NULL,name_ar TEXT NOT NULL,name_latin TEXT NOT NULL,search TEXT NOT NULL,legacy_code TEXT NOT NULL REFERENCES wilayas(code),updated_code TEXT NOT NULL REFERENCES wilayas(code));
 CREATE INDEX commune_legacy ON communes(legacy_code); CREATE INDEX commune_updated ON communes(updated_code);
 BEGIN IMMEDIATE;`);
  const w = db.prepare("INSERT INTO wilayas VALUES(?,?,?,?)");
  for (const row of catalog.wilayas)
    w.run(
      row.code,
      row.nameAr,
      row.nameLatin,
      normalizeSearch(row.nameAr) + " " + normalizeSearch(row.nameLatin),
    );
  const c = db.prepare("INSERT INTO communes VALUES(?,?,?,?,?,?,?)");
  for (const row of catalog.communes)
    c.run(
      row.id,
      row.sourceId,
      row.nameAr,
      row.nameLatin,
      normalizeSearch(row.nameAr) + " " + normalizeSearch(row.nameLatin),
      row.legacyWilayaCode,
      row.updatedWilayaCode,
    );
  db.prepare("INSERT INTO metadata VALUES('catalog_hash',?)").run(hash);
  db.exec("COMMIT;");
  if (db.prepare("SELECT COUNT(*) AS count FROM communes").get().count !== 1541)
    throw new Error("Incomplete seed");
  if (db.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("Orphan commune");
  db.close();
  closed = true;
  renameSync(temp, target);
  console.log(
    "Geography database seeded atomically: 69 wilayas, 1541 communes; legacy58 default.",
  );
} catch (error) {
  if (!closed) db.close();
  rmSync(temp, { force: true });
  throw error;
}
