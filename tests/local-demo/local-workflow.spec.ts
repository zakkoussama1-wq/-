import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { messages } from "../../src/lib/messages";
const origin = "http://127.0.0.1:3003";
const directory =
  process.env.DZ_CAPTURE_LOCAL_WORKFLOW === "1"
    ? "docs/screenshots"
    : "test-results-local";
for (const language of ["ar", "fr", "en"] as const)
  test(`${language}: local product image to order snapshots and deduplicated advertising simulation`, async ({
    page,
    context,
    request,
    isMobile,
  }) => {
    test.setTimeout(90000);
    const t = (value: string) =>
      language === "ar" ? value : messages[value][language];
    const originalForm = await (await request.get("/api/form-config")).json();
    const originalShipping = await (
      await request.get("/api/shipping?mode=legacy58")
    ).json();
    const previousWilaya = originalShipping.entries.find(
      (e: { scope: string; target: string }) =>
        e.scope === "wilaya" && e.target === "16",
    );
    const originalSimulation = (
      await (await request.get("/api/advertising")).json()
    ).settings;
    const external: string[] = [];
    const errors: string[] = [];
    context.on("request", (r) => {
      if (r.url().startsWith("http") && !r.url().startsWith(origin))
        external.push(r.url());
    });
    context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    page.on("pageerror", (e) => errors.push(e.message));
    await context.addInitScript((lang) => {
      if (location.protocol === "http:" || location.protocol === "https:")
        localStorage.setItem("dz-language", lang);
    }, language);
    let productId = "";
    let formPage: Page | undefined;
    const name = `Local workflow ${language} ${isMobile ? "mobile" : "desktop"}`;
    const phone = `055333${language === "ar" ? "10" : language === "fr" ? "20" : "30"}${isMobile ? "1" : "0"}1`;
    const money = (minor: number) =>
      new Intl.NumberFormat(
        { ar: "ar-DZ", fr: "fr-DZ", en: "en-DZ" }[language],
        { style: "currency", currency: "DZD", maximumFractionDigits: 2 },
      ).format(minor / 100);
    async function navigate(section: string) {
      if (!(await page.locator(".app-sidebar").isVisible()))
        await page
          .getByRole("button", { name: t("فتح القائمة"), exact: true })
          .click();
      await page
        .locator(".app-sidebar")
        .getByRole("button", { name: t(section), exact: true })
        .click();
    }
    try {
      expect(
        (
          await request.post("/api/shipping", {
            headers: { origin },
            data: {
              action: "save",
              mode: "legacy58",
              revision: originalShipping.revision,
              entries: [
                {
                  scope: "wilaya",
                  target: "16",
                  rule: {
                    available: true,
                    home: { enabled: true, price: 500 },
                    office: { enabled: true, price: 350 },
                    eta: "",
                  },
                },
              ],
            },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await request.post("/api/form-config", {
            headers: { origin },
            data: {
              ...originalForm,
              featuredProductId: "demo-bag",
              featuredVariantId: "olive",
              officePickupInstructions: "Local pickup counter 12",
            },
          })
        ).ok(),
      ).toBe(true);
      await page.goto("/dashboard");
      await navigate("الإعلانات والتحويلات");
      await page
        .getByLabel(t("تفعيل المحاكاة المحلية"), { exact: true })
        .check();
      await page
        .getByRole("button", { name: t("حفظ إعدادات المحاكاة"), exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText(
        t("تم تحديث المحاكاة المحلية."),
      );
      await navigate("المنتجات");
      await page
        .getByRole("button", { name: t("إضافة منتج"), exact: true })
        .click();
      const editor = page.getByRole("dialog");
      await editor.locator("#product-name").fill(name);
      await editor.locator("#product-sku").fill("LOCAL-PRODUCT");
      await editor
        .locator("#product-description")
        .fill("Local image and immutable order details");
      const files = await Promise.all(
        ["red", "blue"].map(async (color) => ({
          name: color + ".png",
          mimeType: "image/png",
          buffer: await sharp({
            create: { width: 64, height: 48, channels: 3, background: color },
          })
            .png()
            .toBuffer(),
        })),
      );
      await editor.locator("#product-upload").setInputFiles(files);
      await expect(editor.locator(".product-media-editor")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await editor
        .getByRole("button", { name: t("إضافة خيار"), exact: true })
        .click();
      await editor
        .getByRole("button", { name: t("إضافة خيار"), exact: true })
        .click();
      for (const [index, label, amount, stock, image] of [
        [1, "Red", 1000, 20, 1],
        [2, "Blue", 1500, 20, 2],
        [3, "Sold out", 2000, 0, 2],
      ] as const) {
        await editor
          .getByLabel(`${t("اسم الخيار")} ${index}`, { exact: true })
          .fill(label);
        await editor
          .getByLabel(`${t("سعر الخيار")} ${index}`, { exact: true })
          .fill(String(amount));
        await editor
          .getByLabel(`${t("مخزون الخيار")} ${index}`, { exact: true })
          .fill(String(stock));
        await editor
          .getByLabel(`${t("رمز الخيار SKU")} ${index}`, { exact: true })
          .fill(`LOCAL-${label.toUpperCase()}`);
        await editor
          .getByLabel(`${t("صورة الخيار")} ${index}`, { exact: true })
          .selectOption({ index: image });
      }
      await editor
        .getByRole("button", { name: t("حفظ المنتج"), exact: true })
        .click();
      await expect(editor).toHaveCount(0);
      const catalog = await (await request.get("/api/products")).json();
      const product = catalog.products.find(
        (p: { name: string }) => p.name === name,
      );
      productId = product.id;
      const link = page
        .getByTestId(`product-row-${productId}`)
        .getByRole("link", {
          name: `${t("فتح نموذج المنتج")} ${name}`,
          exact: true,
        });
      await expect(link).toHaveAttribute("href", `/form?product=${productId}`);
      [formPage] = await Promise.all([
        context.waitForEvent("page"),
        link.click(),
      ]);
      await formPage.waitForLoadState();
      await formPage.goto(formPage.url() + "&gclid=LOCAL_TEST_CLICK");
      await expect(
        formPage.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      await expect(formPage.locator("#checkout-product")).toHaveCount(0);
      await expect(
        formPage.getByTestId("product-gallery-main").locator("img"),
      ).toHaveJSProperty("src", new URL(product.imageUrl, origin).href);
      await formPage
        .locator("#product-variant")
        .selectOption(product.variants[2].id);
      await expect(
        formPage.getByText(t("نفد هذا الخيار من المخزون."), { exact: true }),
      ).toBeVisible();
      await expect(
        formPage.getByRole("button", {
          name: t("تأكيد الطلب وحفظه"),
          exact: true,
        }),
      ).toBeDisabled();
      await formPage
        .locator("#product-variant")
        .selectOption(product.variants[1].id);
      await expect(
        formPage.getByTestId("product-gallery-main").locator("img"),
      ).toHaveJSProperty("src", new URL(product.images[1], origin).href);
      await expect(formPage.getByTestId("unit-price")).toHaveText(
        money(150000),
      );
      await formPage
        .getByRole("button", { name: `${t("عرض الصورة")} 2`, exact: true })
        .click();
      await formPage
        .locator("#product-variant")
        .selectOption(product.variants[0].id);
      await formPage
        .locator("#product-variant")
        .selectOption(product.variants[1].id);
      await formPage
        .getByRole("button", { name: t("زيادة الكمية"), exact: true })
        .click();
      const quantity = await formPage.locator("#quantity").boundingBox();
      const customerName = await formPage
        .locator("#customer-name")
        .boundingBox();
      expect(quantity!.y).toBeLessThan(customerName!.y);
      await formPage.locator("#wilaya-search").fill("Alger");
      await expect(formPage.locator("#wilaya option")).toHaveCount(2);
      await formPage.locator("#wilaya").selectOption("16");
      await expect(formPage.locator("#commune")).toBeEnabled();
      const commune = (await formPage
        .locator("#commune option")
        .nth(1)
        .getAttribute("value"))!;
      await formPage.locator("#commune").selectOption(commune);
      await formPage
        .getByRole("radio", { name: new RegExp(t("التوصيل إلى المنزل")) })
        .check();
      await formPage.locator("#customer-name").fill("Local test customer");
      await formPage.locator("#phone").fill(phone);
      await formPage.locator("#address").fill("12 Test Street, Alger");
      expect(
        (await (await request.get("/api/advertising")).json()).events.filter(
          (e: { productId: string }) => e.productId === productId,
        ),
      ).toEqual([]);
      await formPage
        .getByLabel(
          t(
            "أوافق على محاكاة أحداث الزيارة والطلب محليًا، دون إرسال بيانات إلى منصات الإعلانات.",
          ),
          { exact: true },
        )
        .check();
      await expect(formPage.getByTestId("final-total")).toHaveText(
        money(350000),
      );
      if (isMobile)
        expect(
          await formPage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      await formPage.screenshot({
        path: `${directory}/local-workflow-form-${language}-${isMobile ? "mobile" : "desktop"}.png`,
        fullPage: true,
        scale: "css",
      });
      const savedResponse = formPage.waitForResponse(
        (r) =>
          r.url().includes("/api/orders?") && r.request().method() === "POST",
      );
      await formPage
        .getByRole("button", { name: t("تأكيد الطلب وحفظه"), exact: true })
        .click();
      const response = await savedResponse;
      expect(response.status()).toBe(201);
      const saved = await response.json();
      await expect(formPage.getByTestId("checkout-reference")).toContainText(
        saved.orderId.slice(0, 8),
      );
      const payload = response.request().postDataJSON();
      const retry = await request.post(`/api/orders?product=${productId}`, {
        headers: {
          origin,
          "Idempotency-Key": response.request().headers()["idempotency-key"],
        },
        data: payload,
      });
      expect(retry.status()).toBe(200);
      expect((await retry.json()).orderId).toBe(saved.orderId);
      await formPage
        .locator("#product-variant")
        .selectOption(product.variants[0].id);
      await formPage
        .getByRole("button", { name: t("تقليل الكمية"), exact: true })
        .click();
      await formPage
        .getByRole("radio", { name: new RegExp(t("التوصيل إلى المكتب")) })
        .check();
      await expect(
        formPage.getByText("Local pickup counter 12", { exact: true }),
      ).toBeVisible();
      await expect(formPage.locator("#address")).toHaveCount(0);
      await formPage.locator("#phone").fill(phone.slice(0, -1) + "2");
      await expect(formPage.getByTestId("final-total")).toHaveText(
        money(135000),
      );
      const officeSaved = formPage.waitForResponse(
        (r) =>
          r.url().includes("/api/orders?") && r.request().method() === "POST",
      );
      await formPage
        .getByRole("button", { name: t("تأكيد الطلب وحفظه"), exact: true })
        .click();
      expect((await officeSaved).status()).toBe(201);
      const orders = (await (await request.get("/api/orders")).json()).orders;
      const order = orders.find((o: { id: string }) => o.id === saved.orderId);
      expect(order).toMatchObject({
        productName: name,
        productSku: "LOCAL-PRODUCT",
        variantName: "Blue",
        variantSku: "LOCAL-BLUE",
        productImageUrl: product.images[1],
        unitPriceMinor: 150000,
        customer: { quantity: 2, method: "home", phone },
        simulation: { attribution: { gclid: "LOCAL_TEST_CLICK" } },
      });
      const updatedCatalog = await (await request.get("/api/products")).json();
      const current = updatedCatalog.products.find(
        (p: { id: string }) => p.id === productId,
      );
      expect(
        (
          await request.post("/api/products", {
            headers: { origin },
            data: {
              revision: updatedCatalog.revision,
              product: {
                ...current,
                name: name + " edited",
                sku: "EDITED",
                imageUrl: undefined,
                images: [],
                variants: current.variants.map((v: { priceMinor: number }) => ({
                  ...v,
                  name: "Edited variant",
                  sku: "EDITED",
                  imageUrl: undefined,
                  priceMinor: v.priceMinor + 99999,
                })),
              },
            },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (await (await request.get("/api/orders")).json()).orders.find(
          (o: { id: string }) => o.id === order.id,
        ),
      ).toEqual(order);
      await navigate("الطلبات");
      await page.locator("#order-search").fill(order.id);
      const row = page.locator(".orders-table tbody tr").first();
      await expect(row.locator("img")).toHaveJSProperty(
        "src",
        new URL(product.images[1], origin).href,
      );
      await row
        .getByRole("button", { name: new RegExp(t("تفاصيل الطلب")) })
        .click();
      const details = page.getByRole("dialog");
      await expect(details).toContainText("LOCAL-PRODUCT");
      await expect(details).toContainText("LOCAL-BLUE");
      await expect(details).toContainText(money(350000));
      await expect(details.locator("img")).toHaveJSProperty(
        "src",
        new URL(product.images[1], origin).href,
      );
      if (language === "ar")
        await page.screenshot({
          path: `${directory}/local-workflow-order-${isMobile ? "mobile" : "desktop"}.png`,
          fullPage: true,
          scale: "css",
        });
      await details.getByRole("combobox").selectOption("confirmed");
      await expect
        .poll(
          async () =>
            (
              await (await request.get("/api/advertising")).json()
            ).events.filter(
              (e: { orderId: string; eventType: string }) =>
                e.orderId === order.id && e.eventType === "order_confirmed",
            ).length,
        )
        .toBe(5);
      await details
        .getByRole("button", { name: t("إغلاق النافذة"), exact: true })
        .click();
      await navigate("الإعلانات والتحويلات");
      const log = await (await request.get("/api/advertising")).json();
      const leadRows = log.events.filter(
        (e: { orderId: string; eventType: string }) =>
          e.orderId === order.id && e.eventType === "order_submitted",
      );
      expect(leadRows).toHaveLength(5);
      expect(
        leadRows.filter((e: { status: string }) => e.status === "simulated"),
      ).toHaveLength(3);
      expect(leadRows[0].payload.properties).toMatchObject({
        currency: "DZD",
        value: 3500,
        content_ids: ["LOCAL-BLUE"],
      });
      const text = JSON.stringify(log.events);
      for (const value of [
        phone,
        "Local test customer",
        "12 Test Street",
        "LOCAL_TEST_CLICK",
      ])
        expect(text).not.toContain(value);
      await page
        .getByLabel(t("محاكاة فشل المحاولة الأولى"), { exact: true })
        .check();
      const oldIds = new Set(
        log.events.map((e: { eventId: string }) => e.eventId),
      );
      await page
        .getByRole("button", { name: t("إنشاء حدث تجريبي"), exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (
              await (await request.get("/api/advertising")).json()
            ).events.filter(
              (e: { eventId: string; source: string }) =>
                e.source === "admin" && !oldIds.has(e.eventId),
            ).length,
        )
        .toBe(5);
      const failed = (
        await (await request.get("/api/advertising")).json()
      ).events.find(
        (e: { eventId: string; source: string }) =>
          e.source === "admin" && !oldIds.has(e.eventId),
      );
      const failedRow = page
        .locator(`tr[data-event-id="${failed.eventId}"]`)
        .first();
      await expect(failedRow).toContainText(t("فشل تجريبي"));
      await failedRow
        .getByRole("button", { name: t("إعادة محاولة نفس الحدث"), exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (
              await (await request.get("/api/advertising")).json()
            ).events.filter(
              (e: { eventId: string; status: string }) =>
                e.eventId === failed.eventId && e.status === "simulated",
            ).length,
        )
        .toBe(3);
      await failedRow
        .getByRole("button", { name: t("إعادة محاولة نفس الحدث"), exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await (await request.get("/api/advertising")).json()).events.find(
              (e: { eventId: string }) => e.eventId === failed.eventId,
            ).attempts,
        )
        .toBe(3);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (language === "ar")
        await page.screenshot({
          path: `${directory}/local-workflow-simulation-${isMobile ? "mobile" : "desktop"}.png`,
          fullPage: true,
          scale: "css",
        });
      await page
        .getByRole("button", { name: t("عرض الحمولة"), exact: true })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        '"providerConfirmed": false',
      );
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await formPage?.close();
      const shipping = await (
        await request.get("/api/shipping?mode=legacy58")
      ).json();
      await request.post("/api/shipping", {
        headers: { origin },
        data: {
          mode: "legacy58",
          revision: shipping.revision,
          ...(previousWilaya
            ? { action: "save", entries: [previousWilaya] }
            : {
                action: "reset",
                targets: [{ scope: "wilaya", target: "16" }],
              }),
        },
      });
      const latest = await (await request.get("/api/products")).json();
      const product = latest.products.find(
        (p: { id: string }) => p.id === productId,
      );
      if (product && !product.deleted)
        await request.post("/api/products", {
          headers: { origin },
          data: {
            revision: latest.revision,
            product: { ...product, active: false, deleted: true },
          },
        });
      await request.post("/api/form-config", {
        headers: { origin },
        data: originalForm,
      });
      const settings = (await (await request.get("/api/advertising")).json())
        .settings;
      await request.post("/api/advertising", {
        headers: { origin },
        data: {
          action: "settings",
          settings: { ...originalSimulation, revision: settings.revision },
        },
      });
    }
  });
test("missing or ambiguous product URLs never fall back to another catalog product", async ({
  page,
}) => {
  for (const path of [
    "/form?product=missing-product",
    "/form?product=demo-bag&product=other",
  ]) {
    await page.goto(path);
    await expect(
      page.getByTestId("lead-form").getByRole("alert"),
    ).toBeVisible();
    await expect(page.locator("#customer-name")).toHaveCount(0);
    await expect(page.getByTestId("unit-price")).toHaveCount(0);
  }
});
