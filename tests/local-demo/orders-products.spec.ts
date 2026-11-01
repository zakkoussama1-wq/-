import { test, expect } from "@playwright/test";
for (const language of ["ar", "fr", "en"] as const)
  test(`${language}: product and order tables filter, sort, paginate and open accessible details`, async ({
    page,
    isMobile,
  }) => {
    const words =
      language === "ar"
        ? {
            menu: "فتح القائمة",
            products: "المنتجات",
            orders: "الطلبات",
            next: "التالي",
            details: "تفاصيل الطلب",
            edit: "تعديل",
          }
        : language === "fr"
          ? {
              menu: "Ouvrir le menu",
              products: "Produits",
              orders: "Commandes",
              next: "Suivant",
              details: "Détails de la commande",
              edit: "Modifier",
            }
          : {
              menu: "Open menu",
              products: "Products",
              orders: "Orders",
              next: "Next",
              details: "Order details",
              edit: "Edit",
            };
    await page.addInitScript(
      (lang) => localStorage.setItem("dz-language", lang),
      language,
    );
    const products = Array.from({ length: 12 }, (_, i) => ({
      id: `product-${i}`,
      name: `Product ${String(i).padStart(2, "0")}`,
      demo: false,
      active: i !== 0,
      variants: [
        {
          id: `variant-${i}`,
          name: "Blue",
          priceMinor: (i + 1) * 10000,
          stock: i,
        },
      ],
    }));
    await page.route("**/api/products", (route) =>
      route.fulfill({
        json: { revision: 1, discount: { type: "none", value: 0 }, products },
      }),
    );
    const orders = Array.from({ length: 12 }, (_, i) => ({
      id: `order-${i}`,
      status: "submitted",
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
      productName: "Test product",
      variantName: "Blue",
      customer: {
        name: `Customer ${i}`,
        phone: "0550000010",
        method: "home",
        mode: "legacy58",
        wilayaCode: "16",
        communeId: "dz:commune:1",
        quantity: 1,
        address: "Test address",
      },
      quote: {
        subtotalMinor: 10000,
        methods: { home: { totalMinor: 15000, amountMinor: 5000 } },
      },
    }));
    await page.route("**/api/orders", (route) =>
      route.fulfill({ json: { orders } }),
    );
    await page.goto("/dashboard");
    async function nav(name: string) {
      if (isMobile)
        await page
          .getByRole("button", { name: words.menu, exact: true })
          .click();
      await page.getByRole("button", { name, exact: true }).click();
    }
    await nav(words.products);
    await expect(page.locator(".products-page tbody tr")).toHaveCount(10);
    await page.getByRole("button", { name: words.next, exact: true }).click();
    await expect(page.locator(".products-page tbody tr")).toHaveCount(2);
    await page.locator(".products-page thead button").last().click();
    await expect(page.locator(".products-page tbody tr").first()).toContainText(
      "Product 00",
    );
    await page.locator(".data-search input").fill("Product 01");
    await expect(page.locator(".products-page tbody tr")).toHaveCount(1);
    await page
      .getByRole("button", { name: `${words.edit} Product 01`, exact: true })
      .click();
    await expect(page.getByRole("dialog").locator("#product-name")).toHaveValue(
      "Product 01",
    );
    await page.keyboard.press("Escape");
    await nav(words.orders);
    await expect(page.locator(".orders-table tbody tr")).toHaveCount(10);
    await page.locator("#order-search").fill("Customer 11");
    await expect(page.locator(".orders-table tbody tr")).toHaveCount(1);
    await page
      .getByRole("button", { name: words.details, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Test address");
    await expect(page.getByRole("dialog")).toContainText("Test product");
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("a saved customer order can be confirmed and cancelled from its details and stays terminal after reload", async ({
  page,
  request,
  isMobile,
}) => {
  await page.goto("/form");
  await page
    .getByLabel("الاسم الكامل", { exact: false })
    .fill("طلب تجربة المرحلة الثالثة");
  await page
    .getByLabel("رقم الهاتف", { exact: false })
    .fill(isMobile ? "0550000082" : "0550000081");
  await page.locator("#wilaya").selectOption("16");
  await expect(page.locator("#commune")).toBeEnabled();
  await page
    .locator("#commune")
    .selectOption(
      (await page.locator("#commune option").nth(1).getAttribute("value"))!,
    );
  await page.getByRole("radio", { name: /التوصيل إلى المنزل/ }).check();
  await page
    .getByLabel("عنوان المنزل", { exact: false })
    .fill("عنوان تجريبي فقط");
  await page
    .getByRole("button", { name: "تأكيد الطلب وحفظه", exact: true })
    .click();
  await expect(page.getByTestId("checkout-success")).toBeVisible();
  const { orders } = await (await request.get("/api/orders")).json();
  const order = orders.find(
    (o: { customer: { phone: string } }) =>
      o.customer.phone === (isMobile ? "0550000082" : "0550000081"),
  );
  expect(order).toBeTruthy();
  async function open() {
    await page.goto("/dashboard");
    if (isMobile)
      await page
        .getByRole("button", { name: "فتح القائمة", exact: true })
        .click();
    await page.getByRole("button", { name: "الطلبات", exact: true }).click();
    await page.locator("#order-search").fill(order.id);
    await page
      .getByRole("button", { name: "تفاصيل الطلب", exact: true })
      .click();
  }
  await open();
  const status = page.getByRole("dialog").locator("select");
  await status.selectOption("confirmed");
  await expect(status).toHaveValue("confirmed");
  await status.selectOption("cancelled");
  await expect(status).toBeDisabled();
  await page.keyboard.press("Escape");
  await open();
  await expect(status).toHaveValue("cancelled");
  await expect(status).toBeDisabled();
  await expect(page.locator(".data-location")).toContainText("الجزائر");
  await expect(page.getByRole("dialog")).toContainText("الإجمالي النهائي");
  await page.screenshot({
    path: `docs/screenshots/stage3-order-details-${isMobile ? "mobile" : "desktop"}.png`,
  });
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: `docs/screenshots/stage3-orders-${isMobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
  if (isMobile)
    await page
      .getByRole("button", { name: "فتح القائمة", exact: true })
      .click();
  await page.getByRole("button", { name: "المنتجات", exact: true }).click();
  await expect(page.locator(".products-page tbody tr").first()).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/stage3-products-${isMobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
});
