import { test, expect, type Page } from "./fixtures";
import { csvHeaders } from "../../src/modules/shipping/csv";
import { readFileSync } from "node:fs";
async function saved(page: Page, button: string) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/shipping") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: button, exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByText("تم حفظ إعدادات الشحن.", { exact: true }),
  ).toBeVisible();
}
test("persistent individual, bulk, free, override, reset, quote and CSV shipping workflow", async ({
  page,
  request,
  isMobile,
}) => {
  const mode = isMobile ? "updated69" : "legacy58";
  let state = await (await request.get(`/api/shipping?mode=${mode}`)).json();
  if (state.entries.length) {
    const r = await request.post("/api/shipping", {
      headers: { origin: "http://127.0.0.1:3000" },
      data: {
        action: "reset",
        mode,
        revision: state.revision,
        targets: state.entries.map((e: { scope: string; target: string }) => ({
          scope: e.scope,
          target: e.target,
        })),
      },
    });
    expect(r.status()).toBe(200);
    state = await r.json();
  }
  const settings = await request.post("/api/shipping", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: {
      action: "settings",
      mode,
      revision: state.revision,
      genericOffice: false,
    },
  });
  expect(settings.status()).toBe(200);
  async function open() {
    await page.goto("/dashboard");
    if (isMobile)
      await page.getByRole("button", { name: "فتح القائمة" }).click();
    await page
      .getByRole("button", { name: "أسعار الشحن", exact: true })
      .click();
    await page.getByLabel("نظام مناطق الشحن").selectOption(mode);
    await page.locator("#shipping-page-size").selectOption("100");
  }
  await open();
  await expect(page.getByTestId("shipping-row-16")).toContainText("غير متاح");
  await page
    .getByRole("button", { name: "إعداد السعر الافتراضي", exact: true })
    .click();
  await page.getByLabel("تفعيل توصيل المنزل", { exact: true }).check();
  await page.getByLabel("سعر المنزل بالدينار", { exact: true }).fill("500");
  await saved(page, "حفظ القاعدة");
  await expect(
    page.getByTestId("shipping-row-16").locator('input[type="number"]').first(),
  ).toHaveValue("500");
  await page.reload();
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "أسعار الشحن", exact: true }).click();
  await page.getByLabel("نظام مناطق الشحن").selectOption(mode);
  await page.locator("#shipping-page-size").selectOption("100");
  await expect(
    page.getByTestId("shipping-row-16").locator('input[type="number"]').first(),
  ).toHaveValue("500");
  await page
    .getByRole("button", { name: "تعديل المسيلة", exact: true })
    .click();
  await page.getByLabel("تفعيل توصيل المنزل", { exact: true }).check();
  await page.getByLabel("سعر المنزل بالدينار", { exact: true }).fill("650");
  await saved(page, "حفظ القاعدة");
  await page
    .getByRole("checkbox", { name: "تحديد الجزائر", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "تحديد المسيلة", exact: true })
    .check();
  await page.getByRole("button", { name: "تعديل جماعي", exact: true }).click();
  await page.getByLabel("سعر المنزل بالدينار", { exact: true }).fill("700");
  await saved(page, "تطبيق القاعدة على الولايات المحددة (2)");
  await expect(
    page.getByTestId("shipping-row-16").locator('input[type="number"]').first(),
  ).toHaveValue("700");
  await expect(
    page.getByTestId("shipping-row-28").locator('input[type="number"]').first(),
  ).toHaveValue("700");
  await saved(page, "منزل مجاني للمحدد");
  const communeId = isMobile ? "dz:commune:1023" : "dz:commune:1006";
  const quoteUrl = `/api/shipping/quote?mode=${mode}&wilayaCode=28&communeId=${communeId}&method=home`;
  expect((await (await request.get(quoteUrl)).json()).amount).toBe(0);
  page.once("dialog", (d) => void d.dismiss());
  await page
    .getByRole("button", { name: "إعادة ضبط المحدد", exact: true })
    .click();
  expect((await (await request.get(quoteUrl)).json()).amount).toBe(0);
  page.once("dialog", (d) => void d.accept());
  await saved(page, "إعادة ضبط المحدد");
  expect((await (await request.get(quoteUrl)).json()).amount).toBe(500);
  await page
    .getByRole("button", { name: "إضافة تجاوز بلدية", exact: true })
    .click();
  await page.getByLabel("ولاية تجاوز البلدية").selectOption("28");
  await page.getByLabel("بلدية التجاوز").selectOption(communeId);
  await page.getByLabel("تفعيل توصيل المنزل", { exact: true }).check();
  await page.getByLabel("سعر المنزل بالدينار", { exact: true }).fill("200");
  await saved(page, "حفظ القاعدة");
  await page.locator(".shipping-tester summary").click();
  await page.getByLabel("ولاية اختبار الشحن").selectOption("28");
  await page.getByLabel("بلدية اختبار الشحن").selectOption(communeId);
  await page.getByRole("button", { name: "حساب الشحن", exact: true }).click();
  await expect(page.getByTestId("shipping-quote")).toContainText(/200/);
  await expect(page.getByTestId("shipping-quote")).toContainText("البلدية");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "تصدير أسعار CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("shipping.csv");
  expect(readFileSync((await download.path())!, "utf8")).toContain("افتراضي");
  const csv =
    "\uFEFF" + csvHeaders.join(",") + "\r\nولاية,16,1,1,320.50,0,,يومان\r\n";
  await page.getByRole("button", { name: "استيراد CSV", exact: true }).click();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/shipping") && r.request().method() === "POST",
  );
  await page.getByLabel("استيراد CSV", { exact: false }).setInputFiles({
    name: "shipping.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "استيراد وحفظ", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByTestId("shipping-row-16").locator('input[type="number"]').first(),
  ).toHaveValue("320.5");
  const stored = await (await request.get(`/api/shipping?mode=${mode}`)).json();
  expect(
    stored.entries.find(
      (e: { scope: string; target: string }) =>
        e.scope === "wilaya" && e.target === "16",
    ).rule.home.price,
  ).toBe(320.5);
  await page.getByLabel("بحث الولايات", { exact: true }).fill("M'Sila");
  await expect(page.getByTestId("shipping-row-28")).toBeVisible();
  await expect(page.getByTestId("shipping-row-16")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/shipping-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("invalid shipping input is visible and client tenant changes are rejected", async ({
  page,
  request,
  isMobile,
}) => {
  await page.goto("/dashboard");
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "أسعار الشحن", exact: true }).click();
  await page
    .getByRole("button", { name: "إعداد السعر الافتراضي", exact: true })
    .click();
  await expect(page.getByLabel("نطاق القاعدة")).toBeVisible();
  await page.getByLabel("تفعيل توصيل المنزل", { exact: true }).check();
  await page.getByLabel("سعر المنزل بالدينار", { exact: true }).fill("-1");
  await page.getByRole("button", { name: "حفظ القاعدة", exact: true }).click();
  await expect(page.locator("dialog").getByRole("alert")).toContainText(
    "السعر يجب أن يكون غير سالب",
  );
  expect(
    (
      await request.post("/api/shipping", {
        headers: { origin: "http://127.0.0.1:3000" },
        data: {
          action: "settings",
          mode: "legacy58",
          revision: 0,
          genericOffice: true,
          merchantId: "another",
        },
      })
    ).status(),
  ).toBe(400);
});
