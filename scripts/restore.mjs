import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  copyFileSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg)
  throw new Error(
    "Usage: node scripts/restore.mjs BACKUP NEW_DIRECTORY; never overwrite live databases.",
  );
const source = resolve(sourceArg),
  target = resolve(targetArg);
if (existsSync(target)) throw new Error("Restore target must not exist.");
const manifest = JSON.parse(
  readFileSync(join(source, "manifest.json"), "utf8"),
);
if (manifest.version !== 1 || !Object.keys(manifest.files).length)
  throw new Error("Invalid manifest.");
for (const [file, hash] of Object.entries(manifest.files)) {
  if (!/^(auth|orders|shipping|checkout|geography)\.sqlite$/.test(file))
    throw new Error("Unexpected database filename.");
  if (
    createHash("sha256")
      .update(readFileSync(join(source, file)))
      .digest("hex") !== hash
  )
    throw new Error(`Checksum mismatch: ${file}`);
  const db = new DatabaseSync(join(source, file), { readOnly: true });
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw new Error("Corrupt database.");
  } finally {
    db.close();
  }
}
mkdirSync(target, { recursive: true, mode: 0o700 });
for (const file of Object.keys(manifest.files)) {
  copyFileSync(join(source, file), join(target, file));
  chmodSync(join(target, file), 0o600);
}
console.log(
  "Restore verified into a NEW directory. Configure database paths before starting the app. Existing data was not overwritten.",
);
