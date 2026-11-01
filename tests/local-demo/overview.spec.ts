import { test, expect } from "@playwright/test";

const mockOrders = () => [
  {
    id: "test-confirmed",
    status: "confirmed",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    customer: { name: "Review Customer", phone: "0551234567", method: "home" },
    productName: "Review Product",
    variantName: "Blue",
    quote: { methods: { home: { totalMinor: 450000 } } },
  },
  {
    id: "test-cancelled",
    status: "cancelled",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    customer: {
      name: "Cancelled Customer",
      phone: "0661234567",
      method: "office",
    },
    productName: "Another Product",
    variantName: "Green",
    quote: { methods: { office: { totalMinor: 420000 } } },
  },
];
for (const [language, heading, refresh, search, manage, menu] of [
  [
    "ar",
    "نظرة عامة",
    "تحديث",
    "البحث في أحدث الطلبات",
    "إدارة الطلبات",
    "فتح القائمة",
  ],
  [
    "fr",
    "Vue d’ensemble",
    "Actualiser",
    "Rechercher les commandes récentes",
    "Gérer les commandes",
    "Ouvrir le menu",
  ],
  [
    "en",
    "Overview",
    "Refresh",
    "Search recent orders",
    "Manage orders",
    "Open menu",
  ],
]) {
  test(`${language}: overview uses real API values, filters, sorting and responsive navigation`, async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("dz-language", value),
      language,
    );
    // Deterministic API fixtures, never persisted into merchant data.
    await page.route("**/api/orders", (route) =>
      route.fulfill({ json: { orders: mockOrders() } }),
    );
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("metric-إجمالي الطلبات")).toContainText(
      new Intl.NumberFormat(language).format(2),
    );
    await expect(page.getByTestId("metric-قيمة الطلبات")).toHaveText(
      new Intl.NumberFormat(language, {
        style: "currency",
        currency: "DZD",
        maximumFractionDigits: 2,
      }).format(4500),
    );
    const table = page.locator("table.ds-table");
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(table.locator("tbody tr").first()).toContainText(
      "Review Customer",
    );
    await table.locator("thead button").click();
    await expect(table.locator("tbody tr").first()).toContainText(
      "Cancelled Customer",
    );
    await page.getByRole("textbox", { name: search }).fill("Review Customer");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("textbox", { name: search }).fill("");
    await page
      .locator(".overview-table-tools select")
      .selectOption("cancelled");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.locator("tbody tr")).toContainText("Cancelled Customer");
    await page.locator("#overview-range").selectOption("30");
    await expect(page.locator(".overview-chart svg rect")).toHaveCount(30);
    await page.getByRole("button", { name: refresh, exact: true }).click();
    await expect(page.getByRole("status")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (isMobile) {
      const toggle = page.getByRole("button", { name: menu, exact: true });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
    }
    await page.getByRole("button", { name: manage, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      language === "ar"
        ? "الطلبات"
        : language === "fr"
          ? "Commandes"
          : "Orders",
    );
  });
}
test("overview recovers from API failure and never invents empty-store metrics", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/orders", (route) =>
    fail
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { orders: [] } }),
  );
  await page.goto("/dashboard");
  await expect(
    page.getByText("تعذر تحميل الطلبات.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("metric-إجمالي الطلبات")).toHaveCount(0);
  fail = false;
  await page
    .getByRole("button", { name: "إعادة المحاولة", exact: true })
    .click();
  await expect(
    page.getByText("ابدأ بطلبك الأول", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("metric-إجمالي الطلبات")).toHaveText(
    new Intl.NumberFormat("ar").format(0),
  );
  await expect(
    page.getByRole("img", { name: "عدد الطلبات اليومية" }),
  ).toBeVisible();
});
