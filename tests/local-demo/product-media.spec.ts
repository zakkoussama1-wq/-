import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { messages } from "../../src/lib/messages";
const origin = "http://127.0.0.1:3003";
for (const language of ["ar", "fr", "en"] as const) {
  test(`${language}: upload, preview, reorder, replace, persist, duplicate and safely delete a product`, async ({
    page,
    request,
    isMobile,
  }) => {
    const t = (value: string) =>
      language === "ar" ? value : messages[value][language];
    const form = await (await request.get("/api/form-config")).json();
    const name = `Media test ${language} ${isMobile ? "mobile" : "desktop"}`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (lang) => localStorage.setItem("dz-language", lang),
      language,
    );
    async function products() {
      await page.goto("/dashboard");
      if (isMobile)
        await page
          .getByRole("button", { name: t("فتح القائمة"), exact: true })
          .click();
      await page
        .locator(".app-sidebar")
        .getByRole("button", { name: t("المنتجات"), exact: true })
        .click();
    }
    const files = await Promise.all(
      ["png", "jpeg", "webp"].map(async (format, index) => ({
        name: `untrusted-${index}.${format}`,
        mimeType: `image/${format}`,
        buffer: await sharp({
          create: {
            width: 64,
            height: 48,
            channels: 3,
            background: ["red", "blue", "green"][index],
          },
        })
          .toFormat(format as "png" | "jpeg" | "webp")
          .toBuffer(),
      })),
    );
    try {
      await products();
      await page
        .getByRole("button", { name: t("إضافة منتج"), exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("#product-name").fill(name);
      await dialog.locator("#product-sku").fill("SKU-TEST");
      await dialog
        .locator("#product-description")
        .fill("Persistent product description");
      await dialog.locator("#product-compare").fill("5000");
      await dialog
        .getByLabel(`${t("سعر الخيار")} 1`, { exact: true })
        .fill("125.50");
      await dialog
        .getByLabel(`${t("رمز الخيار SKU")} 1`, { exact: true })
        .fill("SKU-BLUE");
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let hold = true;
      await page.route("**/api/products/media", async (route) => {
        if (route.request().method() === "POST" && hold) {
          hold = false;
          await gate;
        }
        await route.continue();
      });
      await dialog.locator("#product-upload").setInputFiles(files.slice(0, 2));
      await expect(
        dialog
          .getByRole("img", { name: new RegExp(t("معاينة الصورة المختارة")) })
          .first(),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: t("حفظ المنتج"), exact: true }),
      ).toBeDisabled();
      release();
      await expect(dialog.locator(".product-media-editor")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(dialog.locator(".product-media-item")).toHaveCount(2);
      const originalUrl = await dialog
        .locator(".product-media-item img")
        .first()
        .getAttribute("src");
      await dialog
        .getByRole("button", {
          name: `${t("تعيين صورة رئيسية")} 2`,
          exact: true,
        })
        .click();
      await expect(
        dialog.locator(".product-media-item img").first(),
      ).not.toHaveJSProperty("src", new URL(originalUrl!, origin).href);
      await dialog
        .getByRole("button", { name: `${t("تأخير الصورة")} 1`, exact: true })
        .click();
      await expect(
        dialog.locator(".product-media-item img").first(),
      ).toHaveJSProperty("src", new URL(originalUrl!, origin).href);
      await dialog
        .locator("#product-upload")
        .dispatchEvent("cancel", { bubbles: true });
      await expect(dialog).toBeVisible();
      const picker = page.waitForEvent("filechooser");
      await dialog
        .getByRole("button", { name: `${t("استبدال الصورة")} 1`, exact: true })
        .click();
      await (await picker).setFiles(files[2]);
      await expect(dialog.locator(".product-media-editor")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(
        dialog.locator(".product-media-item img").first(),
      ).not.toHaveJSProperty("src", new URL(originalUrl!, origin).href);
      await dialog
        .getByRole("button", { name: `${t("إزالة الصورة")} 2`, exact: true })
        .click();
      await expect(dialog.locator(".product-media-item")).toHaveCount(1);
      await dialog.locator("#product-upload").setInputFiles({
        name: "unsafe.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      });
      await expect(dialog.getByRole("alert")).toContainText(
        t("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP."),
      );
      await dialog
        .locator("#product-image")
        .fill("https://unapproved.example/image.png");
      await dialog
        .getByRole("button", { name: t("استيراد الصورة"), exact: true })
        .click();
      await expect(dialog.getByRole("alert")).toContainText(
        t("مصدر الصورة غير مسموح. استخدم الرفع أو نطاقًا معتمدًا."),
      );
      await dialog
        .getByLabel(`${t("صورة الخيار")} 1`, { exact: true })
        .selectOption({ index: 1 });
      const imageUrl = await dialog
        .locator(".product-media-item img")
        .first()
        .getAttribute("src");
      await expect
        .poll(() =>
          dialog
            .locator(".product-media-item img")
            .first()
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBe(64);
      if (language === "ar")
        await page.screenshot({
          path: `${process.env.DZ_CAPTURE_MEDIA === "1" ? "docs/screenshots" : "test-results-local"}/media-phase1-editor-${isMobile ? "mobile" : "desktop"}.png`,
          fullPage: true,
          scale: "css",
        });
      await dialog
        .getByRole("button", { name: t("حفظ المنتج"), exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      let catalog = await (await request.get("/api/products")).json();
      const product = catalog.products.find(
        (p: { name: string }) => p.name === name,
      );
      expect(product).toMatchObject({
        sku: "SKU-TEST",
        description: "Persistent product description",
        compareAtMinor: 500000,
        imageUrl: new URL(imageUrl!, origin).pathname,
        images: [new URL(imageUrl!, origin).pathname],
        variants: [
          {
            sku: "SKU-BLUE",
            imageUrl: new URL(imageUrl!, origin).pathname,
            priceMinor: 12550,
          },
        ],
      });
      await products();
      await expect(
        page.locator(`[data-testid="product-row-${product.id}"] img`),
      ).toHaveJSProperty("src", new URL(imageUrl!, origin).href);
      await request.post("/api/form-config", {
        headers: { origin },
        data: {
          ...form,
          elements: { ...form.elements, productSelector: true },
        },
      });
      await page.goto("/form");
      await page.locator("#checkout-product").selectOption(product.id);
      await expect(page.locator(".lead-product img")).toHaveJSProperty(
        "src",
        new URL(imageUrl!, origin).href,
      );
      await expect
        .poll(() =>
          page
            .locator(".lead-product img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBe(64);
      await products();
      await page
        .getByRole("button", {
          name: `${t("نسخ المنتج")} ${name}`,
          exact: true,
        })
        .click();
      const clone = page.getByRole("dialog");
      await expect(clone.locator("#product-sku")).toHaveValue("");
      await clone.locator("#product-name").fill(name + " copy");
      await clone
        .getByRole("button", { name: t("حفظ المنتج"), exact: true })
        .click();
      await expect(clone).toHaveCount(0);
      catalog = await (await request.get("/api/products")).json();
      const copy = catalog.products.find(
        (p: { name: string }) => p.name === name + " copy",
      );
      expect(copy.id).not.toBe(product.id);
      expect(copy.variants[0].id).not.toBe(product.variants[0].id);
      await page
        .getByRole("button", { name: `${t("تعديل")} ${name}`, exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("حذف المنتج"), exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("تأكيد حذف المنتج"), exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId(`product-row-${product.id}`)).toHaveCount(
        0,
      );
      expect((await request.get(imageUrl!)).status()).toBe(200);
      expect((await request.get(originalUrl!)).status()).toBe(200);
      const publicCatalog = await (
        await request.get("/api/checkout/catalog")
      ).json();
      expect(
        publicCatalog.products.some((p: { id: string }) => p.id === product.id),
      ).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      try {
        let latest = await (await request.get("/api/products")).json();
        for (const item of latest.products.filter(
          (p: { name: string; deleted?: boolean }) =>
            !p.deleted && [name, name + " copy"].includes(p.name),
        )) {
          const response = await request.post("/api/products", {
            headers: { origin },
            data: {
              revision: latest.revision,
              product: { ...item, active: false, deleted: true },
            },
          });
          expect.soft(response.ok(), "Test product cleanup").toBeTruthy();
          if (response.ok()) latest = await response.json();
        }
      } catch (error) {
        if (!test.info().errors.length) expect.soft(error).toBeUndefined();
      }
      await request
        .post("/api/form-config", {
          headers: { origin },
          data: form,
        })
        .catch(() => null);
    }
  });
}
test("upload API rejects forged content, untrusted origins, oversized bodies and unsafe paths", async ({
  request,
}) => {
  const bad = await request.post("/api/products/media", {
    headers: { origin },
    multipart: {
      file: {
        name: "looks-safe.png",
        mimeType: "image/png",
        buffer: Buffer.from("<svg><script/></svg>"),
      },
    },
  });
  expect(bad.status()).toBe(400);
  expect(
    (
      await request.post("/api/products/media", {
        headers: { origin: "https://attacker.example" },
        data: { url: "https://images.unsplash.com/a" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/products/media", {
        headers: { origin },
        multipart: {
          file: {
            name: "big.png",
            mimeType: "image/png",
            buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
          },
        },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get("/media/not-an-image.webp")).status()).toBe(404);
});
