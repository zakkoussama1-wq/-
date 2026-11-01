import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type { ShippingState } from "../../src/modules/shipping/schema";
import { csvHeaders } from "../../src/modules/shipping/csv";
const origin = "http://127.0.0.1:3003";
const read = async (request: APIRequestContext): Promise<ShippingState> =>
  (await request.get("/api/shipping?mode=legacy58")).json();
async function change(request: APIRequestContext, action: object) {
  const state = await read(request);
  const response = await request.post("/api/shipping", {
    headers: { origin },
    data: { mode: "legacy58", revision: state.revision, ...action },
  });
  expect(response.ok()).toBe(true);
}
async function restore(request: APIRequestContext, original: ShippingState) {
  const current = await read(request);
  if (current.entries.length)
    await change(request, {
      action: "reset",
      targets: current.entries.map(({ scope, target }) => ({ scope, target })),
    });
  if (original.entries.length)
    await change(request, { action: "save", entries: original.entries });
  await change(request, {
    action: "settings",
    genericOffice: original.genericOffice,
  });
}
const locales = {
  ar: {
    menu: "فتح القائمة",
    nav: "أسعار الشحن",
    save: "حفظ التعديلات",
    pending: "تعديلات غير محفوظة",
    next: "التالي",
    previous: "السابق",
    home: "التوصيل إلى المنزل",
    office: "التوصيل إلى المكتب",
  },
  fr: {
    menu: "Ouvrir le menu",
    nav: "Tarifs de livraison",
    save: "Enregistrer les modifications",
    pending: "Modifications non enregistrées",
    next: "Suivant",
    previous: "Précédent",
    home: "Livraison à domicile",
    office: "Livraison au bureau",
  },
  en: {
    menu: "Open menu",
    nav: "Shipping rates",
    save: "Save changes",
    pending: "Unsaved changes",
    next: "Next",
    previous: "Previous",
    home: "Home delivery",
    office: "Office delivery",
  },
};
async function open(
  page: Page,
  isMobile: boolean,
  language: keyof typeof locales,
) {
  await page.goto("/dashboard");
  await page.locator("#app-language").selectOption(language);
  const words = locales[language];
  if (isMobile)
    await page.getByRole("button", { name: words.menu, exact: true }).click();
  await page.getByRole("button", { name: words.nav, exact: true }).click();
  await expect(page.locator("#shipping-page-size")).toBeEnabled();
}
for (const language of ["ar", "fr", "en"] as const) {
  test(`${language}: paginated editable shipping table preserves overrides and updates both customer methods`, async ({
    page,
    context,
    request,
    isMobile,
  }) => {
    const original = await read(request);
    const words = locales[language];
    const { items } = await (
      await request.get("/api/geography/communes?mode=legacy58&wilayaCode=16")
    ).json();
    const rule = {
      available: true,
      home: { enabled: true, price: 640 },
      office: { enabled: true, price: 420 },
      eta: "3 days",
    };
    try {
      await change(request, { action: "settings", genericOffice: true });
      await change(request, {
        action: "save",
        entries: [
          { scope: "wilaya", target: "16", rule },
          {
            scope: "commune",
            target: items[0].id,
            rule: {
              ...rule,
              home: { enabled: true, price: 125 },
              office: { enabled: true, price: 125 },
            },
          },
        ],
      });
      await open(page, isMobile, language);
      await expect(page.locator('[data-testid^="shipping-row-"]')).toHaveCount(
        20,
      );
      await page.getByTestId("shipping-row-16").getByRole("checkbox").check();
      await page.getByRole("button", { name: words.next, exact: true }).click();
      await expect(page.getByTestId("shipping-row-16")).toHaveCount(0);
      await page.getByTestId("shipping-row-21").getByRole("checkbox").check();
      await page
        .getByRole("button", { name: words.previous, exact: true })
        .click();
      await expect(
        page.getByTestId("shipping-row-16").getByRole("checkbox"),
      ).toBeChecked();
      await expect(page.locator(".shipping-selection > span")).toContainText(
        "2",
      );
      await page.locator(".shipping-table thead button").first().click();
      await expect(
        page.locator(".shipping-table tbody tr").first(),
      ).toHaveAttribute("data-testid", "shipping-row-58");
      await page.locator("#shipping-search").fill("16");
      const row = page.getByTestId("shipping-row-16");
      await row.locator('input[type="number"]').first().fill("730.5");
      await row.getByRole("switch").last().uncheck();
      await expect(
        page.getByText(words.pending, { exact: false }),
      ).toBeVisible();
      expect(
        (await read(request)).entries.find(
          (e) => e.scope === "wilaya" && e.target === "16",
        )?.rule,
      ).toEqual(rule);
      page.once("dialog", (dialog) => void dialog.dismiss());
      await page.locator("#shipping-mode").selectOption("updated69");
      await expect(page.locator("#shipping-mode")).toHaveValue("legacy58");
      await page.getByRole("button", { name: words.save, exact: true }).click();
      await expect(page.locator(".shipping-pending")).toHaveCount(0);
      let stored = await read(request);
      expect(
        stored.entries.find((e) => e.scope === "wilaya" && e.target === "16")
          ?.rule,
      ).toEqual({
        ...rule,
        home: { enabled: true, price: 730.5 },
        office: { enabled: false, price: 420 },
      });
      expect(
        stored.entries.find(
          (e) => e.scope === "commune" && e.target === items[0].id,
        )?.rule.home.price,
      ).toBe(125);
      const form = await context.newPage();
      await form.goto("/form");
      await form.locator("#wilaya").selectOption("16");
      await expect(form.locator("#commune")).toBeEnabled();
      await form.locator("#commune").selectOption(items[1].id);
      await form.getByRole("radio", { name: new RegExp(words.home) }).check();
      await expect(form.getByTestId("delivery-price")).toContainText(/730.*5/);
      await expect(
        form.getByRole("radio", { name: new RegExp(words.office) }),
      ).toBeDisabled();
      await row.getByRole("switch").last().check();
      await page.getByRole("button", { name: words.save, exact: true }).click();
      await expect(
        form.getByRole("radio", { name: new RegExp(words.office) }),
      ).toBeEnabled();
      await form.getByRole("radio", { name: new RegExp(words.office) }).check();
      await expect(form.getByTestId("delivery-price")).toContainText("420");
      await form.locator("#commune").selectOption(items[0].id);
      await expect(form.getByTestId("delivery-price")).toContainText("125");
      stored = await read(request);
      expect(
        stored.entries.find((e) => e.scope === "wilaya" && e.target === "16")
          ?.rule.eta,
      ).toBe("3 days");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await form.close();
    } finally {
      await restore(request, original);
    }
  });
}
for (const language of ["ar", "fr", "en"] as const) {
  test(`${language}: invalid inline prices, revision conflicts and invalid CSV never overwrite saved prices`, async ({
    page,
    request,
    isMobile,
  }) => {
    const original = await read(request);
    const words = locales[language];
    const ui =
      language === "ar"
        ? {
            reload: "إعادة تحميل الشحن",
            upload: "استيراد CSV",
            confirm: "استيراد وحفظ",
            negative: "السعر يجب أن يكون غير سالب",
            csv: "صف CSV رقم",
          }
        : language === "fr"
          ? {
              reload: "Recharger la livraison",
              upload: "Importer CSV",
              confirm: "Importer et enregistrer",
              negative: "Le prix ne peut pas être négatif",
              csv: "Ligne CSV n°",
            }
          : {
              reload: "Reload shipping",
              upload: "Import CSV",
              confirm: "Import and save",
              negative: "Price must not be negative",
              csv: "CSV row",
            };
    try {
      await open(page, isMobile, language);
      await page.locator("#shipping-search").fill("16");
      const input = page
        .getByTestId("shipping-row-16")
        .locator('input[type="number"]')
        .first();
      await input.fill("-1");
      await page.getByRole("button", { name: words.save, exact: true }).click();
      await expect(page.locator(".shipping-error")).toContainText(ui.negative);
      expect((await read(request)).revision).toBe(original.revision);
      await input.fill("777");
      const rule = {
        available: true,
        home: { enabled: true, price: 600 },
        office: { enabled: false, price: null },
        eta: "",
      };
      await change(request, {
        action: "save",
        entries: [{ scope: "wilaya", target: "16", rule }],
      });
      const conflict = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/shipping") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: words.save, exact: true }).click();
      expect((await conflict).status()).toBe(409);
      await expect(input).toHaveValue("777");
      expect(
        (await read(request)).entries.find(
          (e) => e.scope === "wilaya" && e.target === "16",
        )?.rule.home.price,
      ).toBe(600);
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: ui.reload, exact: true }).click();
      await expect(input).toHaveValue("600");
      await page.getByRole("button", { name: ui.upload, exact: true }).click();
      const beforeImport = await read(request);
      await page.locator("#shipping-csv").setInputFiles({
        name: "invalid.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          csvHeaders.join(",") +
            "\nولاية,16,1,1,100,0,,\nولاية,16,1,1,200,0,,\n",
        ),
      });
      expect((await read(request)).revision).toBe(beforeImport.revision);
      const imported = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/shipping") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: ui.confirm, exact: true }).click();
      expect((await imported).status()).toBe(400);
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
        ui.csv,
      );
      expect((await read(request)).entries).toEqual(beforeImport.entries);
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: ui.upload, exact: true }),
      ).toBeFocused();
    } finally {
      await restore(request, original);
    }
  });
}
