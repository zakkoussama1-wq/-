import { test, expect } from "@playwright/test";
import { defaultFormSettings } from "../../src/modules/forms/settings";
test("builder persists design and applies actual preview", async ({
  page,
  request,
  isMobile,
}) => {
  await page.goto("/dashboard");
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "منشئ النموذج", exact: true }).click();
  await page
    .getByLabel("عنوان النموذج", { exact: true })
    .fill("طلبك التجريبي المخصص");
  await page.getByRole("button", { name: "حفظ النموذج", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "طلبك التجريبي المخصص", exact: true }),
  ).toBeVisible();
  const r = await request.post("/api/form-config", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: defaultFormSettings,
  });
  expect(r.status()).toBe(200);
});
