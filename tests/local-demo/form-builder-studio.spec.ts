import { test, expect } from "@playwright/test";
import { defaultFormSettings } from "../../src/modules/forms/settings";
const captureDirectory =
  process.env.DZ_CAPTURE_REDESIGN === "1"
    ? "docs/screenshots"
    : "test-results-local";
const origin = "http://127.0.0.1:3003";
const words = {
  ar: {
    menu: "فتح القائمة",
    builder: "منشئ النموذج",
    title: "عنوان النموذج",
    undo: "التراجع عن التعديلات",
    reset: "استعادة التصميم الافتراضي",
    resetDraft: "استعادة في المحرر",
    save: "حفظ النموذج",
  },
  fr: {
    menu: "Ouvrir le menu",
    builder: "Éditeur de formulaire",
    title: "Titre du formulaire",
    undo: "Annuler les modifications",
    reset: "Restaurer le modèle par défaut",
    resetDraft: "Réinitialiser le brouillon",
    save: "Enregistrer le formulaire",
  },
  en: {
    menu: "Open menu",
    builder: "Form builder",
    title: "Form title",
    undo: "Undo unsaved changes",
    reset: "Restore default design",
    resetDraft: "Reset draft",
    save: "Save form",
  },
};
for (const language of ["ar", "fr", "en"] as const)
  test(`${language}: builder keyboard, palette, undo, safe reset and single save update the public form`, async ({
    page,
    context,
    request,
    isMobile,
  }) => {
    const original = await (await request.get("/api/form-config")).json();
    const baseline = { ...defaultFormSettings, title: "تصميم محفوظ للتحقق" };
    const w = words[language];
    const post = (data: unknown) =>
      request.post("/api/form-config", { headers: { origin }, data });
    expect((await post(baseline)).ok()).toBe(true);
    const ordersBefore = (await (await request.get("/api/orders")).json())
      .orders.length;
    let writes = 0;
    let hold = false;
    let failNextSave = false;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/form-config", async (route) => {
      if (route.request().method() === "POST") {
        writes++;
        if (failNextSave) {
          failNextSave = false;
          await route.fulfill({ status: 503, json: {} });
          return;
        }
        if (hold) await gate;
      }
      await route.continue();
    });
    try {
      await page.goto("/dashboard");
      await page.locator("#app-language").selectOption(language);
      if (isMobile)
        await page.getByRole("button", { name: w.menu, exact: true }).click();
      await page.getByRole("button", { name: w.builder, exact: true }).click();
      const title = page.getByLabel(w.title, { exact: true });
      await expect(title).toHaveValue(baseline.title);
      await expect(
        page.getByRole("button", { name: w.undo, exact: true }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".studio-preview #wilaya")).toBeEnabled();
      if (!isMobile || language === "ar")
        await page.screenshot({
          path: `${captureDirectory}/stage4-builder-${language}-${isMobile ? "mobile" : "desktop"}.png`,
          fullPage: true,
          scale: "css",
        });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page
        .getByRole("button", {
          name:
            language === "ar"
              ? "انتقل إلى المعاينة"
              : language === "fr"
                ? "Aller à l’aperçu"
                : "Go to preview",
          exact: true,
        })
        .click();
      await expect(page.locator(".studio-preview")).toBeFocused();
      await title.fill("مسودة لا تحفظ بعد");
      await expect(
        page.getByRole("heading", { name: "مسودة لا تحفظ بعد", exact: true }),
      ).toBeVisible();
      expect((await (await request.get("/api/form-config")).json()).title).toBe(
        baseline.title,
      );
      await page.getByRole("button", { name: w.undo, exact: true }).click();
      await expect(title).toHaveValue(baseline.title);
      await page.locator("#studio-tab-content").focus();
      await page.keyboard.press("End");
      await expect(page.locator("#studio-tab-delivery")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.keyboard.press("Home");
      await expect(page.locator("#studio-tab-content")).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(
        page.locator(
          language === "ar" ? "#studio-tab-delivery" : "#studio-tab-fields",
        ),
      ).toHaveAttribute("aria-selected", "true");
      await page.locator("#studio-tab-design").click();
      const palette = [
        {
          ar: "أخضر",
          fr: "Vert",
          en: "Green",
          color: "rgb(0, 128, 96)",
          foreground: "rgb(255, 255, 255)",
        },
        {
          ar: "أحمر",
          fr: "Rouge",
          en: "Red",
          color: "rgb(220, 38, 38)",
          foreground: "rgb(255, 255, 255)",
        },
        {
          ar: "أصفر",
          fr: "Jaune",
          en: "Yellow",
          color: "rgb(250, 204, 21)",
          foreground: "rgb(17, 24, 39)",
        },
        {
          ar: "أزرق",
          fr: "Bleu",
          en: "Blue",
          color: "rgb(37, 99, 235)",
          foreground: "rgb(255, 255, 255)",
        },
        {
          ar: "برتقالي",
          fr: "Orange",
          en: "Orange",
          color: "rgb(249, 115, 22)",
          foreground: "rgb(17, 24, 39)",
        },
      ];
      const submit = page.locator(".studio-preview .lead-submit");
      for (const color of palette) {
        await page
          .getByRole("button", { name: color[language], exact: true })
          .click();
        await expect(submit).toHaveCSS("background-color", color.color);
        await expect(submit).toHaveCSS("color", color.foreground);
        await expect(submit).toBeDisabled();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      if (language === "ar")
        await page.screenshot({
          path: `${captureDirectory}/stage4-design-${isMobile ? "mobile" : "desktop"}.png`,
          fullPage: true,
          scale: "css",
        });
      await page.getByRole("button", { name: w.reset, exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      if (!isMobile && language === "ar")
        await page.screenshot({
          path: `${captureDirectory}/stage4-reset-dialog.png`,
          scale: "css",
        });
      await page.keyboard.press("Escape");
      await expect(submit).toHaveCSS("background-color", "rgb(249, 115, 22)");
      await page.getByRole("button", { name: w.reset, exact: true }).click();
      await page
        .getByRole("button", { name: w.resetDraft, exact: true })
        .click();
      await expect(submit).toHaveCSS("background-color", "rgb(0, 128, 96)");
      expect((await (await request.get("/api/form-config")).json()).title).toBe(
        baseline.title,
      );
      expect(writes).toBe(0);
      await page.getByRole("button", { name: w.undo, exact: true }).click();
      await page.locator("#studio-tab-content").click();
      const changedTitle = `  تصميم المرحلة الرابعة ${language}  `;
      await title.fill(changedTitle);
      failNextSave = true;
      await page.getByRole("button", { name: w.save, exact: true }).click();
      await expect(
        page.locator(".studio-toolbar").getByRole("alert"),
      ).toBeVisible();
      await expect(title).toHaveValue(changedTitle);
      expect((await (await request.get("/api/form-config")).json()).title).toBe(
        baseline.title,
      );
      hold = true;
      await title.focus();
      await page.keyboard.press("Control+s");
      await expect(
        page.getByRole("button", { name: /جارٍ الحفظ|Saving|Enregistrement/ }),
      ).toBeDisabled();
      await page.keyboard.press("Control+s");
      expect(writes).toBe(2);
      release();
      await expect(
        page.getByRole("button", { name: w.save, exact: true }),
      ).toBeEnabled();
      await expect(title).toHaveValue(changedTitle.trim());
      await expect(
        page.getByRole("button", { name: w.undo, exact: true }),
      ).toBeDisabled();
      expect((await (await request.get("/api/form-config")).json()).title).toBe(
        changedTitle.trim(),
      );
      const customer = await context.newPage();
      await customer.goto("/form");
      await expect(
        customer.getByRole("heading", {
          name: changedTitle.trim(),
          exact: true,
        }),
      ).toBeVisible();
      await customer.close();
      expect(
        (await (await request.get("/api/orders")).json()).orders.length,
      ).toBe(ordersBefore);
    } finally {
      release();
      await post(original);
    }
  });
test("builder read failure never displays default settings and can retry safely", async ({
  page,
  request,
  isMobile,
}) => {
  const original = await (await request.get("/api/form-config")).json();
  let failing = true;
  await page.route("**/api/form-config", (route) =>
    failing && route.request().method() === "GET"
      ? route.fulfill({ status: 503, json: {} })
      : route.continue(),
  );
  await page.goto("/dashboard");
  if (isMobile)
    await page
      .getByRole("button", { name: "فتح القائمة", exact: true })
      .click();
  await page.getByRole("button", { name: "منشئ النموذج", exact: true }).click();
  await expect(page.locator(".form-studio").getByRole("alert")).toHaveText(
    "تعذر تحميل الإعدادات.",
  );
  await expect(page.locator(".studio-preview")).toHaveCount(0);
  await expect(page.getByLabel("عنوان النموذج", { exact: true })).toHaveCount(
    0,
  );
  failing = false;
  await page
    .getByRole("button", { name: "إعادة تحميل الإعدادات", exact: true })
    .click();
  await expect(page.getByLabel("عنوان النموذج", { exact: true })).toHaveValue(
    original.title,
  );
});
