import { test, expect } from "@playwright/test";
const id = "4a1446b0-ae66-47cf-9693-09133389da05";
for (const enabled of [false, true])
  test(`Shopify sync details and safe retry; enabled=${enabled}`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("dz-language", "ar"));
    let retried = false;
    const requests: unknown[] = [];
    await page.route("**/api/orders", (route) =>
      route.fulfill({
        json: {
          orders: [
            {
              id,
              merchantId: "synthetic-merchant",
              status: "submitted",
              createdAt: "2026-11-05T10:00:00Z",
              productName: "Synthetic product",
              variantName: "Default",
              unitPriceMinor: 120000,
              catalogSource: "shopify",
              customer: {
                name: "مستخدم اختباري",
                phone: "0551234567",
                address: "",
                productId: "gid://shopify/Product/1",
                variantId: "gid://shopify/ProductVariant/1",
                quantity: 1,
                mode: "legacy58",
                wilayaCode: "11",
                communeId: "dz:commune:359",
                method: "office",
              },
              quote: {
                unitPriceMinor: 120000,
                subtotalMinor: 120000,
                discountMinor: 0,
                methods: {
                  home: {
                    available: true,
                    amountMinor: 70000,
                    totalMinor: 190000,
                  },
                  office: {
                    available: true,
                    amountMinor: 55500,
                    totalMinor: 175500,
                  },
                },
              },
              shopifySync: {
                state: retried ? "queued" : "uncertain",
                enabled,
                shopifyOrderId: null,
                attempts: 1,
                errorCode: "AWAITING_REMOTE_RECONCILIATION",
              },
            },
          ],
        },
      }),
    );
    await page.route("**/api/orders/shopify-sync", async (route) => {
      requests.push(route.request().postDataJSON());
      retried = true;
      await route.fulfill({
        status: 202,
        json: { sync: { state: "uncertain" } },
      });
    });
    await page.goto("/dashboard");
    if (!(await page.locator(".app-sidebar").isVisible()))
      await page
        .getByRole("button", { name: "فتح القائمة", exact: true })
        .click();
    await page
      .locator(".app-sidebar")
      .getByRole("button", { name: "الطلبات", exact: true })
      .click();
    await page
      .getByRole("button", { name: "تفاصيل الطلب", exact: true })
      .click();
    const panel = page.getByRole("region", { name: "مزامنة طلب Shopify" });
    await expect(panel).toContainText("نتيجة غير مؤكدة");
    const retry = panel.getByRole("button", {
      name: "التحقق من نتيجة Shopify دون إنشاء جديد",
      exact: true,
    });
    if (enabled) {
      await retry.click();
      await expect(panel).toContainText("بانتظار المزامنة");
      expect(requests).toEqual([{ id }]);
    } else {
      await expect(retry).toBeDisabled();
      await expect(panel).toContainText("المزامنة معطلة؛ الطلب المحلي محفوظ.");
      expect(requests).toEqual([]);
    }
  });
