import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { postgresConfiguration } from "./database";

let pool: Pool | undefined;
let initialized: Promise<void> | undefined;
export function healthFailureCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (
    typeof code === "string" &&
    [
      "28P01",
      "28000",
      "3D000",
      "42501",
      "42P01",
      "42703",
      "55P03",
      "57014",
      "53300",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "CERT_HAS_EXPIRED",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ].includes(code)
  )
    return code;
  // Classify known driver errors without ever logging their text or nested data.
  if (code === "ENOENT") return "SCHEMA_FILE_MISSING";
  const message = error instanceof Error ? error.message : "";
  if (/timeout|timed out/i.test(message)) return "DB_TIMEOUT";
  if (/does not support SSL/i.test(message)) return "TLS_UNSUPPORTED";
  if (/certificate/i.test(message)) return "TLS_VERIFICATION_FAILED";
  return "DB_READINESS_FAILED";
}
export function logHealthFailure(stage: string, error: unknown) {
  console.error(
    JSON.stringify({
      event: "database_readiness_failed",
      stage,
      code: healthFailureCode(error),
    }),
  );
}
function readinessPool() {
  if (!pool) {
    pool = new Pool({
      ...postgresConfiguration(process.env.DATABASE_URL ?? ""),
      max: 2,
      connectionTimeoutMillis: 1000,
      statement_timeout: 1500,
      query_timeout: 2000,
      lock_timeout: 500,
    });
    pool.on("error", (error) => logHealthFailure("idle_connection", error));
  }
  return pool;
}
async function initialize() {
  let stage = "connect";
  let client: PoolClient | undefined;
  let failed = false;
  try {
    client = await readinessPool().connect();
    stage = "schema_file";
    const schema = readFileSync(
      join(process.cwd(), "scripts/postgres-schema.sql"),
      "utf8",
    );
    stage = "schema_initialize";
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(174441)");
    await client.query(schema);
    await client.query("COMMIT");
  } catch (error) {
    failed = true;
    logHealthFailure(stage, error);
    throw error;
  } finally {
    // Destroy failed connections: no leaked clients, aborted transactions or locks.
    client?.release(failed);
  }
}
async function checkReadiness() {
  initialized ??= initialize().catch((error) => {
    initialized = undefined;
    throw error;
  });
  await initialized;
  try {
    await readinessPool().query("SELECT 1 AS ok");
  } catch (error) {
    logHealthFailure("query", error);
    throw error;
  }
}
// Bound the HTTP readiness wait below the container probe's four-second timeout.
// Driver timeouts still bound and release the underlying database work.
export async function postgresReadiness() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      checkReadiness(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("Readiness timeout");
          logHealthFailure("deadline", error);
          reject(error);
        }, 3000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function closeReadinessPool() {
  await pool?.end();
  pool = undefined;
  initialized = undefined;
}
