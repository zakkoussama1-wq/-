import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { defaultFormSettings } from "../../src/modules/forms/settings";
const bundle = readFileSync("extensions/dz-cod-form/assets/dz-cod.js", "utf8"),
  runtime = readFileSync(
    "extensions/dz-cod-form/assets/dz-cod-runtime.js",
    "utf8",
  ),
  productId = "gid://shopify/Product/1";
const block = (locale = "ar") =>
  `<dz-cod-form data-runtime-url="/extensions/assets/dz-cod-runtime.js" data-product-id="1" data-variant-id="11" data-language="${locale}" data-proxy-path="/apps/dz-cod" data-accent="#166534" data-background="#ffffff" data-ink="#202223"></dz-cod-form>`;
const html = (locale = "ar", duplicate = false) =>
  `<!doctype html><html lang="en" dir="ltr"><head><title>Theme product</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:15px;background:#eee}input{background:red!important;padding:35px!important}h2{font-size:70px!important}.shopify-section{max-width:1000px;margin:auto;display:grid;grid-template-columns:1fr minmax(280px,480px);gap:20px}@media(max-width:600px){.shopify-section{display:block}}#theme input{width:80px;padding:5px!important}</style></head><body><main><section class="shopify-section" id="shopify-section-main"><div><h1>Theme product information</h1><form action="/cart/add" id="theme"><input name="id" type="hidden" value="11"><input name="quantity" aria-label="Theme quantity" type="number" value="1"></form></div><div id="blocks">${block(locale)}${duplicate ? block(locale) : ""}</div></section></main></body></html>`;
function product(id = productId) {
  return {
    id,
    name: id.endsWith("/2") ? "منتج ثانٍ" : "كتاب تجريبي",
    active: true,
    demo: false,
    imageUrl: "https://cdn.shopify.com/fixture.jpg",
    variants: id.endsWith("/2")
      ? [
          {
            id: "gid://shopify/ProductVariant/21",
            name: "Default",
            priceMinor: 210000,
            stock: 20,
          },
        ]
      : [
          {
            id: "gid://shopify/ProductVariant/11",
            name: "Black",
            priceMinor: 120000,
            stock: 100,
          },
          {
            id: "gid://shopify/ProductVariant/12",
            name: "Brown",
            priceMinor: 140000,
            stock: 3,
          },
        ],
  };
}
async function mount(
  page: Page,
  options: {
    locale?: string;
    duplicate?: boolean;
    home?: boolean;
    office?: boolean;
    failure?: boolean;
    badQuote?: boolean;
    belowFold?: boolean;
    horizon?: boolean;
    observerMissing?: boolean;
    designMode?: boolean;
    customDesign?: typeof defaultFormSettings;
    unsafeRuntime?: boolean;
    runtimeFailure?: boolean;
  } = {},
) {
  const requests: {
    op: string;
    body: Record<string, unknown> | null;
    url: string;
  }[] = [];
  let failure = options.failure ?? false;
  let runtimeRequests = 0;
  await page.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname === "/extensions/assets/dz-cod-runtime.js") {
      runtimeRequests++;
      if (options.runtimeFailure && runtimeRequests === 1)
        return route.fulfill({ status: 503, body: "unavailable" });
      return route.fulfill({
        contentType: "application/javascript",
        body: runtime,
      });
    }
    if (
      req.isNavigationRequest() &&
      options.horizon &&
      url.pathname === "/editor"
    )
      return route.fulfill({
        contentType: "text/html",
        body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Theme Editor test shell</h1><iframe title="Storefront preview" src="https://storefront.test/products/fixture" style="width:100%;height:900px;border:0"></iframe></body></html>',
      });
    if (req.isNavigationRequest() && options.horizon)
      return route.fulfill({
        contentType: "text/html",
        body: readFileSync("tests/fixtures/horizon-product.html", "utf8")
          .replace(
            "/*__EXTENSION_CSS__*/",
            readFileSync("extensions/dz-cod-form/assets/dz-cod.css", "utf8"),
          )
          .replace(
            "__APP_BLOCK__",
            block(options.locale)
              .replace(
                "<dz-cod-form ",
                `<dz-cod-form data-design-mode="${options.designMode ?? true}" `,
              )
              .replace(
                "></dz-cod-form>",
                '><div data-dz-placeholder role="status">جار تحميل نموذج DZ…</div></dz-cod-form>',
              ),
          ),
      });
    if (req.isNavigationRequest())
      return route.fulfill({
        contentType: "text/html",
        body: html(options.locale, options.duplicate)
          .replace(
            '<div id="blocks">',
            options.belowFold
              ? '<div id="blocks" style="margin-top:5000px">'
              : '<div id="blocks">',
          )
          .replaceAll(
            "/extensions/assets/dz-cod-runtime.js",
            options.unsafeRuntime
              ? "https://untrusted.example/assets/dz-cod-runtime.js"
              : "/extensions/assets/dz-cod-runtime.js",
          ),
      });
    if (url.pathname.startsWith("/apps/dz-cod/")) {
      const op = url.pathname.split("/").at(-1)!,
        body = req.method() === "POST" ? req.postDataJSON() : null;
      requests.push({ op, body, url: req.url() });
      if (failure)
        return route.fulfill({
          status: 503,
          json: { code: "CATALOG_AUTH_UNAVAILABLE" },
        });
      if (op === "bootstrap")
        return route.fulfill({
          json: {
            phase: 2,
            submission: "validate_only",
            context: "a".repeat(64),
            product: product(url.searchParams.get("product")!),
            genericOffice: true,
            wilayas: [
              {
                id: "dz:wilaya:11",
                code: "11",
                nameAr: "تمنراست",
                nameLatin: "Tamanrasset",
              },
              {
                id: "dz:wilaya:07",
                code: "07",
                nameAr: "بسكرة",
                nameLatin: "Biskra",
              },
            ],
            design: {
              ...defaultFormSettings,
              elements: { ...defaultFormSettings.elements, variant: true },
              title: "اطلب منتجك",
              buttonColor: "#166534",
              background: "#ffffff",
              textColor: "#202223",
              deliveryMode: "both",
              officePickupInstructions: "",
              ...options.customDesign,
            },
          },
        });
      if (op === "communes")
        return route.fulfill({
          json: {
            items: [
              {
                id:
                  url.searchParams.get("wilaya") === "11"
                    ? "dz:commune:359"
                    : "dz:commune:2000",
                nameAr: "أدلس",
                nameLatin: "Idles",
              },
            ],
          },
        });
      if (op === "quote" && options.badQuote)
        return route.fulfill({
          json: { input: { ...body.input, mode: "private-fixture-token" } },
        });
      if (op === "quote") {
        const input = body.input;
        const unit = input.productId.endsWith("/2")
          ? 210000
          : input.variantId.endsWith("/12")
            ? 140000
            : 120000;
        return route.fulfill({
          json: {
            input,
            unitPriceMinor: unit,
            subtotalMinor: unit * input.quantity,
            discountMinor: 0,
            quoteToken: "b".repeat(64),
            demo: false,
            methods: {
              home: {
                available: options.home !== false,
                amountMinor: options.home === false ? null : 70000,
                totalMinor:
                  options.home === false ? null : unit * input.quantity + 70000,
                source: "default",
                reason: "",
                eta: "",
              },
              office: {
                available: options.office !== false,
                amountMinor: options.office === false ? null : 55500,
                totalMinor:
                  options.office === false
                    ? null
                    : unit * input.quantity + 55500,
                source: "default",
                reason: "",
                eta: "",
              },
            },
          },
        });
      }
      if (op === "validate")
        return route.fulfill({
          json: {
            validated: true,
            persisted: false,
            shopifyOrderCreated: false,
          },
        });
      throw new Error("Unexpected operation " + op);
    }
    if (url.hostname === "cdn.shopify.com")
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#d1e7dd"/></svg>',
      });
    throw new Error("Unexpected remote request " + req.url());
  });
  await page.goto(
    options.horizon
      ? "https://storefront.test/editor"
      : "https://storefront.test/products/fixture",
  );
  const frame = options.horizon
    ? page.frames().find((f) => f.url().includes("/products/fixture"))!
    : page.mainFrame();
  if (options.observerMissing)
    await frame.evaluate(() => {
      Object.defineProperty(window, "IntersectionObserver", {
        value: undefined,
        configurable: true,
      });
    });
  await frame.addScriptTag({ content: bundle });
  return {
    requests,
    frame,
    runtimeRequests: () => runtimeRequests,
    recover: () => {
      failure = false;
    },
    form: frame.locator("dz-cod-form:not([hidden])").locator("form.card"),
  };
}
async function selectLocation(form: ReturnType<Page["locator"]>) {
  await form.getByLabel("الولاية", { exact: true }).selectOption("11");
  await expect(
    form.getByLabel("البلدية", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await form
    .getByLabel("البلدية", { exact: true })
    .selectOption("dz:commune:359");
}
test("inline RTL form validates office shipping and changing variant/quantity without creating orders or changing the theme", async ({
  page,
}) => {
  const { form, requests } = await mount(page);
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("dir", "rtl");
  expect(await page.locator("html").getAttribute("dir")).toBe("ltr");
  expect(await page.title()).toBe("Theme product");
  await expect(form.getByLabel("الاسم واللقب")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.getByLabel("Theme quantity")).toHaveCSS(
    "background-color",
    "rgb(255, 0, 0)",
  );
  await selectLocation(form);
  const office = form.getByRole("radio", { name: /التوصيل إلى المكتب/ });
  await expect(office).toBeEnabled();
  await office.check();
  await expect(form.locator(".total dd")).toContainText("1.755");
  await form
    .getByLabel("اللون أو المقاس")
    .selectOption("gid://shopify/ProductVariant/12");
  await form.getByRole("button", { name: "زيادة الكمية", exact: true }).click();
  await expect(form.locator(".total dd")).toContainText("3.355");
  await expect(page.getByLabel("Theme quantity")).toHaveValue("2");
  expect(await page.locator("#theme [name=id]").inputValue()).toBe("12");
  await form.getByLabel("الاسم واللقب").fill("أمين تجريبي");
  await form.getByLabel("رقم الهاتف").fill("0551234567");
  await form
    .getByRole("button", { name: "التحقق من الطلب", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText("لم يُحفظ طلب");
  const validation = requests.find((r) => r.op === "validate")!.body;
  expect(validation).toMatchObject({
    customer: {
      productId,
      variantId: "gid://shopify/ProductVariant/12",
      quantity: 2,
      method: "office",
    },
  });
  expect(
    requests.every((r) =>
      ["bootstrap", "communes", "quote", "validate"].includes(r.op),
    ),
  ).toBe(true);
  expect(await page.locator("html").getAttribute("lang")).toBe("en");
});
test("tracks theme variant events, external quantity and a different product without manual configuration", async ({
  page,
}) => {
  const { form, requests } = await mount(page, { locale: "fr" });
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("dir", "ltr");
  await page.locator("#theme [name=id]").evaluate((el: HTMLInputElement) => {
    el.value = "12";
    el.setAttribute("value", "12");
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(form.getByLabel("Couleur ou taille")).toHaveValue(
    "gid://shopify/ProductVariant/12",
  );
  await page.getByLabel("Theme quantity").fill("3");
  await expect(
    form.getByRole("spinbutton", { name: "Quantité", exact: true }),
  ).toHaveValue("3");
  await page.locator("#theme [name=id]").evaluate((el: HTMLInputElement) => {
    el.value = "21";
  });
  await page.locator("dz-cod-form").evaluate((el) => {
    el.setAttribute("data-variant-id", "21");
    el.setAttribute("data-product-id", "2");
  });
  await expect(form).toContainText("منتج ثانٍ");
  await expect(form.getByLabel("Couleur ou taille")).toHaveValue(
    "gid://shopify/ProductVariant/21",
  );
  expect(
    requests
      .filter((r) => r.op === "bootstrap")
      .map((r) => new URL(r.url).searchParams.get("product")),
  ).toEqual([productId, "gid://shopify/Product/2"]);
});
test("does not duplicate forms or listeners after Shopify section replacement", async ({
  page,
}) => {
  const { requests } = await mount(page, { duplicate: true });
  await expect(page.locator("dz-cod-form[data-mounted=true]")).toHaveCount(1);
  await expect(page.locator("dz-cod-form[hidden]")).toHaveCount(1);
  await page.locator("#blocks").evaluate((el, markup) => {
    el.innerHTML = markup;
    el.dispatchEvent(
      new CustomEvent("shopify:section:load", { bubbles: true }),
    );
  }, block() + block());
  await expect(page.locator("dz-cod-form[data-mounted=true]")).toHaveCount(1);
  await expect(page.locator("form.card")).toHaveCount(1);
  await expect
    .poll(() => requests.filter((r) => r.op === "bootstrap").length)
    .toBe(2);
  await page
    .locator("dz-cod-form[data-mounted=true]")
    .evaluate((el) => el.setAttribute("data-language", "en"));
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  expect(await page.locator("html").getAttribute("dir")).toBe("ltr");
});
test("keeps unavailable delivery disabled and never shows a fabricated total", async ({
  page,
}) => {
  const { form, requests } = await mount(page, { home: false, office: false });
  await expect(form).toBeVisible();
  await selectLocation(form);
  await expect
    .poll(() => requests.filter((r) => r.op === "quote").length)
    .toBeGreaterThan(0);
  await expect(
    form.getByRole("radio", { name: /التوصيل إلى المنزل/ }),
  ).toBeDisabled();
  await expect(
    form.getByRole("radio", { name: /التوصيل إلى المكتب/ }),
  ).toBeDisabled();
  await expect(form.locator(".total dd")).toHaveText("—");
  await expect(
    form.getByRole("button", { name: "التحقق من الطلب", exact: true }),
  ).toBeDisabled();
  expect(requests.some((r) => r.op === "validate")).toBe(false);
});
test("handles connection failure in place and reloads without an external page or popup", async ({
  page,
}) => {
  const { recover } = await mount(page, { failure: true });
  await expect(page.getByRole("alert")).toContainText("تعذر تحميل الأسعار");
  await expect(page.locator("dz-cod-form").getByRole("spinbutton")).toHaveCount(
    0,
  );
  recover();
  await page
    .getByRole("button", { name: "إعادة تحميل النموذج", exact: true })
    .click();
  await expect(page.getByLabel("الاسم واللقب")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/products/fixture");
  await expect(page.locator("iframe,dialog")).toHaveCount(0);
});

test("supports an Apps section below product details and a document-level variant adapter", async ({
  page,
}) => {
  const { form } = await mount(page);
  await expect(form).toBeVisible();
  await page.locator("dz-cod-form").evaluate((el) => {
    const section = document.createElement("section");
    section.className = "shopify-section";
    section.id = "shopify-section-apps";
    document.querySelector("main")!.append(section);
    section.append(el);
  });
  await expect(form).toBeVisible();
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("variant:change", {
        detail: { sectionId: "main", variant: { id: "12" } },
      }),
    ),
  );
  await expect(form.getByLabel("اللون أو المقاس")).toHaveValue(
    "gid://shopify/ProductVariant/12",
  );
  await page.getByLabel("Theme quantity").fill("2");
  await expect(
    form.getByRole("spinbutton", { name: "الكمية", exact: true }),
  ).toHaveValue("2");
  expect(await page.locator("html").getAttribute("dir")).toBe("ltr");
});

test("does not render raw errors or private fields from a malformed quote response", async ({
  page,
}) => {
  const { form } = await mount(page, { badQuote: true });
  await expect(form).toBeVisible();
  await selectLocation(form);
  await expect(form.getByRole("alert")).toContainText("تعذر تحميل الأسعار");
  await expect(form).not.toContainText("private-fixture-token");
  await expect(form.locator(".total dd")).toHaveText("—");
  await expect(
    form.getByRole("button", { name: "التحقق من الطلب", exact: true }),
  ).toBeDisabled();
});

test("defers the runtime until the block approaches the viewport and loads it once for duplicates", async ({
  page,
}) => {
  const widget = await mount(page, { belowFold: true, duplicate: true });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(widget.runtimeRequests()).toBe(0);
  expect(widget.requests).toHaveLength(0);
  await page.locator("dz-cod-form").first().scrollIntoViewIfNeeded();
  await expect(widget.form).toBeVisible();
  expect(widget.runtimeRequests()).toBe(1);
  await expect(widget.form).toHaveCount(1);
});

test("rejects a runtime URL outside Shopify or the storefront without loading it", async ({
  page,
}) => {
  const widget = await mount(page, { unsafeRuntime: true });
  await expect(
    page.getByRole("button", { name: "إعادة المحاولة", exact: true }),
  ).toBeVisible();
  expect(widget.runtimeRequests()).toBe(0);
  expect(widget.requests).toHaveLength(0);
});

test("retries a failed runtime download without exposing the error or creating orders", async ({
  page,
}) => {
  const widget = await mount(page, { runtimeFailure: true });
  await page
    .getByRole("button", { name: "إعادة المحاولة", exact: true })
    .click();
  await expect(widget.form).toBeVisible();
  expect(widget.runtimeRequests()).toBe(2);
  expect(widget.requests.every((r) => r.op !== "validate")).toBe(true);
});

test("Horizon Theme Editor iframe shows the form, inherits saved design and follows modern and legacy variant events", async ({
  page,
}, testInfo) => {
  const design = {
    ...defaultFormSettings,
    buttonColor: "#123456",
    title: "نموذجي داخل Horizon",
    elements: { ...defaultFormSettings.elements, variant: true },
  };
  const { frame, form, runtimeRequests } = await mount(page, {
    horizon: true,
    customDesign: design,
  });
  await expect(form).toBeVisible();
  await expect(form.getByRole("heading", { name: design.title })).toBeVisible();
  await expect(form.locator("button.submit")).toHaveCSS(
    "background-color",
    "rgb(18, 52, 86)",
  );
  expect(runtimeRequests()).toBe(1);
  await frame.evaluate(() => {
    const event = new Event("product:select", { bubbles: true });
    Object.defineProperty(event, "promise", {
      value: Promise.resolve({
        variant: { id: "gid://shopify/ProductVariant/12" },
        detail: { productId: "1", resource: { id: "12" } },
      }),
    });
    document.querySelector("variant-picker")!.dispatchEvent(event);
  });
  await expect(form.getByLabel("اللون أو المقاس", { exact: true })).toHaveValue(
    "gid://shopify/ProductVariant/12",
  );
  await frame.evaluate(() =>
    document.querySelector("variant-picker")!.dispatchEvent(
      new CustomEvent("variant:update", {
        bubbles: true,
        detail: { productId: "1", resource: { id: 11 } },
      }),
    ),
  );
  await expect(form.getByLabel("اللون أو المقاس", { exact: true })).toHaveValue(
    "gid://shopify/ProductVariant/11",
  );
  await frame.evaluate(() => {
    const block = document.querySelector(".shopify-app-block")!;
    const html = block.innerHTML;
    block.innerHTML = html;
    block.dispatchEvent(
      new CustomEvent("shopify:section:load", { bubbles: true }),
    );
  });
  await expect(form).toBeVisible();
  await expect(form).toHaveCount(1);
  expect(runtimeRequests()).toBe(1);
  await selectLocation(form);
  await expect(form.locator("button.submit")).toBeEnabled();
  await frame.evaluate(() => {
    let finish: (value: unknown) => void = () => {};
    const event = new Event("product:select", { bubbles: true });
    Object.defineProperty(event, "promise", {
      value: new Promise((resolve) => {
        finish = resolve;
      }),
    });
    Object.assign(window, {
      finishHorizonSelection: () =>
        finish({ variant: null, detail: { productId: "1", resource: null } }),
    });
    document.querySelector("variant-picker")!.dispatchEvent(event);
  });
  await expect(form.locator("button.submit")).toBeDisabled();
  await expect(form.getByLabel("اللون أو المقاس", { exact: true })).toHaveValue(
    "",
  );
  await frame.evaluate(() =>
    (
      window as unknown as { finishHorizonSelection: () => void }
    ).finishHorizonSelection(),
  );
  await expect(form.locator("button.submit")).toBeDisabled();
  await frame.evaluate(() =>
    document.querySelector("variant-picker")!.dispatchEvent(
      new CustomEvent("variant:update", {
        bubbles: true,
        detail: { productId: "1", resource: { id: 11 } },
      }),
    ),
  );
  await expect(form.locator("button.submit")).toBeEnabled();
  if (testInfo.project.name === "mobile")
    await expect(frame.locator(".product-information")).toHaveCSS(
      "display",
      "block",
    );
  const frameHeight = await frame.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await page.locator("iframe").evaluate((el, height) => {
    (el as HTMLIFrameElement).style.height = height + "px";
  }, frameHeight + 40);
  await page.screenshot({
    path: testInfo.outputPath("horizon-preview.png"),
    fullPage: true,
  });
});

test("Horizon iframe displays a useful runtime error and recovers without cookies", async ({
  page,
}) => {
  const { frame, form } = await mount(page, {
    horizon: true,
    runtimeFailure: true,
  });
  await expect(frame.getByRole("alert")).toContainText(
    "RUNTIME_DOWNLOAD_FAILED",
  );
  await frame
    .getByRole("button", { name: "إعادة المحاولة", exact: true })
    .click();
  await expect(form).toBeVisible();
});

test("loads safely without IntersectionObserver support", async ({ page }) => {
  const { form } = await mount(page, { observerMissing: true });
  await expect(form).toBeVisible();
});

test("saved optional/hidden contacts, field order, text and font are applied to the actual storefront form", async ({
  page,
}) => {
  const customDesign = {
    ...defaultFormSettings,
    locale: "en" as const,
    fontFamily: "serif" as const,
    fontSize: 18,
    buttonText: "Validate my selection",
    contact: {
      name: "optional" as const,
      phone: "hidden" as const,
      address: "optional" as const,
    },
    order: [
      "quantity",
      "variant",
      "geography",
      "method",
      "name",
      "address",
      "phone",
    ] as typeof defaultFormSettings.order,
    elements: { ...defaultFormSettings.elements, variant: true },
  };
  const { form } = await mount(page, { customDesign });
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("lang", "en");
  await expect(form.getByLabel("Phone", { exact: true })).toHaveCount(0);
  await expect(form.locator('input[autocomplete="name"]')).not.toHaveAttribute(
    "required",
    "",
  );
  await expect(form.locator("button.submit")).toHaveText(
    "Validate my selection",
  );
  await expect(form).toHaveCSS("font-size", "18px");
  const positions = await form.locator("label").evaluateAll((labels) =>
    labels.map((el) => ({
      text: el.textContent,
      order: getComputedStyle(el).order,
    })),
  );
  expect(positions.find((p) => p.text?.includes("Quantity"))?.order).toBe("0");
});
