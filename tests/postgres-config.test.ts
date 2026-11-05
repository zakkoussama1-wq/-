import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { postgresConfiguration } from "../src/modules/storage/database";
afterEach(() => vi.unstubAllEnvs());
describe("PostgreSQL transport verification", () => {
  it("uses private transport only with explicit Render opt-in, overriding PGSSLMODE", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("DATABASE_SSL_MODE", "render-internal");
    vi.stubEnv("PGSSLMODE", "require");
    const client = new Client(
      postgresConfiguration("postgresql://fixture:fixture@dpg-fixture-a/app"),
    );
    expect(client.ssl).toBe(false);
    for (const host of [
      "db.example.test",
      "dpg-fixture-a.frankfurt-postgres.render.com",
      "dpg-fixture-a.evil.test",
      "127.0.0.1",
    ]) {
      expect(() =>
        postgresConfiguration(`postgresql://fixture:fixture@${host}/app`),
      ).toThrow("private");
    }
    expect(() =>
      postgresConfiguration("postgresql://dpg-fixture-a/app?sslmode=require"),
    ).toThrow("conflicting");
    vi.stubEnv("RENDER", "false");
    expect(() =>
      postgresConfiguration("postgresql://dpg-fixture-a/app"),
    ).toThrow("private");
  });
  it("does not infer private transport from the hostname without opt-in", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("DATABASE_SSL_MODE", "verify-full");
    const client = new Client(
      postgresConfiguration("postgresql://dpg-fixture-a/app"),
    );
    expect(client.ssl).toBeTypeOf("object");
    expect(
      (client.ssl as unknown as import("node:tls").ConnectionOptions)
        .rejectUnauthorized,
    ).not.toBe(false);
  });
  it("keeps real pg verification active even with libpq require semantics", () => {
    const client = new Client(
      postgresConfiguration(
        "postgresql://user:fixture@db.example.test/app?sslmode=require&uselibpqcompat=true",
      ),
    );
    const ssl = client.ssl as unknown as import("node:tls").ConnectionOptions;
    expect(ssl).toBeTypeOf("object");
    expect(ssl.rejectUnauthorized).not.toBe(false);
    expect(ssl.checkServerIdentity).toBeUndefined();
  });
  it.each(["ssl=false", "ssl=0", "sslmode=disable", "sslmode=no-verify"])(
    "rejects insecure remote options %s",
    (option) => {
      expect(() =>
        postgresConfiguration(
          "postgresql://user:fixture@db.example.test/app?" + option,
        ),
      ).toThrow("verify TLS");
    },
  );
  it("allows the loopback-only local development server", () => {
    expect(
      postgresConfiguration("postgresql://127.0.0.1:55432/app").ssl,
    ).toBeUndefined();
  });
});
