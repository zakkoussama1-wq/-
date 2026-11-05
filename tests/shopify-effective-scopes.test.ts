import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ tenant: vi.fn(), credential: vi.fn() }));
vi.mock("../src/modules/merchants/local-context", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/modules/merchants/local-context")
  >()),
  authenticatedShopTenant: mocks.tenant,
}));
import { TenantAccessError } from "../src/modules/merchants/local-context";
vi.mock("../src/modules/integrations/shopify/connections", () => ({
  connectionCredential: mocks.credential,
}));
import { GET } from "../src/app/api/integrations/shopify/scopes/route";
const request = () =>
  new Request("https://app.example.test/api/integrations/shopify/scopes");
beforeEach(() => {
  for (const flag of [
    "DZ_LOCAL_DEMO",
    "DZ_BOOTSTRAP_MODE",
    "DZ_DISABLE_EXTERNAL_INTEGRATIONS",
  ])
    vi.stubEnv(flag, "");
  vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "0");
  mocks.tenant.mockResolvedValue({
    merchantId: "fixture-merchant",
    domain: "fixture.myshopify.com",
  });
  // Stored scope metadata deliberately disagrees with Shopify: only the API response counts.
  mocks.credential.mockResolvedValue({
    shop: "fixture.myshopify.com",
    accessToken: "private-fixture-token",
    offline: true,
    scopes: ["write_orders"],
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  mocks.tenant.mockReset();
  mocks.credential.mockReset();
});
function transport(scopes: string[], status = 200, version = "2026-10") {
  const mock = vi.fn(async () =>
    Response.json(
      {
        data: {
          currentAppInstallation: {
            accessScopes: scopes.map((handle) => ({ handle })),
          },
        },
      },
      { status, headers: { "x-shopify-api-version": version } },
    ),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}
it("queries actual grants with sync disabled, without refreshing credentials or creating an order", async () => {
  const mock = transport(["read_products", "write_orders"]);
  const response = await GET(request());
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({
    verified: true,
    writeOrdersGranted: true,
    readProductsGranted: true,
    offlineSessionVerified: true,
    grantedScopes: ["read_products", "write_orders"],
  });
  expect(JSON.stringify(result)).not.toContain("private-fixture-token");
  expect(mocks.credential).toHaveBeenCalledWith(
    "fixture-merchant",
    false,
    false,
  );
  expect(mock).toHaveBeenCalledTimes(1);
  const [url, options] = mock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(
    "https://fixture.myshopify.com/admin/api/2026-10/graphql.json",
  );
  expect(JSON.parse(String(options.body)).query).toContain(
    "currentAppInstallation",
  );
  expect(String(options.body)).not.toMatch(/mutation|orderCreate/);
  expect(process.env.DZ_SHOPIFY_ORDER_SYNC).toBe("0");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("reports missing write_orders rather than trusting saved metadata or app configuration", async () => {
  transport(["read_products"]);
  const result = await (await GET(request())).json();
  expect(result).toMatchObject({
    verified: true,
    writeOrdersGranted: false,
    readProductsGranted: true,
  });
});
it("recognizes write_products as implicitly granting product read access", async () => {
  transport(["write_products"]);
  expect(await (await GET(request())).json()).toMatchObject({
    readProductsGranted: true,
    writeOrdersGranted: false,
  });
});
it("refuses unauthenticated callers and disabled external integrations", async () => {
  const mock = transport([]);
  mocks.tenant.mockRejectedValueOnce(
    new TenantAccessError("AUTH_REQUIRED", 401, "يلزم تسجيل الدخول."),
  );
  expect((await GET(request())).status).toBe(401);
  vi.stubEnv("DZ_BOOTSTRAP_MODE", "1");
  expect((await GET(request())).status).toBe(503);
  expect(mock).not.toHaveBeenCalled();
});
it("does not report verified grants on API rejection, fallback, errors or credential failures and logs no secrets", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  transport([], 401);
  expect((await GET(request())).status).toBe(502);
  transport([], 200, "2026-07");
  expect((await GET(request())).status).toBe(502);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { errors: [{ message: "private-fixture-token" }] },
        { headers: { "x-shopify-api-version": "2026-10" } },
      ),
    ),
  );
  expect(JSON.stringify(await (await GET(request())).json())).not.toContain(
    "private-fixture-token",
  );
  mocks.credential.mockRejectedValueOnce(new Error("private-fixture-token"));
  expect((await GET(request())).status).toBe(502);
  expect(error).not.toHaveBeenCalled();
});

it("refuses a stored credential belonging to a different shop without making an API request", async () => {
  const mock = transport(["read_products", "write_orders"]);
  mocks.credential.mockResolvedValueOnce({
    shop: "other-fixture.myshopify.com",
    accessToken: "other-fixture-token",
    offline: true,
    scopes: ["write_orders"],
  });
  const response = await GET(request());
  expect(response.status).toBe(502);
  expect(mock).not.toHaveBeenCalled();
  expect(JSON.stringify(await response.json())).not.toMatch(
    /other-fixture-token|other-fixture.myshopify/,
  );
});

it("distinguishes tenant denial, legacy session and missing connection without asking Shopify", async () => {
  const mock = transport([]);
  for (const [code, status] of [
    ["TENANT_FORBIDDEN", 403],
    ["MERCHANT_SESSION_REQUIRED", 403],
    ["SHOPIFY_CONNECTION_REQUIRED", 409],
  ] as const) {
    mocks.tenant.mockRejectedValueOnce(
      new TenantAccessError(code, status, "تعذر السماح بهذا الفحص."),
    );
    const result = await GET(request());
    expect(result.status).toBe(status);
    expect(await result.json()).toMatchObject({ code, verified: false });
  }
  mocks.tenant.mockRejectedValueOnce(new Error("private-database-details"));
  const result = await GET(request());
  expect(result.status).toBe(503);
  expect(await result.json()).toMatchObject({ code: "AUTH_CHECK_FAILED" });
  expect(mock).not.toHaveBeenCalled();
});
