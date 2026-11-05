import { test, expect, type Page } from "@playwright/test";
async function integrations(page: Page) {
  await page.goto("/dashboard");
  if (!(await page.locator(".app-sidebar").isVisible()))
    await page
      .getByRole("button", { name: "فتح القائمة", exact: true })
      .click();
  await page
    .locator(".app-sidebar")
    .getByRole("button", { name: "التكاملات", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "فحص صلاحيات Shopify", exact: true }),
  ).toBeEnabled();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("dz-language", "ar"));
  await page.route("**/api/integrations/shopify", (route) =>
    route.fulfill({
      json: {
        configured: true,
        connected: true,
        shop: "fixture.myshopify.com",
      },
    }),
  );
});
test("Strict cookie is absent on external navigation but present for the in-dashboard scope check", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "dz_session",
      value: "a".repeat(64),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  let externalCookie: boolean | undefined,
    fetchCookie: boolean | undefined,
    authorization: string | undefined;
  await page.route("**/api/integrations/shopify/scopes", async (route) => {
    const headers = await route.request().allHeaders();
    const hasCookie = headers.cookie?.includes("dz_session=") ?? false;
    if (route.request().isNavigationRequest()) externalCookie = hasCookie;
    else {
      fetchCookie = hasCookie;
      authorization = headers.authorization;
    }
    await route.fulfill(
      hasCookie
        ? {
            json: {
              verified: true,
              readProductsGranted: true,
              writeOrdersGranted: false,
            },
          }
        : { status: 401, json: { code: "AUTH_REQUIRED" } },
    );
  });
  await page.route("http://localhost:3003/external-scope-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<a href="http://127.0.0.1:3003/api/integrations/shopify/scopes">Open diagnostic</a>',
    }),
  );
  await page.goto("http://localhost:3003/external-scope-check");
  await page.getByRole("link", { name: "Open diagnostic" }).click();
  await expect(page.locator("body")).toContainText("AUTH_REQUIRED");
  expect(externalCookie).toBe(false);
  await integrations(page);
  const panel = page.getByRole("region", { name: "صلاحيات Shopify الفعلية" });
  await panel
    .getByRole("button", { name: "فحص صلاحيات Shopify", exact: true })
    .click();
  const result = panel.getByRole("status");
  await expect(result).toBeVisible();
  await expect(
    result.getByText("read_products", { exact: true }).locator(".."),
  ).toContainText("ممنوحة");
  await expect(
    result.getByText("write_orders", { exact: true }).locator(".."),
  ).toContainText("غير ممنوحة");
  expect(fetchCookie).toBe(true);
  expect(authorization).toBeUndefined();
  expect(new URL(page.url()).pathname).toBe("/dashboard");
});
test("clears old grants and distinguishes session, tenant and connection failures without displaying server secrets", async ({
  page,
}) => {
  let status = 200,
    code = "";
  await page.route("**/api/integrations/shopify/scopes", (route) =>
    status === 0
      ? route.abort()
      : route.fulfill({
          status,
          json:
            status === 200
              ? {
                  verified: true,
                  readProductsGranted: true,
                  writeOrdersGranted: true,
                }
              : { verified: false, code, error: "private-fixture-token" },
        }),
  );
  await integrations(page);
  const panel = page.getByRole("region", { name: "صلاحيات Shopify الفعلية" });
  const button = panel.getByRole("button", {
    name: "فحص صلاحيات Shopify",
    exact: true,
  });
  await button.click();
  await expect(panel.getByRole("status")).toBeVisible();
  const cases: [number, string, string, boolean][] = [
    [401, "AUTH_REQUIRED", "انتهت جلسة التاجر", true],
    [403, "MERCHANT_SESSION_REQUIRED", "جلسة الإدارة القديمة", true],
    [403, "TENANT_FORBIDDEN", "متجر آخر", false],
    [409, "SHOPIFY_CONNECTION_REQUIRED", "لا يرتبط بمتجر", false],
    [502, "SCOPE_CHECK_FAILED", "تعذر فحص الصلاحيات", false],
    [0, "", "تعذر الاتصال لفحص", false],
  ];
  for (const [nextStatus, nextCode, message, login] of cases) {
    status = nextStatus;
    code = nextCode;
    await button.click();
    await expect(panel.getByRole("alert")).toContainText(message);
    await expect(panel.getByRole("status")).toHaveCount(0);
    await expect(panel).not.toContainText("private-fixture-token");
    await expect(
      panel.getByRole("link", { name: "تسجيل الدخول بحساب التاجر" }),
    ).toHaveCount(login ? 1 : 0);
  }
});
