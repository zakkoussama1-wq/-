import { beforeEach, afterEach, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { authDb } from "../src/modules/auth/store";
import { getFormSettings } from "../src/modules/forms/repository";
import {
  defaultFormSettings,
  formSettingsSchema,
  type FormSettings,
} from "../src/modules/forms/settings";
import {
  changeShipping,
  getShippingState,
} from "../src/modules/shipping/repository";
import {
  getCheckoutCatalog,
  saveProduct,
} from "../src/modules/checkout/repository";
import { priceCheckout } from "../src/modules/checkout/service";
import { createOrder, listOrders } from "../src/modules/orders/repository";
import { POST as saveForm } from "../src/app/api/form-config/route";
let directory: string;
let previous: Record<string, string | undefined>;
const merchant = "form-policy-merchant";
const pricing = {
  productId: "demo-bag",
  variantId: "olive",
  quantity: 1,
  mode: "legacy58" as const,
  wilayaCode: "28",
  communeId: "dz:commune:1006",
};
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "dz-form-policy-"));
  previous = {};
  for (const key of ["AUTH", "CHECKOUT", "SHIPPING", "ORDERS"]) {
    const name = key + "_DATABASE_PATH";
    previous[name] = process.env[name];
    process.env[name] = join(directory, key + ".sqlite");
  }
  previous.LOCAL_MERCHANT_ID = process.env.LOCAL_MERCHANT_ID;
  process.env.LOCAL_MERCHANT_ID = merchant;
  await getCheckoutCatalog(merchant);
  const state = await getShippingState(merchant, "legacy58");
  await changeShipping(merchant, "legacy58", state.revision, {
    entries: [
      {
        scope: "default",
        target: "*",
        rule: {
          available: true,
          home: { enabled: true, price: 500 },
          office: { enabled: true, price: 350 },
          eta: "",
        },
      },
    ],
    genericOffice: true,
  });
});
afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(directory, { recursive: true, force: true });
});
async function save(settings: FormSettings) {
  const response = await saveForm(
    new Request("http://localhost/api/form-config", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    }),
  );
  return response;
}
const customer = {
  ...pricing,
  name: "Test Customer",
  phone: "0551234567",
  method: "home" as const,
  address: "12 Demo Street Alger",
};
it("migrates old saved designs to compact defaults without deleting merchant text", async () => {
  const {
    elements,
    contact,
    compact,
    columns,
    defaultMethod,
    deliveryMode,
    ...legacy
  } = defaultFormSettings;
  void elements;
  void contact;
  void compact;
  void columns;
  void defaultMethod;
  void deliveryMode;
  const db = await authDb();
  await db.exec(
    "CREATE TABLE IF NOT EXISTS form_settings(merchant_id TEXT PRIMARY KEY,settings TEXT NOT NULL)",
  );
  await db
    .prepare("INSERT INTO form_settings VALUES(?,?)")
    .run(merchant, JSON.stringify({ ...legacy, title: "Custom title" }));
  await db.close();
  const value = await getFormSettings(merchant);
  expect(value.title).toBe("Custom title");
  expect(value.elements.productSelector).toBe(false);
  expect(value.elements.locationSearch).toBe(false);
  expect(value.defaultMethod).toBe("none");
});
it("honors hidden and optional contact fields when saving an actual order", async () => {
  const settings = formSettingsSchema.parse({
    ...defaultFormSettings,
    contact: { name: "hidden", phone: "optional", address: "optional" },
  });
  expect((await save(settings)).status).toBe(200);
  const quote = await priceCheckout(merchant, pricing);
  const result = await createOrder(
    merchant,
    {
      customer: { ...customer, name: "", phone: "", address: "" },
      quoteToken: quote.quoteToken,
    },
    randomUUID(),
  );
  expect(result.order.customer).toMatchObject({
    name: "",
    phone: "",
    address: "",
  });
  expect(await listOrders(merchant)).toHaveLength(1);
  await expect(
    createOrder(
      merchant,
      {
        customer: { ...customer, phone: "", address: "" },
        quoteToken: quote.quoteToken,
      },
      randomUUID(),
    ),
  ).rejects.toThrow();
});
it("rejects client attempts to bypass disabled delivery methods and invalidates old quotes", async () => {
  const old = await priceCheckout(merchant, pricing);
  expect(
    (await save({ ...defaultFormSettings, deliveryMode: "office" })).status,
  ).toBe(200);
  const quote = await priceCheckout(merchant, pricing);
  expect(quote.methods.home.available).toBe(false);
  expect(quote.methods.office.available).toBe(true);
  expect(quote.quoteToken).not.toBe(old.quoteToken);
  await expect(
    createOrder(
      merchant,
      { customer, quoteToken: quote.quoteToken },
      randomUUID(),
    ),
  ).rejects.toThrow();
  const result = await createOrder(
    merchant,
    {
      customer: { ...customer, method: "office", address: "" },
      quoteToken: quote.quoteToken,
    },
    randomUUID(),
  );
  expect(result.order.customer.method).toBe("office");
});
it("validates fixed geography on save and rejects a forged region or hidden quantity", async () => {
  const settings = {
    ...defaultFormSettings,
    elements: {
      ...defaultFormSettings.elements,
      geography: false,
      quantity: false,
    },
    fixedWilaya: "28",
    fixedCommune: "dz:commune:1006",
  };
  expect((await save(settings)).status).toBe(200);
  await expect(
    priceCheckout(merchant, { ...pricing, wilayaCode: "16" }),
  ).rejects.toThrow("ثابتة");
  await expect(
    priceCheckout(merchant, { ...pricing, quantity: 2 }),
  ).rejects.toThrow("ثابتة");
  expect((await save({ ...settings, fixedWilaya: "16" })).status).toBe(400);
});

it("keeps a featured variant scoped to a fixed product without blocking a visible product selector", async () => {
  const catalog = await getCheckoutCatalog(merchant);
  await saveProduct(merchant, catalog.revision, {
    id: "second-product",
    name: "Second product",
    demo: false,
    active: true,
    variants: [
      { id: "second-variant", name: "One", priceMinor: 10000, stock: null },
    ],
  });
  const settings = {
    ...defaultFormSettings,
    featuredProductId: "demo-bag",
    featuredVariantId: "olive",
    elements: { ...defaultFormSettings.elements, productSelector: true },
  };
  expect((await save(settings)).status).toBe(200);
  const quote = await priceCheckout(merchant, {
    ...pricing,
    productId: "second-product",
    variantId: "second-variant",
  });
  expect(quote.unitPriceMinor).toBe(10000);
  expect(
    (
      await save({
        ...settings,
        elements: { ...settings.elements, productSelector: false },
      })
    ).status,
  ).toBe(200);
  await expect(
    priceCheckout(merchant, {
      ...pricing,
      productId: "second-product",
      variantId: "second-variant",
    }),
  ).rejects.toThrow("المنتج");
  await expect(
    priceCheckout(merchant, { ...pricing, variantId: "black" }),
  ).rejects.toThrow("الخيار");
});
