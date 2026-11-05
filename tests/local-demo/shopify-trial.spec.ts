import { test, expect, type Page } from "@playwright/test";
const id = "4a1446b0-ae66-47cf-9693-09133389da05",
  otherId = "3d519b54-f17a-45fa-b51d-2032bb1b0912";
function order(orderId = id, allowed = true) {
  return {
    id: orderId,
    merchantId: "synthetic-merchant",
    status: "submitted",
    createdAt: "2026-11-05T10:00:00Z",
    productName: "Synthetic product",
    variantName: "Default",
    catalogSource: "shopify",
    customer: {
      name: "مستخدم اختباري",
      phone: "0551234567",
      address: "",
      productId: "gid://shopify/Product/1",
      variantId: "gid://shopify/ProductVariant/1",
      quantity: 1,
      mode: "legacy58",
      wilayaCode: "11",
      communeId: "dz:commune:359",
      method: "office",
    },
    quote: {
      unitPriceMinor: 120000,
      subtotalMinor: 120000,
      discountMinor: 0,
      methods: {
        home: { available: true, amountMinor: 70000, totalMinor: 190000 },
        office: { available: true, amountMinor: 55500, totalMinor: 175500 },
      },
    },
    shopifySync: {
      state: "queued",
      enabled: false,
      shopifyOrderId: null,
      attempts: 0,
      errorCode: "",
      trialPreparationAllowed: allowed,
    },
  };
}
const checks = {
  postgres: { status: "passed", code: "QUEUE_SCHEMA_PRESENT" },
  databaseFence: { status: "passed", code: "TRIAL_GUARDS_PRESENT" },
  trial: { status: "blocked", code: "SINGLE_ORDER_NOT_BOUND" },
  selectedJob: { status: "passed", code: "SELECTED_JOB_UNSENT" },
  offline: { status: "passed", code: "OFFLINE_CURRENT_TOKEN_VERIFIED" },
  localOrder: { status: "passed", code: "LOCAL_ORDER_ELIGIBLE" },
  scopes: { status: "passed", code: "REQUIRED_SCOPES_VERIFIED" },
  storedScope: { status: "blocked", code: "STORED_ORDER_SCOPE_MISSING" },
  shopPolicy: { status: "passed", code: "DZD_ZERO_ADDITIONAL_TAX_POLICY" },
  schema: {
    status: "passed",
    code: "API_2026_10_PAYLOAD_AND_LOOKUP_VALIDATED",
  },
  protectedData: { status: "unverified", code: "PROTECTED_DATA_NOT_PROVEN" },
};
const report = {
  readOnly: true,
  liveOrderCreationVerified: false,
  ready: false,
  checks,
};
async function open(page: Page, orderId = id) {
  await page.goto("/dashboard");
  if (!(await page.locator(".app-sidebar").isVisible()))
    await page
      .getByRole("button", { name: "فتح القائمة", exact: true })
      .click();
  await page
    .locator(".app-sidebar")
    .getByRole("button", { name: "الطلبات", exact: true })
    .click();
  await page
    .getByTestId(`order-row-${orderId}`)
    .getByRole("button", { name: "تفاصيل الطلب", exact: true })
    .click();
  return page.getByRole("region", { name: "تجربة Shopify للطلب" });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("dz-language", "ar"));
  await page.route("**/api/orders", (r) =>
    r.fulfill({ json: { orders: [order(), order(otherId, false)] } }),
  );
});
test("prepares with the merchant cookie and checks readiness without enqueueing or enabling sending", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "dz_session",
      value: "a".repeat(64),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  let releasePreparation!: () => void;
  const gate = new Promise<void>((resolve) => {
    releasePreparation = resolve;
  });
  let prepared = 0,
    read = 0,
    forbidden = 0;
  await page.route("**/api/orders/shopify-sync", (r) => {
    forbidden++;
    return r.abort();
  });
  await page.route("**/api/orders/shopify-sync/trial", async (r) => {
    prepared++;
    expect(r.request().method()).toBe("POST");
    expect(r.request().postDataJSON()).toEqual({ id });
    const headers = await r.request().allHeaders();
    expect(headers.cookie).toContain("dz_session=");
    expect(headers.origin).toBe("http://127.0.0.1:3003");
    expect(headers.authorization).toBeUndefined();
    await gate;
    await r.fulfill({ json: { prepared: true, orderId: id } });
  });
  await page.route("**/api/orders/shopify-sync/readiness?*", (r) => {
    read++;
    expect(r.request().method()).toBe("GET");
    expect(new URL(r.request().url()).searchParams.get("id")).toBe(id);
    return r.fulfill({
      json: { ...report, accessToken: "private-fixture-token" },
    });
  });
  const panel = await open(page);
  await panel
    .getByRole("button", { name: "تحضير تجربة Shopify", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "جارٍ تحضير التجربة…", exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "فحص الجاهزية", exact: true }),
  ).toBeDisabled();
  expect(prepared).toBe(1);
  releasePreparation();
  await expect(panel.getByRole("status")).toContainText("تم تحضير الطلب");
  await panel
    .getByRole("button", { name: "فحص الجاهزية", exact: true })
    .click();
  await expect(panel.getByRole("status")).toContainText("التجربة غير جاهزة");
  await expect(panel).toContainText("الجلسة المخزنة");
  await expect(panel).toContainText("STORED_ORDER_SCOPE_MISSING");
  await expect(panel).toContainText("غير متحقق");
  await expect(panel).not.toContainText("private-fixture-token");
  expect(prepared).toBe(1);
  expect(read).toBe(1);
  expect(forbidden).toBe(0);
  await expect(panel.getByRole("button")).toHaveCount(2);
});
test("hides preparation for other orders and clears the previous order's report", async ({
  page,
}) => {
  await page.route("**/api/orders/shopify-sync/readiness?*", (r) =>
    r.fulfill({ json: report }),
  );
  const first = await open(page);
  await first
    .getByRole("button", { name: "فحص الجاهزية", exact: true })
    .click();
  await expect(first.getByRole("status")).toBeVisible();
  await page
    .getByRole("button", { name: "إغلاق النافذة", exact: true })
    .click();
  await page
    .getByTestId(`order-row-${otherId}`)
    .getByRole("button", { name: "تفاصيل الطلب", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "تجربة Shopify للطلب" });
  await expect(
    panel.getByRole("button", { name: "تحضير تجربة Shopify", exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByRole("status")).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "فحص الجاهزية", exact: true }),
  ).toBeEnabled();
});
test("shows safe session/configuration/connection errors and rejects malformed reports", async ({
  page,
}) => {
  let status = 200,
    code = "AUTH_REQUIRED";
  await page.route("**/api/orders/shopify-sync/trial", (r) =>
    r.fulfill({
      status: 409,
      json: { code: "TRIAL_ALREADY_BOUND", error: "private-fixture-token" },
    }),
  );
  await page.route("**/api/orders/shopify-sync/readiness?*", (r) =>
    status === 0
      ? r.abort()
      : r.fulfill({
          status,
          json:
            status === 200
              ? report
              : status === 201
                ? {
                    ready: true,
                    checks: {},
                    accessToken: "private-fixture-token",
                  }
                : { code, error: "private-fixture-token" },
        }),
  );
  const panel = await open(page);
  const button = panel.getByRole("button", {
    name: "فحص الجاهزية",
    exact: true,
  });
  await button.click();
  await expect(panel.getByRole("status")).toBeVisible();
  await panel
    .getByRole("button", { name: "تحضير تجربة Shopify", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText("مثبتة مسبقًا");
  await expect(panel.getByRole("status")).toHaveCount(0);
  for (const [next, reason, text] of [
    [401, "AUTH_REQUIRED", "انتهت جلسة"],
    [409, "SHOPIFY_CONNECTION_REQUIRED", "متجر موثّق"],
    [503, "READINESS_STORAGE_UNAVAILABLE", "قاعدة البيانات"],
    [502, "PRIVATE_ACCESS_TOKEN", "تفسير الاستجابة"],
    [201, "", "تفسير الاستجابة"],
    [0, "", "تعذر الاتصال"],
  ] as const) {
    status = next;
    code = reason;
    await button.click();
    await expect(panel.getByRole("alert")).toContainText(text);
    await expect(panel).not.toContainText("private-fixture-token");
    await expect(panel).not.toContainText("PRIVATE_ACCESS_TOKEN");
    await expect(
      panel.getByRole("link", { name: "تسجيل الدخول بحساب التاجر" }),
    ).toHaveCount(next === 401 ? 1 : 0);
  }
});
