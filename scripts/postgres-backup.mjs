// Local Docker development PostgreSQL only. Managed deployments must use their provider's backup service.
import { spawnSync } from "node:child_process";
import {
  openSync,
  closeSync,
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
const target = process.argv[2];
if (!target)
  throw new Error("Usage: node scripts/postgres-backup.mjs NEW_FILE.dump");
const file = resolve(target);
if (existsSync(file) || existsSync(file + ".json"))
  throw new Error("Destination already exists.");
mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
const env = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[key];
const fd = openSync(file, "wx", 0o600);
let result;
try {
  result = spawnSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "dz-lead-postgres",
      "pg_dump",
      "-U",
      "dz_app",
      "-d",
      "dz_lead",
      "--format=custom",
      "--no-owner",
      "--no-acl",
    ],
    { env, stdio: ["ignore", fd, "pipe"] },
  );
} finally {
  closeSync(fd);
}
if (result.status !== 0)
  throw new Error(
    "PostgreSQL backup failed; incomplete file retained for diagnosis.",
  );
const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
writeFileSync(
  file + ".json",
  JSON.stringify({ version: 1, createdAt: new Date().toISOString(), sha256 }),
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Private PostgreSQL backup and SHA-256 manifest created. Keep encryption keys separately.",
);
