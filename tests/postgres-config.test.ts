import { describe, expect, it } from "vitest";
import { Client } from "pg";
import { postgresConfiguration } from "../src/modules/storage/database";
describe("PostgreSQL transport verification", () => {
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
