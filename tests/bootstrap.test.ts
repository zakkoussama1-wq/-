import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
vi.mock("../src/modules/auth/store", () => ({
  validSession: vi.fn(() => {
    throw new Error("Authentication must not be bypassed");
  }),
}));
vi.mock("../src/modules/merchants/local-context", () => ({
  localMerchantId: vi.fn(() => {
    throw new Error("No tenant");
  }),
}));
afterEach(() => vi.unstubAllEnvs());
it("bootstrap exposes only health and refuses data and integration requests even with a session cookie", async () => {
  vi.stubEnv("DZ_BOOTSTRAP_MODE", "1");
  vi.stubEnv("NODE_ENV", "production");
  expect(
    (await proxy(new NextRequest("https://app.test/api/health"))).status,
  ).toBe(200);
  for (const path of [
    "/",
    "/dashboard",
    "/form",
    "/media/private.png",
    "/api/auth",
    "/api/orders",
    "/api/products",
    "/api/checkout/validate",
    "/api/shopify/webhooks",
    "/api/integrations/shopify/start",
    "/api/integrations/shopify/callback",
    "/api/integrations/shopify/sync",
  ]) {
    for (const method of ["GET", "POST"]) {
      const response = await proxy(
        new NextRequest(`https://app.test${path}`, {
          method,
          headers: { cookie: "dz_session=" + "a".repeat(64) },
        }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "SETUP_REQUIRED" });
    }
  }
});
