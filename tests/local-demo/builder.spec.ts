import { test, expect } from "@playwright/test";
import { defaultFormSettings } from "../../src/modules/forms/settings";
const origin = "http://127.0.0.1:3003";
test("builder previews colors and fields, persists them, and the public form honors delivery choices", async ({
  page,
  context,
  request,
  isMobile,
}) => {
  const reset = () =>
    request.post("/api/form-config", {
      headers: { origin },
      data: defaultFormSettings,
    });
  expect((await reset()).status()).toBe(200);
  await page.goto("/dashboard");
  if (isMobile)
    await page
      .getByRole("button", { name: "فتح القائمة", exact: true })
      .click();
  await page.getByRole("button", { name: "منشئ النموذج", exact: true }).click();
  await expect(page.getByLabel("عنوان النموذج", { exact: true })).toBeEnabled();
  await page
    .getByLabel("عنوان النموذج", { exact: true })
    .fill("طلب احترافي مختصر");
  await page
    .getByLabel("نص زر التأكيد", { exact: true })
    .fill("أرسل طلبي الآن");
  await page.getByText("نصوص القوائم وملخص الأسعار", { exact: true }).click();
  await page.getByLabel("تسمية الولاية", { exact: true }).fill("ولاية التوصيل");
  await expect(page.getByLabel("ولاية التوصيل", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "طلب احترافي مختصر", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "التصميم", exact: true }).click();
  await page.getByRole("button", { name: "أصفر", exact: true }).click();
  await page.getByLabel("الحدود", { exact: true }).selectOption("plain");
  await expect(page.getByTestId("lead-form")).toHaveCSS("border-radius", "8px");
  const previewButton = page.getByRole("button", {
    name: "أرسل طلبي الآن",
    exact: true,
  });
  await expect(previewButton).toHaveCSS(
    "background-color",
    "rgb(250, 204, 21)",
  );
  await expect(previewButton).toHaveCSS("color", "rgb(17, 24, 39)");
  await page.getByRole("tab", { name: "الحقول", exact: true }).click();
  await page
    .getByRole("switch", { name: "قائمة خيارات المنتج", exact: true })
    .check();
  await page
    .getByRole("switch", { name: "حقول البحث عن المناطق", exact: true })
    .check();
  await expect(page.getByLabel("خيار المنتج", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("مثال: المسيلة أو M’Sila")).toBeVisible();
  await page.getByPlaceholder("مثال: المسيلة أو M’Sila").fill("M'Sila");
  await expect(page.locator("#preview-wilaya option")).toHaveCount(2);
  await page
    .getByRole("switch", { name: "قائمة خيارات المنتج", exact: true })
    .uncheck();
  await page
    .getByRole("switch", { name: "حقول البحث عن المناطق", exact: true })
    .uncheck();
  await expect(page.getByLabel("خيار المنتج", { exact: true })).toHaveCount(0);
  await expect(page.locator("#preview-wilaya option")).toHaveCount(59);
  await page.getByRole("tab", { name: "التوصيل", exact: true }).click();
  await page
    .getByLabel("طرق التوصيل في النموذج", { exact: true })
    .selectOption("office");
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/form-config") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "حفظ النموذج", exact: true }).click();
  expect((await saved).status()).toBe(200);
  const customer = await context.newPage();
  await customer.goto("/form");
  await expect(
    customer.getByRole("heading", { name: "طلب احترافي مختصر", exact: true }),
  ).toBeVisible();
  await expect(
    customer.getByRole("radio", { name: /التوصيل إلى المنزل/ }),
  ).toHaveCount(0);
  await expect(
    customer.getByRole("radio", { name: /التوصيل إلى المكتب/ }),
  ).toBeChecked();
  await expect(customer.locator("#address")).toHaveCount(0);
  await expect(
    customer.getByLabel("ولاية التوصيل", { exact: true }),
  ).toBeVisible();
  await expect(customer.getByTestId("lead-form")).toHaveCSS(
    "border-radius",
    "8px",
  );
  await expect(
    customer.getByRole("button", { name: "أرسل طلبي الآن", exact: true }),
  ).toHaveCSS("background-color", "rgb(250, 204, 21)");
  await page.screenshot({
    path: `test-results-local/builder-${test.info().project.name}.png`,
    fullPage: true,
  });
  await customer.close();
  await reset();
});

test("a saved-design load failure blocks checkout and can be retried without a fallback design", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post("/api/form-config", {
        headers: { origin },
        data: defaultFormSettings,
      })
    ).status(),
  ).toBe(200);
  await page.route("**/api/form-config", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "unavailable" }),
        })
      : route.continue(),
  );
  await page.goto("/form");
  await expect(
    page.getByText("تعذر تحميل الإعدادات.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#customer-name")).toHaveCount(0);
  await page.unroute("**/api/form-config");
  await page
    .getByRole("button", { name: "إعادة تحميل المنتج", exact: true })
    .click();
  await expect(page.locator("#customer-name")).toBeVisible();
  await expect(
    page.getByText("تعذر تحميل الإعدادات.", { exact: true }),
  ).toHaveCount(0);
});
