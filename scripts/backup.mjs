import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Specify a NEW backup directory. Stop application writes before running.",
  );
const target = resolve(destination);
if (existsSync(target))
  throw new Error("Backup destination already exists; choose a new directory.");
mkdirSync(target, { recursive: true, mode: 0o700 });
const databases = {
  auth: process.env.AUTH_DATABASE_PATH ?? "data/auth.sqlite",
  orders: process.env.ORDERS_DATABASE_PATH ?? "data/orders.sqlite",
  shipping: process.env.SHIPPING_DATABASE_PATH ?? "data/shipping.sqlite",
  checkout: process.env.CHECKOUT_DATABASE_PATH ?? "data/checkout.sqlite",
  geography: process.env.GEOGRAPHY_DATABASE_PATH ?? "data/geography.sqlite",
};
const manifest = { version: 1, createdAt: new Date().toISOString(), files: {} };
for (const [name, path] of Object.entries(databases)) {
  if (!existsSync(path)) continue;
  const db = new DatabaseSync(resolve(path), { readOnly: true });
  const file = join(target, `${name}.sqlite`);
  try {
    await backup(db, file);
  } finally {
    db.close();
  }
  chmodSync(file, 0o600);
  const check = new DatabaseSync(file, { readOnly: true });
  try {
    if (check.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw new Error(`Invalid backup: ${name}`);
  } finally {
    check.close();
  }
  manifest.files[`${name}.sqlite`] = createHash("sha256")
    .update(readFileSync(file))
    .digest("hex");
}
if (!Object.keys(manifest.files).length)
  throw new Error("No source databases were found.");
writeFileSync(
  join(target, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  { mode: 0o600 },
);
console.log(
  `Backed up ${Object.keys(manifest.files).length} databases. Contains personal data; protect this directory.`,
);
