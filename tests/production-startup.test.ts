import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
const run = (changes: Record<string, string | undefined>) =>
  spawnSync(process.execPath, ["scripts/production-preflight.mjs"], {
    encoding: "utf8",
    env: { ...changes, PATH: process.env.PATH, NODE_ENV: "production" },
  });
const fixture = {
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1/fixture",
  SHOPIFY_CLIENT_ID: "fixture-client",
  SHOPIFY_CLIENT_SECRET: "PRIVATE-FIXTURE-SECRET",
  SHOPIFY_REDIRECT_URI:
    "https://app.example.test/api/integrations/shopify/callback",
  INTEGRATIONS_ENCRYPTION_KEY: "a".repeat(64),
};
it("refuses missing services, demo bypass and remote databases without TLS without exposing secrets", () => {
  expect(run({}).status).toBe(1);
  expect(run(fixture).status).toBe(0);
  for (const changes of [
    { DZ_LOCAL_DEMO: "1" },
    { DZ_AUTH_TEST_BYPASS: "1" },
    { LOCAL_MERCHANT_ID: "other-tenant" },
    {
      DATABASE_URL: "postgresql://fixture:fixture@remote.example.test/fixture",
    },
  ]) {
    const result = run({ ...fixture, ...changes });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("PRIVATE-FIXTURE-SECRET");
  }
});
