import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
mkdirSync("data", { recursive: true });
const file = "data/postgres-dev.env";
if (!existsSync(file))
  writeFileSync(
    file,
    `POSTGRES_USER=dz_app\nPOSTGRES_DB=dz_lead\nPOSTGRES_PASSWORD=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600 },
  );
const env = { ...process.env };
for (const name of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[name];
const run = (args) =>
  spawnSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env,
    encoding: "utf8",
  });
const inspect = run([
  "container",
  "inspect",
  "-f",
  "{{.State.Running}}",
  "dz-lead-postgres",
]);
if (inspect.status === 0) {
  if (inspect.stdout.trim() !== "true") {
    const r = run(["start", "dz-lead-postgres"]);
    if (r.status) throw new Error("Cannot start local PostgreSQL.");
  }
} else {
  const r = run([
    "run",
    "-d",
    "--name",
    "dz-lead-postgres",
    "-p",
    "127.0.0.1:55432:5432",
    "--env-file",
    file,
    "-v",
    "dz-lead-postgres-data:/var/lib/postgresql/data",
    "postgres:17@sha256:31ba9c94a03ada9988f2bb493a22a75eef3a185884533e5cdbcd498ea835b08f",
  ]);
  if (r.status) {
    process.stderr.write(r.stderr);
    process.exit(1);
  }
}
console.log(
  "Local PostgreSQL started on loopback port 55432; credentials remain in private data/postgres-dev.env.",
);
