import { test, expect, type APIRequestContext, type Page } from "./fixtures";
const origin = "http://127.0.0.1:3000";
const rate = {
  available: true,
  home: { enabled: true, price: 600.5 },
  office: { enabled: true, price: 300 },
  eta: "يومان",
};
async function shipping(
  request: APIRequestContext,
  mode: string,
  change: object,
) {
  const current = await (
    await request.get(`/api/shipping?mode=${mode}`)
  ).json();
  const response = await request.post("/api/shipping", {
    headers: { origin },
    data: { mode, revision: current.revision, ...change },
  });
  expect(response.status()).toBe(200);
  return response.json();
}
async function discount(request: APIRequestContext, type = "none", value = 0) {
  const catalog = await (await request.get("/api/checkout/catalog")).json();
  const response = await request.post("/api/checkout/discount", {
    headers: { origin },
    data: { revision: catalog.revision, discount: { type, value } },
  });
  expect(response.status()).toBe(200);
}
async function location(page: Page, isMobile: boolean) {
  await page
    .getByLabel("التقسيم الإداري", { exact: true })
    .selectOption(isMobile ? "updated69" : "legacy58");
  await page
    .getByLabel("الولاية", { exact: true })
    .selectOption(isMobile ? "68" : "28");
  await page
    .getByLabel("البلدية", { exact: true })
    .selectOption("dz:commune:1006");
}
async function customer(page: Page) {
  await page.getByLabel("الاسم الكامل").fill("محمد أمين");
  let hash = 0;
  for (const c of test.info().title + test.info().project.name)
    hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  await page
    .getByLabel("رقم الهاتف")
    .fill("055" + String(hash % 10000000).padStart(7, "0"));
  await page
    .getByLabel("عنوان المنزل", { exact: false })
    .fill("شارع الاستقلال رقم ١٢");
}
const confirm = (page: Page) =>
  page.getByRole("button", {
    name: "تأكيد الطلب وحفظه",
    exact: true,
  });
test.beforeEach(async ({ request, isMobile }) => {
  const mode = isMobile ? "updated69" : "legacy58";
  const current = await (
    await request.get(`/api/shipping?mode=${mode}`)
  ).json();
  if (current.entries.length)
    await shipping(request, mode, {
      action: "reset",
      targets: current.entries.map((e: { scope: string; target: string }) => ({
        scope: e.scope,
        target: e.target,
      })),
    });
  await shipping(request, mode, {
    action: "save",
    entries: [{ scope: "default", target: "*", rule: rate }],
  });
  await shipping(request, mode, { action: "settings", genericOffice: true });
  await discount(request);
});
test("home form validates required fields, updates quantity and persists a correctly priced order", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/form");
  await expect(confirm(page)).toBeDisabled();
  await location(page, isMobile);
  await expect(confirm(page)).toBeEnabled();
  await expect(page.getByTestId("final-total")).toContainText(/4.*500.*50/);
  await confirm(page).click();
  await expect(page.locator("form").getByRole("alert")).toHaveCount(3);
  await page.getByLabel("الاسم الكامل").fill("محمد أمين");
  await page.getByLabel("رقم الهاتف").fill("123");
  await page
    .getByLabel("عنوان المنزل", { exact: false })
    .fill("شارع الاستقلال رقم ١٢");
  await confirm(page).click();
  await expect(page.locator("#phone-error")).toBeVisible();
  await page.getByLabel("رقم الهاتف").fill("+213 551 23 45 67");
  await page.getByRole("button", { name: "زيادة الكمية" }).click();
  await expect(page.getByTestId("subtotal")).toContainText(/7.*800/);
  await expect(page.getByTestId("final-total")).toContainText(/8.*400.*50/);
  await expect(confirm(page)).toBeEnabled();
  const pending = page.waitForResponse((r) => r.url().endsWith("/api/orders"));
  await confirm(page).click();
  const response = await pending;
  expect(response.status()).toBe(201);
  const result = await response.json();
  expect(result).toMatchObject({ persisted: true });
  expect(result.orderId).toMatch(/^[a-f0-9-]{36}$/);
  const savedOrders = await (await page.request.get("/api/orders")).json();
  expect(
    savedOrders.orders.find((o: { id: string }) => o.id === result.orderId)
      .quote.methods.home.totalMinor,
  ).toBe(840050);
  expect(response.request().postDataJSON().customer.phone).toBe("0551234567");
  await expect(page.getByTestId("checkout-success")).toContainText(
    "تم استلام طلبك للمراجعة.",
  );
  await expect(confirm(page)).toBeDisabled();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/checkout-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "تقليل الكمية" }).click();
  await expect(page.getByTestId("checkout-success")).toHaveCount(0);
});
test("office, product variant and percentage discount recalculate totals", async ({
  page,
  request,
  isMobile,
}) => {
  await discount(request, "percent", 1250);
  await page.goto("/form");
  await location(page, isMobile);
  await expect(confirm(page)).toBeEnabled();
  await page.getByLabel("التوصيل إلى المكتب", { exact: false }).check();
  await expect(page.getByLabel("عنوان المنزل", { exact: false })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("discount")).toContainText(/487.*50/);
  await expect(page.getByTestId("final-total")).toContainText(/3.*712.*50/);
  await page.getByLabel("خيار المنتج").selectOption("black");
  await expect(page.getByTestId("discount")).toContainText(/525/);
  await expect(page.getByTestId("final-total")).toContainText(/3.*975/);
  await page.getByRole("button", { name: "زيادة الكمية" }).click();
  await expect(page.getByTestId("final-total")).toContainText(/7.*650/);
  await page.getByLabel("الاسم الكامل").fill("محمد أمين");
  await page.getByLabel("رقم الهاتف").fill("0661234567");
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect(page.getByTestId("checkout-success")).toBeVisible();
});
test("free commune override and unavailable methods cannot be bypassed", async ({
  page,
  request,
  isMobile,
}) => {
  const mode = isMobile ? "updated69" : "legacy58";
  await shipping(request, mode, {
    action: "save",
    entries: [
      {
        scope: "commune",
        target: "dz:commune:1006",
        rule: {
          ...rate,
          home: { enabled: true, price: 0 },
          office: { enabled: false, price: null },
        },
      },
    ],
  });
  await page.goto("/form");
  await location(page, isMobile);
  await expect(confirm(page)).toBeEnabled();
  await expect(page.getByTestId("final-total")).toContainText(/3.*900/);
  await expect(
    page.getByLabel("التوصيل إلى المكتب", { exact: false }),
  ).toBeDisabled();
  await shipping(request, mode, {
    action: "save",
    entries: [
      {
        scope: "commune",
        target: "dz:commune:1006",
        rule: { ...rate, available: false },
      },
    ],
  });
  await page.reload();
  await location(page, isMobile);
  await expect(
    page.getByText("المنزل: التوصيل غير متاح لهذه المنطقة.", { exact: true }),
  ).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await expect(page.getByTestId("final-total")).toHaveText("—");
  const input = {
    productId: "demo-bag",
    variantId: "olive",
    quantity: 1,
    mode,
    wilayaCode: isMobile ? "68" : "28",
    communeId: "dz:commune:1006",
  };
  const quote = await (
    await request.post("/api/checkout/quote", {
      headers: { origin },
      data: input,
    })
  ).json();
  const response = await request.post("/api/checkout/validate", {
    headers: { origin },
    data: {
      quoteToken: quote.quoteToken,
      customer: {
        ...input,
        name: "محمد أمين",
        phone: "0551234567",
        address: "شارع الاستقلال رقم ١٢",
        method: "home",
      },
    },
  });
  expect(response.status()).toBe(422);
});
test("catalog, pricing and validation failures show errors and recover", async ({
  page,
  isMobile,
}) => {
  await page.route("**/api/checkout/catalog", (route) =>
    route.fulfill({ status: 503, json: { error: "تعذر التحميل" } }),
  );
  await page.goto("/form");
  await expect(
    page.getByText("تعذر تحميل المنتج وإعدادات الخصم. أعد المحاولة."),
  ).toBeVisible();
  await page.unroute("**/api/checkout/catalog");
  await page.getByRole("button", { name: "إعادة تحميل المنتج" }).click();
  await expect(page.getByLabel("الاسم الكامل")).toBeVisible();
  await page.route("**/api/checkout/quote", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "تعذر حساب الطلب. أعد المحاولة." },
    }),
  );
  await location(page, isMobile);
  await expect(
    page.getByText("تعذر حساب الطلب. أعد المحاولة.", { exact: true }),
  ).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await page.unroute("**/api/checkout/quote");
  await page.getByRole("button", { name: "إعادة حساب السعر" }).click();
  await expect(confirm(page)).toBeEnabled();
  await customer(page);
  await page.route("**/api/orders", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "تعذر التحقق من الطلب. أعد المحاولة." },
    }),
  );
  await confirm(page).click();
  await expect(
    page.getByText("تعذر التحقق من الطلب. أعد المحاولة.", { exact: true }),
  ).toBeVisible();
  await expect(confirm(page)).toBeEnabled();
  await page.unroute("**/api/orders");
  await confirm(page).click();
  await expect(page.getByTestId("checkout-success")).toBeVisible();
});
test("price change requires reviewing the new total and confirming again", async ({
  page,
  request,
  isMobile,
}) => {
  const mode = isMobile ? "updated69" : "legacy58";
  await page.goto("/form");
  await location(page, isMobile);
  await expect(confirm(page)).toBeEnabled();
  await customer(page);
  await shipping(request, mode, {
    action: "save",
    entries: [
      {
        scope: "default",
        target: "*",
        rule: { ...rate, home: { enabled: true, price: 900 } },
      },
    ],
  });
  await confirm(page).click();
  await expect(
    page.getByText(
      "تغيرت الأسعار أو الإعدادات. حدّث الحساب وراجع الإجمالي ثم أكد مجددًا.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByTestId("checkout-success")).toHaveCount(0);
  await expect(page.getByTestId("final-total")).toContainText(/4.*800/);
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect(page.getByTestId("checkout-success")).toBeVisible();
});
test("merchant discount editor persists and refreshes the embedded form", async ({
  page,
  isMobile,
}) => {
  await page.goto("/dashboard");
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "الإعدادات", exact: true }).click();
  await page.getByLabel("نوع خصم التاجر").selectOption("fixed");
  await page.getByLabel("قيمة الخصم بالدينار", { exact: true }).fill("250.50");
  await page.getByRole("button", { name: "حفظ خصم التاجر" }).click();
  await expect(
    page.getByText("تم حفظ خصم التاجر وتحديث نموذج الطلب.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "معاينة نموذج الطلب", exact: true })
    .click();
  await expect(page.getByTestId("discount")).toContainText(/250.*50/);
  await page.reload();
  if (isMobile) await page.getByRole("button", { name: "فتح القائمة" }).click();
  await page.getByRole("button", { name: "الإعدادات", exact: true }).click();
  await expect(page.getByTestId("saved-discount")).toContainText("250.5");
});
test("loading validation disables editing and rapid confirmation sends one request", async ({
  page,
  isMobile,
}) => {
  await page.goto("/form");
  await location(page, isMobile);
  await expect(confirm(page)).toBeEnabled();
  await customer(page);
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/orders", async (route) => {
    requests++;
    await gate;
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await confirm(page).dblclick();
  await expect.poll(() => requests).toBe(1);
  await expect(
    page.getByRole("button", { name: "جارٍ التحقق على الخادم…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("الاسم الكامل")).toBeDisabled();
  release();
  await expect(page.getByTestId("checkout-success")).toBeVisible();
  expect(requests).toBe(1);
});
test("late pricing response cannot replace the current location or total", async ({
  page,
  request,
  isMobile,
}) => {
  const mode = isMobile ? "updated69" : "legacy58";
  await shipping(request, mode, {
    action: "save",
    entries: [
      {
        scope: "commune",
        target: "dz:commune:1006",
        rule: { ...rate, home: { enabled: true, price: 100 } },
      },
    ],
  });
  const oldInput = {
    productId: "demo-bag",
    variantId: "olive",
    quantity: 1,
    mode,
    wilayaCode: isMobile ? "68" : "28",
    communeId: "dz:commune:1006",
  };
  const oldQuote = await (
    await request.post("/api/checkout/quote", {
      headers: { origin },
      data: oldInput,
    })
  ).json();
  let held = false;
  let release!: () => void;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/checkout/quote", async (route) => {
    if (route.request().postDataJSON().communeId !== oldInput.communeId) {
      await route.continue();
      return;
    }
    held = true;
    await gate;
    try {
      await route.fulfill({ status: 200, json: oldQuote });
    } catch {
      /* An aborted superseded request is expected. */
    } finally {
      finish();
    }
  });
  await page.goto("/form");
  await location(page, isMobile);
  await expect.poll(() => held).toBe(true);
  const other = await (
    await request.get(`/api/geography/communes?mode=${mode}&wilayaCode=16`)
  ).json();
  await page.getByLabel("الولاية", { exact: true }).selectOption("16");
  await page
    .getByLabel("البلدية", { exact: true })
    .selectOption(other.items[0].id);
  await expect(confirm(page)).toBeEnabled();
  await expect(page.getByTestId("final-total")).toContainText(/4.*500.*50/);
  release();
  await done;
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(confirm(page)).toBeEnabled();
  await expect(page.getByTestId("final-total")).toContainText(/4.*500.*50/);
  await expect(page.getByLabel("الولاية", { exact: true })).toHaveValue("16");
});
