// Restore to a NEW local Docker database only. Existing databases are never overwritten.
import { spawnSync } from "node:child_process";
import { readFileSync, openSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";
const [file, database] = process.argv.slice(2);
if (!file || !/^dz_restore_[a-z0-9_]{1,48}$/.test(database ?? ""))
  throw new Error(
    "Usage: node scripts/postgres-restore.mjs BACKUP.dump dz_restore_NEW_NAME",
  );
const manifest = JSON.parse(readFileSync(file + ".json", "utf8"));
if (
  manifest.version !== 1 ||
  createHash("sha256").update(readFileSync(file)).digest("hex") !==
    manifest.sha256
)
  throw new Error("Backup checksum mismatch.");
const env = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[key];
const run = (args, options = {}) =>
  spawnSync("docker", ["--host=unix:///var/run/docker.sock", "exec", ...args], {
    env,
    encoding: "utf8",
    ...options,
  });
const created = run(["dz-lead-postgres", "createdb", "-U", "dz_app", database]);
if (created.status !== 0)
  throw new Error(
    "Cannot create NEW restore database. Existing databases are not modified.",
  );
const fd = openSync(file, "r");
let result;
try {
  result = run(
    [
      "-i",
      "dz-lead-postgres",
      "pg_restore",
      "-U",
      "dz_app",
      "-d",
      database,
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-acl",
    ],
    { stdio: [fd, "ignore", "pipe"] },
  );
} finally {
  closeSync(fd);
}
if (result.status !== 0)
  throw new Error(
    "Restore failed. Original database is unchanged; inspect the newly created restore database.",
  );
const check = run([
  "dz-lead-postgres",
  "psql",
  "-U",
  "dz_app",
  "-d",
  database,
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'",
]);
if (check.status !== 0 || Number(check.stdout.trim()) < 1)
  throw new Error("Restored database has no tables.");
console.log(
  `Restored and verified ${check.stdout.trim()} tables in NEW database ${database}. Original remains unchanged.`,
);
