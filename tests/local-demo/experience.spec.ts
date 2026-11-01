import { expect, test } from "@playwright/test";
const words = {
  ar: {
    nav: "أسعار الشحن",
    menu: "فتح القائمة",
    title: "أكمل معلومات طلبك",
    name: "الاسم الكامل",
    phone: "رقم الهاتف",
    address: "عنوان المنزل",
    save: "حفظ القاعدة",
    home: "التوصيل إلى المنزل",
    office: "التوصيل إلى المكتب",
    submit: "تأكيد الطلب وحفظه",
    error: "أدخل الاسم الكامل (٣ أحرف على الأقل)",
    orders: "الطلبات",
    fullName: "عميل تجربة عربية",
  },
  fr: {
    nav: "Tarifs de livraison",
    menu: "Ouvrir le menu",
    title: "Complétez votre commande",
    name: "Nom complet",
    phone: "Numéro de téléphone",
    address: "Adresse du domicile",
    save: "Enregistrer la règle",
    home: "Livraison à domicile",
    office: "Livraison au bureau",
    submit: "Confirmer et enregistrer la commande",
    error: "Saisissez votre nom complet (3 caractères minimum)",
    orders: "Commandes",
    fullName: "Client Démonstration",
  },
  en: {
    nav: "Shipping rates",
    menu: "Open menu",
    title: "Complete your order details",
    name: "Full name",
    phone: "Phone number",
    address: "Home address",
    save: "Save rule",
    home: "Home delivery",
    office: "Office delivery",
    submit: "Confirm and save order",
    error: "Enter your full name (at least 3 characters)",
    orders: "Orders",
    fullName: "Demo Customer",
  },
};
for (const language of ["ar", "fr", "en"] as const)
  test(`${language}: local form, home and office orders, all-wilaya rates and cross-tab updates`, async ({
    page,
    context,
    request,
    isMobile,
  }) => {
    const w = words[language];
    const failures: string[] = [];
    page.on("pageerror", (e) => failures.push(e.message));
    await page.goto("/form");
    await page.locator("#app-language").selectOption(language);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      language === "ar" ? "rtl" : "ltr",
    );
    await expect(
      page.getByRole("heading", { name: w.title, exact: true }),
    ).toBeVisible();
    await expect(page.locator("#checkout-product")).toHaveCount(0);
    await expect(page.locator("#product-variant")).toHaveCount(0);
    await expect(page.locator("#wilaya-search")).toHaveCount(0);
    await expect(page.locator("#commune-search")).toHaveCount(0);
    await expect(page.locator("#administrative-mode")).toHaveCount(0);
    await expect(page.locator("#wilaya option")).toHaveCount(59);
    await page.locator("#wilaya").selectOption("16");
    await expect(page.locator("#commune")).toBeEnabled();
    const commune = await page
      .locator("#commune option")
      .nth(1)
      .getAttribute("value");
    expect(commune).toBeTruthy();
    await page.locator("#commune").selectOption(commune!);
    await expect(
      page.getByRole("radio", { name: new RegExp(w.home) }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("radio", { name: new RegExp(w.office) }),
    ).not.toBeChecked();
    await page.getByRole("radio", { name: new RegExp(w.home) }).check();
    await expect(
      page.getByRole("button", { name: w.submit, exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: w.submit, exact: true }).click();
    await expect(page.getByText(w.error, { exact: true })).toBeVisible();
    await page.getByLabel(w.name, { exact: false }).fill(w.fullName);
    const suffix = language === "ar" ? "10" : language === "fr" ? "20" : "30";
    await page.getByLabel(w.phone, { exact: false }).fill("05500000" + suffix);
    await page
      .getByLabel(w.address, { exact: false })
      .fill("12 Rue de Test Alger");
    const formBox = await page.getByTestId("lead-form").boundingBox();
    expect(formBox!.height).toBeLessThan(800);
    await page.screenshot({
      path: `test-results-local/form-${language}-${test.info().project.name}.png`,
      fullPage: true,
    });
    const admin = await context.newPage();
    await admin.goto("/dashboard");
    await expect(admin.locator("html")).toHaveAttribute("lang", language);
    if (isMobile)
      await admin.getByRole("button", { name: w.menu, exact: true }).click();
    await admin.getByRole("button", { name: w.nav, exact: true }).click();
    await admin.locator("#shipping-page-size").selectOption("100");
    await expect(admin.getByTestId("shipping-row-16")).toBeVisible();
    await expect(admin.locator('[data-testid^="shipping-row-"]')).toHaveCount(
      58,
    );
    const homePrice = language === "ar" ? 611 : language === "fr" ? 622 : 633;
    await admin
      .getByRole("button", {
        name:
          language === "ar"
            ? "إعداد السعر الافتراضي"
            : language === "fr"
              ? "Configurer le tarif par défaut"
              : "Set default rate",
        exact: true,
      })
      .click();
    await admin.locator("#rate-home").fill(String(homePrice));
    await admin.locator("#rate-office").fill("377");
    const saved = admin.waitForResponse(
      (r) =>
        r.url().endsWith("/api/shipping") && r.request().method() === "POST",
    );
    await admin.getByRole("button", { name: w.save, exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(
      admin
        .getByTestId("shipping-row-16")
        .locator('input[type="number"]')
        .first(),
    ).toHaveValue(String(homePrice));
    await expect(
      admin
        .getByTestId("shipping-row-58")
        .locator('input[type="number"]')
        .first(),
    ).toHaveValue(String(homePrice));
    // The other tab updates from BroadcastChannel without a reload.
    await expect(page.getByTestId("delivery-price")).toContainText(
      String(homePrice),
    );
    await expect(
      page.getByRole("button", { name: w.submit, exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: w.submit, exact: true }).click();
    await expect(page.getByTestId("checkout-success")).toBeVisible();
    let data = await (await request.get("/api/orders")).json();
    expect(
      data.orders.some(
        (o: { customer: { name: string } }) => o.customer.name === w.fullName,
      ),
    ).toBe(true);
    await page.getByRole("radio", { name: new RegExp(w.office) }).check();
    await expect(page.getByLabel(w.address, { exact: false })).toHaveCount(0);
    await expect(page.getByTestId("delivery-price")).toContainText("377");
    await page.getByRole("button", { name: w.submit, exact: true }).click();
    await expect(page.getByTestId("checkout-success")).toBeVisible();
    data = await (await request.get("/api/orders")).json();
    const own = data.orders.filter(
      (o: { customer: { name: string } }) => o.customer.name === w.fullName,
    );
    expect(
      own.some(
        (o: { customer: { method: string } }) => o.customer.method === "home",
      ),
    ).toBe(true);
    expect(
      own.some(
        (o: { customer: { method: string } }) => o.customer.method === "office",
      ),
    ).toBe(true);
    if (isMobile)
      await admin.getByRole("button", { name: w.menu, exact: true }).click();
    await admin.getByRole("button", { name: w.orders, exact: true }).click();
    await expect(
      admin.getByText(w.fullName, { exact: false }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const blocked = await request.post("/api/integrations/shopify/start", {
      headers: { origin: "http://127.0.0.1:3003" },
      data: { shop: "leadformarab.myshopify.com" },
    });
    expect(blocked.status()).toBe(503);
    expect(failures).toEqual([]);
  });
