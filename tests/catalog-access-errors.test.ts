import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ merchant: vi.fn(), catalog: vi.fn() }));
vi.mock("../src/modules/merchants/local-context", async (original) => ({
  ...(await original<
    typeof import("../src/modules/merchants/local-context")
  >()),
  localMerchantId: mocks.merchant,
}));
vi.mock("../src/modules/commerce/adapter", () => ({
  localCommerceAdapter: { catalog: mocks.catalog },
}));
import { TenantAccessError } from "../src/modules/merchants/local-context";
import { readCatalog } from "../src/modules/checkout/http";
beforeEach(() => {
  mocks.merchant.mockReset();
  mocks.catalog.mockReset();
});
afterEach(() => vi.restoreAllMocks());
it.each([
  ["AUTH_REQUIRED", 401],
  ["MERCHANT_SESSION_REQUIRED", 403],
  ["SHOPIFY_CONNECTION_REQUIRED", 409],
  ["TENANT_FORBIDDEN", 403],
] as const)(
  "keeps %s separate from product failures and never reads a catalog without tenant access",
  async (code, status) => {
    mocks.merchant.mockRejectedValue(
      new TenantAccessError(code, status, "Safe tenant error"),
    );
    const r = await readCatalog(
      new Request("https://app.example.test/api/checkout/catalog"),
    );
    expect(r.status).toBe(status);
    expect(await r.json()).toEqual({ code, error: "Safe tenant error" });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(mocks.catalog).not.toHaveBeenCalled();
  },
);
