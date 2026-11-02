import { test, expect } from "@playwright/test";
import { messages } from "../../src/lib/messages";
for (const language of ["ar", "fr", "en"] as const) {
  test(`${language}: Shopify catalog is read-only and sync/verification show real response outcomes (mock transport)`, async ({
    page,
    isMobile,
  }) => {
    const t = (key: string) =>
      language === "ar" ? key : (messages[key]?.[language] ?? key);
    await page.addInitScript(
      (lang) => localStorage.setItem("dz-language", lang),
      language,
    );
    await page.route("**/api/products", (route) =>
      route.fulfill({
        json: {
          source: "shopify",
          shop: "fixture.myshopify.com",
          revision: 1,
          discount: { type: "none", value: 0 },
          products: [
            {
              id: "gid://shopify/Product/1",
              name: "Shopify Fixture",
              demo: false,
              active: true,
              variants: [
                {
                  id: "gid://shopify/ProductVariant/1",
                  name: "Blue / L",
                  priceMinor: 120050,
                  stock: 3,
                },
              ],
            },
          ],
        },
      }),
    );
    await page.route("**/api/integrations/shopify", (route) =>
      route.fulfill({
        json: {
          connected: true,
          configured: true,
          shop: "fixture.myshopify.com",
        },
      }),
    );
    let fails = true;
    await page.route("**/api/integrations/shopify/sync", (route) =>
      route.fulfill({
        status: fails ? 503 : 200,
        json: fails ? { synced: false } : { synced: true, products: 2 },
      }),
    );
    await page.route("**/api/integrations/shopify/verify", (route) =>
      route.fulfill({ json: { verified: true } }),
    );
    const navigate = async (name: string) => {
      if (isMobile && !(await page.locator(".app-sidebar").isVisible()))
        await page
          .getByRole("button", { name: t("فتح القائمة"), exact: true })
          .click();
      await page
        .locator(".app-sidebar")
        .getByRole("button", { name: t(name), exact: true })
        .click();
    };
    await page.goto("/dashboard");
    await navigate("المنتجات");
    await expect(
      page.getByText("Shopify Fixture", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: t("إضافة منتج"), exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: t("نسخ المنتج"), exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: t("تعديل في Shopify"), exact: true }),
    ).toHaveAttribute("href", "https://fixture.myshopify.com/admin/products/1");
    await navigate("التكاملات");
    const sync = page.getByRole("button", {
      name: t("مزامنة منتجات Shopify"),
      exact: true,
    });
    await sync.click();
    await expect(page.getByRole("status")).toContainText(
      t("فشلت المزامنة. تحقق من التفويض وعملة المتجر ثم أعد المحاولة."),
    );
    fails = false;
    await sync.click();
    await expect(page.getByRole("status")).toContainText("2");
    await page
      .getByRole("button", { name: t("التحقق الحي من الاتصال"), exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      t("نجح التحقق الحي من المتجر."),
    );
  });
}
