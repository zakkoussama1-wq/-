import { test, expect, type Page } from "@playwright/test";
import {
  defaultFormSettings,
  formSettingsSchema,
} from "../../src/modules/forms/settings";
const product = {
  id: "gid://shopify/Product/7",
  name: "منتج اختبار آمن",
  active: true,
  demo: false,
  variants: [
    {
      id: "gid://shopify/ProductVariant/71",
      name: "Default",
      priceMinor: 120000,
      stock: 100,
    },
  ],
};
async function setup(
  page: Page,
  options: { expired?: boolean; storageBlocked?: boolean } = {},
) {
  let settings = {
    ...defaultFormSettings,
    elements: { ...defaultFormSettings.elements, variant: true },
  };
  const calls: {
    op: string;
    method: string;
    authorization: string;
    cookie: string;
    body: unknown;
  }[] = [];
  if (options.storageBlocked)
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("fixture storage blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("fixture storage blocked");
      };
    });
  await page.route(
    "https://cdn.shopify.com/shopifycloud/app-bridge.js",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'window.__bridgeTokens=0;window.shopify={idToken:async()=>"fixture-session-"+(++window.__bridgeTokens)};customElements.define("ui-nav-menu",class extends HTMLElement{});',
      }),
  );
  await page.route("**/api/embedded/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      op = url.pathname.slice("/api/embedded/".length),
      method = req.method(),
      body = method === "POST" ? req.postDataJSON() : null;
    const authorization = req.headers().authorization ?? "",
      cookie = req.headers().cookie ?? "";
    calls.push({ op, method, authorization, cookie, body });
    expect(authorization).toMatch(/^Bearer fixture-session-/);
    expect(cookie).toBe("");
    if (options.expired)
      return route.fulfill({
        status: 401,
        json: { code: "EMBEDDED_SESSION_INVALID" },
      });
    if (op === "session")
      return route.fulfill({
        json: { connected: true, shop: "fixture.myshopify.com" },
      });
    if (op === "form-config") {
      if (method === "POST") settings = formSettingsSchema.parse(body);
      return route.fulfill({
        json: method === "GET" ? settings : { saved: true },
      });
    }
    if (op === "catalog")
      return route.fulfill({
        json: {
          products: [product],
          discount: { type: "none", value: 0 },
          revision: 1,
        },
      });
    if (op === "integrations")
      return route.fulfill({
        json: {
          readProductsGranted: true,
          writeOrdersGranted: true,
          offline: true,
        },
      });
    if (op === "shipping")
      return route.fulfill({
        json: {
          mode: "legacy58",
          revision: 1,
          genericOffice: true,
          entries: [],
          communeNames: {},
          communeParents: {},
        },
      });
    if (op === "wilayas")
      return route.fulfill({
        json: {
          items: [
            {
              id: "dz:wilaya:11",
              code: "11",
              nameAr: "تمنراست",
              nameLatin: "Tamanrasset",
            },
          ],
          mode: "legacy58",
          verification: "source-reviewed",
        },
      });
    if (op === "preview/bootstrap")
      return route.fulfill({
        json: {
          phase: 2,
          submission: "validate_only",
          context: "a".repeat(64),
          product,
          design: settings,
          genericOffice: true,
          wilayas: [
            {
              id: "dz:wilaya:11",
              code: "11",
              nameAr: "تمنراست",
              nameLatin: "Tamanrasset",
            },
          ],
        },
      });
    if (op === "preview/communes")
      return route.fulfill({
        json: {
          items: [{ id: "dz:commune:359", nameAr: "أدلس", nameLatin: "Idles" }],
        },
      });
    if (op === "preview/quote")
      return route.fulfill({
        json: {
          input: body.input,
          unitPriceMinor: 120000,
          subtotalMinor: 120000 * body.input.quantity,
          discountMinor: 0,
          demo: false,
          quoteToken: "b".repeat(64),
          methods: {
            home: {
              available: true,
              amountMinor: 70000,
              totalMinor: 120000 * body.input.quantity + 70000,
              source: "default",
              reason: "",
              eta: "",
            },
            office: {
              available: true,
              amountMinor: 55500,
              totalMinor: 120000 * body.input.quantity + 55500,
              source: "default",
              reason: "",
              eta: "",
            },
          },
        },
      });
    throw new Error("Unexpected embedded operation " + op);
  });
  await page.route("**/api/orders**", () => {
    throw new Error("Order endpoint must never be called by this UI");
  });
  await page.goto(
    "/shopify/builder?shop=fixture.myshopify.com&host=c2hvcGlmeS1maXh0dXJl",
  );
  return { calls, settings: () => settings };
}
test("real Next page loads App Bridge navigation and saves a design that appears in the shared storefront preview", async ({
  page,
}, testInfo) => {
  const { calls, settings } = await setup(page);
  await expect(page.locator('meta[name="shopify-api-key"]')).toHaveAttribute(
    "content",
    "fixture-client",
  );
  await expect(page.locator("ui-nav-menu a")).toHaveCount(6);
  await expect(
    page.locator(
      'ui-nav-menu a[href*="/orders"],ui-nav-menu a[href*="/products"]',
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "فتح لوحة التحكم", exact: true }),
  ).toHaveCount(0);
  const preview = page.getByTestId("embedded-preview").locator("form.card");
  await expect(preview).toBeVisible();
  await page
    .getByRole("textbox", { name: "عنوان النموذج", exact: true })
    .fill("عنوان نموذج محفوظ");
  await expect(
    preview.getByRole("heading", { name: "عنوان نموذج محفوظ" }),
  ).toBeVisible();
  await page
    .getByLabel("إلزامية الهاتف", { exact: true })
    .selectOption("hidden");
  await expect(preview.locator('input[type="tel"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "حفظ الإعدادات", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "حُفظت إعدادات" }),
  ).toBeVisible();
  expect(settings().title).toBe("عنوان نموذج محفوظ");
  expect(settings().contact.phone).toBe("hidden");
  await page.getByRole("link", { name: "تصميم النموذج", exact: true }).click();
  await page.getByLabel("لون الزر", { exact: true }).fill("#123456");
  await expect(
    page.getByTestId("embedded-preview").locator("button.submit"),
  ).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await page
    .getByRole("button", { name: "حفظ الإعدادات", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "حُفظت إعدادات" }),
  ).toBeVisible();
  expect(
    calls.some(
      (r) =>
        r.op.includes("order") ||
        r.op.includes("trial") ||
        r.op.includes("refresh"),
    ),
  ).toBe(false);
  if (testInfo.project.name === "mobile")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("embedded-design.png"),
    fullPage: true,
  });
});
test("the embedded UI works without browser storage and handles expired sessions safely", async ({
  page,
}) => {
  await setup(page, { storageBlocked: true, expired: true });
  await expect(page.locator(".embedded-app").getByRole("alert")).toContainText(
    /تعذر فتح إعدادات|انتهت جلسة/,
  );
  await expect(
    page.getByRole("button", { name: "حفظ الإعدادات", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText("fixture-session-");
});
test("the app navigation opens shipping and read-only integration checks without order actions", async ({
  page,
}) => {
  const { calls } = await setup(page);
  await expect(
    page.getByTestId("embedded-preview").locator("form.card"),
  ).toBeVisible();
  await page.getByRole("link", { name: "رسوم الشحن", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "أسعار الولايات الفعلية", exact: true }),
  ).toBeVisible();
  expect(calls.some((r) => r.op === "shipping")).toBe(true);
  await page
    .getByRole("link", { name: "تكاملات API والتتبع", exact: true })
    .click();
  await page
    .getByRole("button", { name: "فحص صلاحيات Shopify", exact: true })
    .click();
  await expect(page.getByText("read_products", { exact: true })).toBeVisible();
  await expect(page.getByText("write_orders", { exact: true })).toBeVisible();
  expect(calls.filter((r) => r.op === "integrations")).toHaveLength(1);
  expect(calls.every((r) => r.method === "GET")).toBe(true);
});

test("loads the editor without browser storage and switches the admin and automatic preview language", async ({
  page,
}) => {
  await setup(page, { storageBlocked: true });
  await expect(
    page.getByTestId("embedded-preview").locator("form.card"),
  ).toBeVisible();
  await page.getByLabel("Language / اللغة / Langue").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Form builder", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("embedded-preview").locator("form.card"),
  ).toHaveAttribute("lang", "en");
});
