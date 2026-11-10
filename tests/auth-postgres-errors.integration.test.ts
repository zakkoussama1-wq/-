import { beforeAll, afterAll, it, expect, vi, describe } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accountLogin, sessionMerchant } from "../src/modules/auth/store";
import { closeStoragePool } from "../src/modules/storage/database";
const base = process.env.POSTGRES_TEST_URL;
describe.skipIf(!base)("PostgreSQL account error boundaries", () => {
  let admin: Pool, schema: string, dir: string, merchant: string;
  beforeAll(async () => {
    admin = new Pool({ connectionString: base });
    schema = "login_" + randomUUID().replaceAll("-", "");
    dir = mkdtempSync(join(tmpdir(), "dz-login-"));
    await admin.query(`CREATE SCHEMA ${schema}`);
    const client = await admin.connect();
    try {
      await client.query("SELECT set_config('search_path',$1,false)", [schema]);
      await client.query(
        "CREATE TABLE accounts(name TEXT NOT NULL CHECK(name<>'blocked'),email TEXT UNIQUE NOT NULL,hash TEXT NOT NULL,merchant_id TEXT PRIMARY KEY,salt TEXT NOT NULL,marker TEXT NOT NULL DEFAULT 'retained')",
      );
    } finally {
      client.release();
    }
    const url = new URL(base!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    vi.stubEnv("DATABASE_URL", url.toString());
    vi.stubEnv("AUTH_DATABASE_PATH", join(dir, "auth.sqlite"));
    vi.stubEnv("DZ_LOCAL_DEMO", "");
    vi.stubEnv("NODE_ENV", "test");
  });
  afterAll(async () => {
    await closeStoragePool();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });
  it("registers and signs in using named columns without modifying an existing schema", async () => {
    const token = await accountLogin(
      "login-fixture@example.test",
      "fixture-password",
      "Fixture store",
    );
    merchant = (await sessionMerchant(token))!;
    expect(merchant).toMatch(/^[a-f0-9-]{36}$/);
    const client = await admin.connect();
    try {
      await client.query("SELECT set_config('search_path',$1,false)", [schema]);
      const r = await client.query(
        "SELECT name,email,marker FROM accounts WHERE merchant_id=$1",
        [merchant],
      );
      expect(r.rows).toEqual([
        {
          name: "Fixture store",
          email: "login-fixture@example.test",
          marker: "retained",
        },
      ]);
    } finally {
      client.release();
    }
  });
  it("classifies a real duplicate without replacing the original account or password", async () => {
    await expect(
      accountLogin(
        "login-fixture@example.test",
        "different-fixture-password",
        "New store",
      ),
    ).rejects.toMatchObject({
      code: "AUTH_REGISTRATION_REJECTED",
      status: 409,
    });
    expect(
      await sessionMerchant(
        await accountLogin("login-fixture@example.test", "fixture-password"),
      ),
    ).toBe(merchant);
  });
  it("does not misreport schema/check failures as duplicate email", async () => {
    await expect(
      accountLogin("blocked@example.test", "fixture-password", "blocked"),
    ).rejects.toMatchObject({ code: "23514" });
    expect(
      await sessionMerchant(
        await accountLogin("login-fixture@example.test", "fixture-password"),
      ),
    ).toBe(merchant);
  });
});
