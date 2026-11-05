import { afterEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import {
  closeReadinessPool,
  healthFailureCode,
  postgresReadiness,
} from "../src/modules/storage/readiness";
const base = process.env.POSTGRES_TEST_URL;
afterEach(async () => {
  await closeReadinessPool();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("diagnostics never emit arbitrary error codes or secret-bearing messages", () => {
  expect(healthFailureCode({ code: "password=secret" })).toBe(
    "DB_READINESS_FAILED",
  );
  expect(
    healthFailureCode(new Error("connection timeout password=secret")),
  ).toBe("DB_TIMEOUT");
  expect(healthFailureCode({ code: "42501" })).toBe("42501");
  expect(
    healthFailureCode(new Error("The server does not support SSL connections")),
  ).toBe("TLS_UNSUPPORTED");
});
it.skipIf(!base)(
  "initializes safely, preserves rows and releases failed/blocked connections",
  async () => {
    const admin = new Pool({ connectionString: base });
    const name = "health_" + randomUUID().replaceAll("-", "");
    const role = name + "_role";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const url = new URL(base!);
    url.searchParams.set("options", `-c search_path=${name}`);
    try {
      await admin.query(`CREATE SCHEMA ${name}`);
      vi.stubEnv("DATABASE_URL", url.toString());
      await postgresReadiness();
      await admin.query(
        `INSERT INTO ${name}.owner VALUES(1,'sentinel','not-a-credential')`,
      );
      await closeReadinessPool();
      await postgresReadiness();
      expect(
        (await admin.query(`SELECT salt FROM ${name}.owner`)).rows[0].salt,
      ).toBe("sentinel");
      await closeReadinessPool();
      const locker = await admin.connect();
      try {
        await locker.query("SELECT pg_advisory_lock(174441)");
        const start = Date.now();
        await expect(postgresReadiness()).rejects.toMatchObject({
          code: "55P03",
        });
        expect(Date.now() - start).toBeLessThan(4000);
      } finally {
        await locker.query("SELECT pg_advisory_unlock(174441)");
        locker.release();
      }
      await postgresReadiness();
      await closeReadinessPool();
      await admin.query(
        `CREATE ROLE ${role} LOGIN PASSWORD 'disposable-role-only'`,
      );
      await admin.query(`CREATE SCHEMA ${role}`);
      await admin.query(`GRANT USAGE ON SCHEMA ${role} TO ${role}`);
      url.username = role;
      url.password = "disposable-role-only";
      url.searchParams.set("options", `-c search_path=${role}`);
      vi.stubEnv("DATABASE_URL", url.toString());
      for (let i = 0; i < 12; i++)
        await expect(postgresReadiness()).rejects.toMatchObject({
          code: "42501",
        });
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        "disposable-role-only",
      );
      expect(JSON.stringify(log.mock.calls)).toContain("schema_initialize");
    } finally {
      await closeReadinessPool();
      await admin.query(`DROP SCHEMA IF EXISTS ${role} CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
      await admin.query(`DROP ROLE IF EXISTS ${role}`);
      await admin.end();
    }
  },
);
