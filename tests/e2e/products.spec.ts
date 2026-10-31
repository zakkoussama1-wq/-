import { test, expect } from "@playwright/test";
test("merchant creates a real catalog product and the customer can select it", async ({
  page,
  request,
  isMobile,
}) => {
  await page.goto("/dashboard");
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "المنتجات", exact: true }).click();
  await page.getByRole("button", { name: "إضافة منتج", exact: true }).click();
  const name = `منتج اختبار ${isMobile ? "هاتف" : "حاسوب"} ${Date.now()}`;
  await page.getByLabel("اسم المنتج", { exact: true }).fill(name);
  await page.getByLabel("اسم الخيار 1", { exact: true }).fill("أزرق");
  await page.getByLabel("سعر الخيار 1", { exact: true }).fill("12.50");
  await page.getByLabel("مخزون الخيار 1", { exact: true }).fill("1");
  await page.getByRole("button", { name: "حفظ المنتج", exact: true }).click();
  await expect(
    page.getByText("تم حفظ المنتج وتحديث النموذج.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("المنتج المطلوب", { exact: true })
    .selectOption({ label: name });
  await expect(page.getByTestId("unit-price")).toContainText(/12.*50/);
  await expect(page.getByText("لا توجد صورة", { exact: true })).toBeVisible();
  const catalog = await (await request.get("/api/products")).json();
  const product = catalog.products.find(
    (p: { name: string }) => p.name === name,
  );
  expect(product.demo).toBe(false);
  expect(product.variants[0]).toMatchObject({ priceMinor: 1250, stock: 1 });
  const cleanup = await request.post("/api/products", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: {
      revision: catalog.revision,
      product: { ...product, active: false },
    },
  });
  expect(cleanup.status()).toBe(200);
  const publicCatalog = await (
    await request.get("/api/checkout/catalog")
  ).json();
  expect(
    publicCatalog.products.some((p: { id: string }) => p.id === product.id),
  ).toBe(false);
});
