import { test, expect } from "@playwright/test";
test("dependent bilingual selectors and administrative remapping", async ({
  page,
}) => {
  await page.goto("/");
  const wilaya = page.getByLabel("الولاية", { exact: true });
  const commune = page.getByLabel("البلدية", { exact: true });
  await expect(commune).toBeDisabled();
  await expect(wilaya.locator("option")).toHaveCount(59);
  await page.getByLabel("البحث عن ولاية بالعربية أو الفرنسية").fill("M'Sila");
  await expect(wilaya.locator("option")).toHaveCount(2);
  await wilaya.selectOption("28");
  await expect(commune.locator("option")).toHaveCount(48);
  await expect(
    commune.locator('option[value="dz:commune:1006"]'),
  ).toContainText("بوسعادة");
  await expect(commune.locator('option[value="dz:commune:996"]')).toContainText(
    "عين الملح",
  );
  await page
    .getByLabel("البحث عن بلدية بالعربية أو الفرنسية")
    .fill("Aïn El Melh");
  await expect(commune.locator("option")).toHaveCount(2);
  await commune.selectOption("dz:commune:996");
  await page.getByLabel("البحث عن ولاية بالعربية أو الفرنسية").fill("Alger");
  await expect(wilaya.locator('option[value="16"]')).toHaveCount(1);
  await wilaya.selectOption("16");
  await expect(commune).toHaveValue("");
  await expect(commune.locator('option[value="dz:commune:996"]')).toHaveCount(
    0,
  );
  await page
    .getByLabel("التقسيم الإداري", { exact: true })
    .selectOption("updated69");
  await expect(wilaya).toHaveValue("");
  await expect(commune).toHaveValue("");
  await expect(commune).toBeDisabled();
  await expect(wilaya.locator("option")).toHaveCount(70);
  await wilaya.selectOption("68");
  await expect(commune.locator("option")).toHaveCount(24);
  await commune.selectOption("dz:commune:1006");
  await page
    .getByLabel("التقسيم الإداري", { exact: true })
    .selectOption("legacy58");
  await expect(commune).toHaveValue("");
  await expect(wilaya.locator("option")).toHaveCount(59);
  await page
    .getByLabel("البحث عن ولاية بالعربية أو الفرنسية")
    .fill("المَسِيلَة");
  await expect(wilaya.locator("option")).toHaveCount(2);
  await wilaya.selectOption("28");
  await page
    .getByLabel("البحث عن بلدية بالعربية أو الفرنسية")
    .fill("مكانغيرموجود");
  await expect(
    page.getByText("لا توجد بلدية مطابقة ضمن هذه الولاية."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("geography failure exposes retry and recovers without demo fallback", async ({
  page,
}) => {
  await page.route("**/api/geography/wilayas?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "تعذر التحميل" }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByText("تعذر تحميل القائمة. أعد المحاولة."),
  ).toBeVisible();
  await expect(page.getByLabel("الولاية", { exact: true })).toBeDisabled();
  await page.unroute("**/api/geography/wilayas?*");
  await page.getByRole("button", { name: "إعادة تحميل المواقع" }).click();
  await expect(page.getByLabel("الولاية", { exact: true })).toBeEnabled();
  await expect(
    page.getByLabel("الولاية", { exact: true }).locator("option"),
  ).toHaveCount(59);
});
test("HTTP API enforces mode and wilaya boundaries", async ({ request }) => {
  const response = await request.get(
    "/api/geography/communes?mode=legacy58&wilayaCode=28&q=Bou%20Saada",
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).items[0].id).toBe("dz:commune:1006");
  expect(
    (
      await request.get("/api/geography/communes?mode=legacy58&wilayaCode=68")
    ).status(),
  ).toBe(400);
});
