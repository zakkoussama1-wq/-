import { expect, test, type Page } from "@playwright/test";
import { messages } from "../../src/lib/messages";
const captureDirectory =
  process.env.DZ_CAPTURE_REDESIGN === "1" ||
  process.env.DZ_CAPTURE_FINAL_REVIEW === "1"
    ? "docs/screenshots"
    : "test-results-local";
const tr = (key: string, lang: "ar" | "fr" | "en") =>
  lang === "ar" ? key : (messages[key]?.[lang] ?? key);
async function navigate(page: Page, name: string, menu: string) {
  if (!(await page.locator(".app-sidebar").isVisible()))
    await page.getByRole("button", { name: menu, exact: true }).click();
  await page
    .locator(".app-sidebar")
    .getByRole("button", { name, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name, exact: true }),
  ).toBeVisible();
}
for (const language of ["ar", "fr", "en"] as const) {
  test(`${language}: remaining pages localize, recover from read failures and persist discounts`, async ({
    page,
    request,
    isMobile,
  }) => {
    const t = (key: string) => tr(key, language);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (lang) => localStorage.setItem("dz-language", lang),
      language,
    );
    const original = await (await request.get("/api/checkout/catalog")).json();
    let startCalls = 0;
    let integrationFails = true;
    await page.route("**/api/integrations/shopify/start", (route) => {
      startCalls++;
      return route.abort();
    });
    await page.route("**/api/integrations/shopify", (route) =>
      route.fulfill({
        status: integrationFails ? 503 : 200,
        json: integrationFails
          ? { error: "Test failure" }
          : { connected: false, configured: false },
      }),
    );
    await page.goto("/dashboard");
    await expect(page.locator(".app-sidebar button").first()).toBeEnabled();
    try {
      await navigate(page, t("الإعدادات"), t("فتح القائمة"));
      await expect(page.locator("#discount-type")).toBeEnabled();
      await page.locator("#discount-type").selectOption("percent");
      await page.locator("#discount-value").fill("101");
      await page
        .getByRole("button", { name: t("حفظ خصم التاجر"), exact: true })
        .click();
      await expect(page.locator("main").getByRole("alert")).toContainText(
        t("الخصم يجب أن يكون غير سالب، وبحد أقصى ١٠٠٪ أو ١٠ ملايين دينار."),
      );
      await page.locator("#discount-value").fill("12.5");
      await page
        .getByRole("button", { name: t("حفظ خصم التاجر"), exact: true })
        .click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: t("تم حفظ خصم التاجر وتحديث نموذج الطلب.") }),
      ).toBeVisible();
      const saved = await (await request.get("/api/checkout/catalog")).json();
      expect(saved.discount).toEqual({ type: "percent", value: 1250 });
      await page.reload();
      await expect(page.locator(".app-sidebar button").first()).toBeEnabled();
      await navigate(page, t("الإعدادات"), t("فتح القائمة"));
      await expect(page.locator("#discount-value")).toHaveValue("12.5");
      await page
        .getByText(t("مرجع الولايات والبلديات"), { exact: true })
        .click();
      await expect(page.locator(".geography-counts")).toContainText("1");
      await expect(page.locator(".geography-counts > div")).toHaveCount(3);
      await page.screenshot({
        path: `${captureDirectory}/stage6-settings-${language}-${isMobile ? "mobile" : "desktop"}.png`,
        fullPage: true,
        scale: "css",
      });
      await navigate(page, t("التكاملات"), t("فتح القائمة"));
      await expect(page.locator("main").getByRole("alert")).toContainText(
        t("تعذر تحميل حالة الربط."),
      );
      integrationFails = false;
      await page
        .getByRole("button", { name: t("تحديث حالة الربط"), exact: true })
        .click();
      await expect(
        page.getByText(t("لا يوجد متجر مربوط لهذا الحساب."), { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: t("بدء ربط المتجر"), exact: true }),
      ).toBeDisabled();
      expect(startCalls).toBe(0);
      await page.screenshot({
        path: `${captureDirectory}/stage6-integrations-${language}-${isMobile ? "mobile" : "desktop"}.png`,
        fullPage: true,
        scale: "css",
      });
      await navigate(page, t("التحليلات"), t("فتح القائمة"));
      await expect(
        page.getByText(t("قيمة الطلبات ليست إيرادًا محصلًا أو إثبات دفع."), {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".stat-card")).toHaveCount(4);
      // Narrow phone, tablet, and desktop: wide tables scroll inside their containers.
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const section of [
          "نظرة عامة",
          "الطلبات",
          "المنتجات",
          "منشئ النموذج",
          "أسعار الشحن",
          "التحليلات",
          "التكاملات",
          "الإعدادات",
        ]) {
          await navigate(page, t(section), t("فتح القائمة"));
          await expect
            .poll(
              () =>
                page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth + 1,
                ),
              { message: `${language} ${width}px: ${section} page overflow` },
            )
            .toBe(true);
        }
      }
      expect(errors).toEqual([]);
    } finally {
      const latest = await (await request.get("/api/checkout/catalog")).json();
      expect(
        (
          await request.post("/api/checkout/discount", {
            headers: { origin: "http://127.0.0.1:3003" },
            data: { revision: latest.revision, discount: original.discount },
          })
        ).ok(),
      ).toBeTruthy();
    }
  });
}
test("login read failure retries and registration uses new-password without sending credentials", async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => localStorage.setItem("dz-language", "en"));
  let fails = true;
  let writes = 0;
  await page.route("**/api/auth", (route) => {
    if (route.request().method() !== "GET") {
      writes++;
      return route.abort();
    }
    return route.fulfill({
      status: fails ? 503 : 200,
      json: fails ? {} : { configured: true },
    });
  });
  await page.goto("/login");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    tr("تعذر تحميل حالة الحساب.", "en"),
  );
  fails = false;
  await page
    .getByRole("button", { name: tr("إعادة المحاولة", "en"), exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: tr("دخول", "en"), exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", {
      name: tr("إنشاء حساب متجر جديد", "en"),
      exact: true,
    })
    .click();
  await expect(page.locator("#password")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(writes).toBe(0);
  await page.screenshot({
    path: `${captureDirectory}/stage6-login-${isMobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
    scale: "css",
  });
});
test("analytics separates identical province codes belonging to different administrative systems", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("dz-language", "en"));
  await page.route("**/api/orders", (route) =>
    route.fulfill({
      json: {
        orders: ["legacy58", "updated69"].map((mode, index) => ({
          id: `audit-${index}`,
          status: "submitted",
          createdAt: new Date().toISOString(),
          productName: "Audit product",
          variantName: "Blue",
          customer: {
            name: "Audit customer",
            phone: "0550000010",
            method: "home",
            mode,
            wilayaCode: "49",
            communeId: "audit",
            quantity: 1,
          },
          quote: { methods: { home: { totalMinor: 10000 } } },
        })),
      },
    }),
  );
  await page.route("**/api/geography/wilayas?mode=*", (route) => {
    const legacy = route.request().url().includes("legacy58");
    return route.fulfill({
      json: {
        items: [
          {
            code: "49",
            nameAr: legacy ? "قديمة" : "محدثة",
            nameLatin: legacy ? "Legacy Province" : "Updated Province",
          },
        ],
      },
    });
  });
  await page.goto("/dashboard");
  await expect(page.locator(".app-sidebar button").first()).toBeEnabled();
  await navigate(page, tr("التحليلات", "en"), tr("فتح القائمة", "en"));
  await expect(
    page.getByText("Legacy Province", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Updated Province", { exact: true }),
  ).toBeVisible();
});
