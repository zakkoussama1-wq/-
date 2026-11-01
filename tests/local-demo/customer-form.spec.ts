import { test, expect } from "@playwright/test";
import { defaultFormSettings } from "../../src/modules/forms/settings";
const origin = "http://127.0.0.1:3003";
const captureDirectory =
  process.env.DZ_CAPTURE_REDESIGN === "1"
    ? "docs/screenshots"
    : "test-results-local";
const words = {
  ar: {
    name: "الاسم الكامل",
    phone: "رقم الهاتف",
    address: "عنوان المنزل",
    home: "التوصيل إلى المنزل",
    office: "التوصيل إلى المكتب",
    submit: "تأكيد الطلب وحفظه",
    quantity: "زيادة الكمية",
    invalid: "أدخل الاسم الكامل (٣ أحرف على الأقل)",
  },
  fr: {
    name: "Nom complet",
    phone: "Numéro de téléphone",
    address: "Adresse du domicile",
    home: "Livraison à domicile",
    office: "Livraison au bureau",
    submit: "Confirmer et enregistrer la commande",
    quantity: "Augmenter la quantité",
    invalid: "Saisissez votre nom complet (3 caractères minimum)",
  },
  en: {
    name: "Full name",
    phone: "Phone number",
    address: "Home address",
    home: "Home delivery",
    office: "Office delivery",
    submit: "Confirm and save order",
    quantity: "Increase quantity",
    invalid: "Enter your full name (at least 3 characters)",
  },
};
for (const language of ["ar", "fr", "en"] as const)
  test(`${language}: premium checkout validates, prices both methods and displays real saved order references`, async ({
    page,
    request,
    isMobile,
  }) => {
    const original = await (await request.get("/api/form-config")).json();
    const w = words[language];
    const config = {
      ...defaultFormSettings,
      elements: { ...defaultFormSettings.elements, locationSearch: true },
    };
    expect(
      (
        await request.post("/api/form-config", {
          headers: { origin },
          data: config,
        })
      ).ok(),
    ).toBe(true);
    const phone = `0552222${language === "ar" ? "10" : language === "fr" ? "20" : "30"}${isMobile ? "1" : "0"}`;
    const money = (minor: number) =>
      new Intl.NumberFormat(`${language}-DZ`, {
        style: "currency",
        currency: "DZD",
        maximumFractionDigits: 2,
      }).format(minor / 100);
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      let failNextOrder = true;
      const attemptKeys: string[] = [];
      await page.route("**/api/orders", async (route) => {
        if (route.request().method() === "POST") {
          attemptKeys.push(route.request().headers()["idempotency-key"]);
          if (failNextOrder) {
            failNextOrder = false;
            await route.abort("failed");
            return;
          }
        }
        await route.continue();
      });
      await page.goto("/form");
      await page.locator("#app-language").selectOption(language);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        language === "ar" ? "rtl" : "ltr",
      );
      await page.locator("#wilaya-search").fill("Alger");
      await expect(page.locator("#wilaya option")).toHaveCount(2);
      await page.locator("#wilaya").selectOption("16");
      await expect(page.locator("#commune")).toBeEnabled();
      const commune = (await page
        .locator("#commune option")
        .nth(1)
        .getAttribute("value"))!;
      await page.locator("#commune").selectOption(commune);
      const home = page.getByRole("radio", { name: new RegExp(w.home) });
      const office = page.getByRole("radio", { name: new RegExp(w.office) });
      await expect(home).toBeEnabled();
      await expect(home).not.toBeChecked();
      await expect(office).not.toBeChecked();
      await home.check();
      const submit = page.getByRole("button", { name: w.submit, exact: true });
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page.getByText(w.invalid, { exact: true })).toBeVisible();
      await page
        .getByLabel(w.name, { exact: false })
        .fill(
          language === "ar"
            ? "عميل تجربة النموذج الجديد"
            : "Test checkout customer",
        );
      await page.getByLabel(w.phone, { exact: false }).fill(phone);
      await page
        .getByLabel(w.address, { exact: false })
        .fill("12 Test Street, Alger");
      const quoted = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/checkout/quote") &&
          response.request().postDataJSON()?.quantity === 2,
      );
      await page.getByRole("button", { name: w.quantity, exact: true }).click();
      const quote = await (await quoted).json();
      await expect(page.getByTestId("final-total")).toHaveText(
        money(quote.methods.home.totalMinor),
      );
      await expect(submit).toBeEnabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${captureDirectory}/stage5-form-${language}-${isMobile ? "mobile" : "desktop"}.png`,
        fullPage: true,
        scale: "css",
      });
      await submit.click();
      const networkError =
        language === "ar"
          ? "تعذر التحقق من الطلب. أعد المحاولة."
          : language === "fr"
            ? "Impossible de valider la commande. Réessayez."
            : "Could not validate the order. Try again.";
      await expect(
        page.getByTestId("lead-form").getByRole("alert"),
      ).toContainText(networkError);
      await expect(page.getByLabel(w.phone, { exact: false })).toHaveValue(
        phone,
      );
      await expect(page.getByTestId("checkout-success")).toHaveCount(0);
      const savedHome = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/orders") &&
          response.request().method() === "POST",
      );
      await submit.click();
      const homeResponse = await savedHome;
      expect(homeResponse.status()).toBe(201);
      const homeReceipt = await homeResponse.json();
      expect(attemptKeys).toHaveLength(2);
      expect(attemptKeys[0]).toBe(attemptKeys[1]);
      await expect(page.getByTestId("checkout-reference")).toContainText(
        homeReceipt.orderId.slice(0, 8),
      );
      await expect(submit).toBeDisabled();
      await office.check();
      await expect(page.locator("#address")).toHaveCount(0);
      await expect(page.getByTestId("checkout-success")).toHaveCount(0);
      await expect(page.getByTestId("final-total")).toHaveText(
        money(quote.methods.office.totalMinor),
      );
      const savedOffice = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/orders") &&
          response.request().method() === "POST",
      );
      await submit.click();
      const officeResponse = await savedOffice;
      expect(officeResponse.status()).toBe(201);
      const officeReceipt = await officeResponse.json();
      await expect(page.getByTestId("checkout-reference")).toContainText(
        officeReceipt.orderId.slice(0, 8),
      );
      const { orders } = await (await request.get("/api/orders")).json();
      const storedHome = orders.find(
        (o: { id: string }) => o.id === homeReceipt.orderId,
      );
      const storedOffice = orders.find(
        (o: { id: string }) => o.id === officeReceipt.orderId,
      );
      expect(storedHome.customer).toMatchObject({
        phone,
        quantity: 2,
        method: "home",
        communeId: commune,
      });
      expect(storedOffice.customer).toMatchObject({
        phone,
        quantity: 2,
        method: "office",
        address: "",
      });
      expect(storedHome.quote.methods.home.totalMinor).toBe(
        quote.methods.home.totalMinor,
      );
      expect(storedOffice.quote.methods.office.totalMinor).toBe(
        quote.methods.office.totalMinor,
      );
      if (language === "ar")
        await page.screenshot({
          path: `${captureDirectory}/stage5-success-${isMobile ? "mobile" : "desktop"}.png`,
          fullPage: true,
          scale: "css",
        });
    } finally {
      await request.post("/api/form-config", {
        headers: { origin },
        data: original,
      });
    }
  });
test("loading and failed catalog reads never show an order form with invented product data", async ({
  page,
}) => {
  let failing = true;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/checkout/catalog", async (route) => {
    if (failing) {
      await gate;
      await route.fulfill({ status: 503, json: {} });
    } else await route.continue();
  });
  try {
    await page.goto("/form");
    await expect(page.locator(".lead-loading")).toBeVisible();
    await expect(page.locator("#customer-name")).toHaveCount(0);
    release();
    await expect(
      page.getByTestId("lead-form").getByRole("alert"),
    ).toBeVisible();
    await expect(page.locator(".lead-loading")).toHaveCount(0);
    await expect(page.locator("#customer-name")).toHaveCount(0);
    failing = false;
    await page
      .getByRole("button", { name: "إعادة تحميل المنتج", exact: true })
      .click();
    await expect(page.locator("#customer-name")).toBeVisible();
  } finally {
    release();
  }
});
test("builder and interactive preview have separate labels and radio groups", async ({
  page,
  request,
  isMobile,
}) => {
  const original = await (await request.get("/api/form-config")).json();
  expect(
    (
      await request.post("/api/form-config", {
        headers: { origin },
        data: defaultFormSettings,
      })
    ).ok(),
  ).toBe(true);
  try {
    await page.goto("/dashboard");
    if (isMobile)
      await page
        .getByRole("button", { name: "فتح القائمة", exact: true })
        .click();
    await page
      .getByRole("button", { name: "منشئ النموذج", exact: true })
      .click();
    await expect(page.locator("#preview-customer-name")).toBeVisible();
    await page
      .getByRole("button", { name: "معاينة نموذج الطلب", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "معاينة نموذج الطلب",
      exact: true,
    });
    await dialog
      .getByLabel("الاسم الكامل", { exact: false })
      .fill("عميل المعاينة التفاعلية");
    await expect(page.locator("#preview-customer-name")).toHaveValue("");
    await expect(page.locator("#customer-name")).toHaveValue(
      "عميل المعاينة التفاعلية",
    );
    await expect(page.locator("#wilaya")).toHaveCount(1);
    await expect(page.locator("#preview-wilaya")).toHaveCount(1);
    await dialog.locator("#wilaya").selectOption("16");
    await expect(dialog.locator("#commune")).toBeEnabled();
    await dialog
      .locator("#commune")
      .selectOption(
        (await dialog.locator("#commune option").nth(1).getAttribute("value"))!,
      );
    await dialog.getByRole("radio", { name: /التوصيل إلى المنزل/ }).check();
    await expect(
      page.locator('input[name="preview-delivery-method"]:checked'),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("radio", { name: /التوصيل إلى المنزل/ }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
  } finally {
    await request.post("/api/form-config", {
      headers: { origin },
      data: original,
    });
  }
});
