import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalDemo } from "../src/lib/local-demo";
import { sessionMerchant, validSession } from "../src/modules/auth/store";
afterEach(() => vi.unstubAllEnvs());
describe("explicit local demo access", () => {
  it("allows the local merchant without credentials only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DZ_LOCAL_DEMO", "1");
    expect(isLocalDemo()).toBe(true);
    expect(await validSession("")).toBe(true);
    expect(await sessionMerchant("")).toBe("local-demo-merchant");
  });
  it.each(["production", "test"] as const)(
    "never grants demo access under %s",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("DZ_LOCAL_DEMO", "1");
      expect(isLocalDemo()).toBe(false);
      expect(await validSession("")).toBe(false);
      expect(await sessionMerchant("")).toBeNull();
    },
  );
  it("keeps normal development authentication when the explicit flag is absent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DZ_LOCAL_DEMO", "");
    expect(await validSession("")).toBe(false);
  });
});
