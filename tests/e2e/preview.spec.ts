import { test, expect } from "@playwright/test";
test("RTL preview validates inputs and updates the demo subtotal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("button", { name: "تأكيد الطلب وحفظه" }),
  ).toBeDisabled();
  await expect(page.getByTestId("subtotal")).toBeVisible();
  const before = await page.getByTestId("subtotal").textContent();
  await page.getByRole("button", { name: "زيادة الكمية" }).click();
  expect(await page.getByTestId("subtotal").textContent()).not.toBe(before);
  await page.getByLabel("خيار المنتج").selectOption("black");
  await expect(page.getByTestId("unit-price")).toContainText(/4.*200/);
  await expect(
    page.getByLabel("التوصيل إلى المكتب", { exact: false }),
  ).toBeDisabled();
  await expect(page.getByLabel("الولاية", { exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/preview-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("dashboard navigation and preview sizing", async ({ page, isMobile }) => {
  await page.goto("/dashboard");
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "الطلبات", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "إدارة الطلبات المحفوظة" }),
  ).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page
    .getByRole("button", { name: "الولايات والبلديات", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "سجل البيانات الجغرافية" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "هاتف", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "هاتف", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
