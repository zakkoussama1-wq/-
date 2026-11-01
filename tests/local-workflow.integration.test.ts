import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  authDb,
  accountLogin,
  sessionMerchant,
} from "../src/modules/auth/store";
import { defaultFormSettings } from "../src/modules/forms/settings";
import {
  productFormSettings,
  requestedProduct,
} from "../src/modules/forms/product-form";
import { getFormSettings } from "../src/modules/forms/repository";
import {
  getCheckoutCatalog,
  saveProduct,
} from "../src/modules/checkout/repository";
import { priceCheckout } from "../src/modules/checkout/service";
import {
  createOrder,
  listOrders,
  setOrderStatus,
} from "../src/modules/orders/repository";
import {
  getShippingState,
  changeShipping,
} from "../src/modules/shipping/repository";
import { storeImage } from "../src/modules/media/service";
import {
  updateSimulationSettings,
  readSimulation,
  retrySimulation,
  recordSimulation,
  withSimulation,
  simulationEventId,
} from "../src/modules/advertising/simulation";
import { readCatalog } from "../src/modules/checkout/http";
import { GET as formConfig } from "../src/app/api/form-config/route";
import { storefrontUrl } from "../src/modules/checkout/storefront-url";
const dir = mkdtempSync(join(tmpdir(), "dz-complete-local-"));
for (const key of ["AUTH", "CHECKOUT", "SHIPPING", "ORDERS"])
  process.env[key + "_DATABASE_PATH"] = join(dir, key + ".sqlite");
process.env.MEDIA_STORAGE_PATH = join(dir, "media");
const merchant = "workflow-merchant";
const price = {
  productId: "workflow-product",
  variantId: "blue",
  quantity: 2,
  mode: "legacy58" as const,
  wilayaCode: "28",
  communeId: "dz:commune:1006",
};
const customer = {
  ...price,
  name: "عميل تجربة",
  phone: "0552222233",
  method: "home",
  address: "شارع الاختبار 12",
};
let image: string;
let orderId: string;
beforeAll(async () => {
  const base = await getCheckoutCatalog(merchant);
  image = (
    await storeImage(
      merchant,
      await sharp({
        create: { width: 32, height: 32, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer(),
      "image/png",
    )
  ).url;
  await saveProduct(merchant, base.revision, {
    id: price.productId,
    name: "Original product",
    sku: "PRODUCT-SKU",
    imageUrl: image,
    images: [image],
    demo: false,
    active: true,
    variants: [
      {
        id: "blue",
        name: "Original blue",
        sku: "BLUE-SKU",
        imageUrl: image,
        priceMinor: 15000,
        stock: 20,
      },
      { id: "sold-out", name: "Sold out", priceMinor: 20000, stock: 0 },
    ],
  });
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
  const db = await authDb();
  await db.exec(
    "CREATE TABLE IF NOT EXISTS form_settings(merchant_id TEXT PRIMARY KEY,settings TEXT NOT NULL)",
  );
  await db.prepare("INSERT INTO form_settings VALUES(?,?)").run(
    merchant,
    JSON.stringify({
      ...defaultFormSettings,
      featuredProductId: "demo-bag",
      featuredVariantId: "olive",
      officePickupInstructions: "Test pickup counter",
    }),
  );
  await db.close();
  await updateSimulationSettings(merchant, {
    revision: 0,
    enabled: true,
    purchaseOnFulfilled: false,
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});
it("derives a product-specific template without changing the saved template or weakening the generic form", async () => {
  const generic = await getFormSettings(merchant);
  const standalone = await getFormSettings(merchant, price.productId);
  expect(generic.featuredProductId).toBe("demo-bag");
  expect(standalone.featuredProductId).toBe(price.productId);
  expect(standalone.elements).toMatchObject({
    productSelector: false,
    variant: true,
    quantity: true,
    locationSearch: true,
  });
  expect(standalone.order.slice(0, 2)).toEqual(["variant", "quantity"]);
  await expect(priceCheckout(merchant, price)).rejects.toThrow(
    "المنتج غير مخصص",
  );
  await expect(
    priceCheckout(
      merchant,
      { ...price, productId: "demo-bag", variantId: "olive" },
      standalone,
    ),
  ).rejects.toThrow("المنتج غير مخصص");
  expect((await getFormSettings(merchant)).featuredProductId).toBe(
    generic.featuredProductId,
  );
  for (const value of ["", "x".repeat(101), "a\nb"])
    expect(() => productFormSettings(generic, value)).toThrow();
  expect(() =>
    requestedProduct(new Request("http://localhost/form?product=a&product=b")),
  ).toThrow();
});
it("saves exact canonical snapshots and queues consented Lead events atomically with the order", async () => {
  const settings = await getFormSettings(merchant, price.productId);
  const quote = await priceCheckout(merchant, price, settings);
  expect(quote.methods.home.totalMinor).toBe(80000);
  const key = randomUUID();
  const raw = {
    customer,
    quoteToken: quote.quoteToken,
    simulation: {
      consent: true,
      visitId: randomUUID(),
      attribution: { gclid: "TEST_CLICK_ID" },
    },
  };
  const first = await createOrder(merchant, raw, key, price.productId);
  orderId = first.order.id;
  expect(first.order).toMatchObject({
    productName: "Original product",
    variantName: "Original blue",
    productSku: "PRODUCT-SKU",
    variantSku: "BLUE-SKU",
    productImageUrl: image,
    unitPriceMinor: 15000,
  });
  const duplicate = await createOrder(merchant, raw, key, price.productId);
  expect(duplicate.order.id).toBe(orderId);
  expect(duplicate.duplicate).toBe(true);
  const rows = (await readSimulation(merchant)).events.filter(
    (e) => e.orderId === orderId,
  );
  expect(rows).toHaveLength(5);
  expect(rows.filter((e) => e.status === "deduplicated")).toHaveLength(2);
  expect(rows.filter((e) => e.status === "simulated")).toHaveLength(3);
  expect(new Set(rows.map((e) => e.eventId)).size).toBe(1);
  for (const row of rows) {
    expect(row.eventType).toBe("order_submitted");
    expect(row.payload).toMatchObject({
      simulation: true,
      providerConfirmed: false,
      properties: { currency: "DZD", value: 800, content_ids: ["BLUE-SKU"] },
      attribution_present: ["gclid"],
    });
  }
  const logs = JSON.stringify(rows);
  for (const value of [
    customer.phone,
    customer.name,
    customer.address,
    "TEST_CLICK_ID",
  ])
    expect(logs).not.toContain(value);
});
it("product edits and archival preserve snapshots and completed order state changes generate separate simulated events", async () => {
  const original = (await listOrders(merchant)).find((o) => o.id === orderId)!;
  const catalog = await getCheckoutCatalog(merchant);
  const product = catalog.products.find((p) => p.id === price.productId)!;
  await saveProduct(merchant, catalog.revision, {
    ...product,
    name: "Edited name",
    sku: "EDITED",
    variants: product.variants.map((v) => ({
      ...v,
      name: "Edited variant",
      priceMinor: 99999,
    })),
    active: false,
    deleted: true,
  });
  const stored = (await listOrders(merchant)).find((o) => o.id === orderId)!;
  expect(stored).toEqual(original);
  await setOrderStatus(merchant, orderId, "confirmed");
  await setOrderStatus(merchant, orderId, "confirmed");
  await setOrderStatus(merchant, orderId, "fulfilled");
  const events = (await readSimulation(merchant)).events.filter(
    (e) => e.orderId === orderId,
  );
  expect(events).toHaveLength(15);
  expect(events.some((e) => e.eventType === "purchase")).toBe(false);
  expect(events.filter((e) => e.eventType === "order_delivered")).toHaveLength(
    5,
  );
});
it("failed simulation retries are local, isolated and deduplicated without external network", async () => {
  const fetcher = vi.fn(() => {
    throw new Error("Network must not be used");
  });
  vi.stubGlobal("fetch", fetcher);
  const eventId = simulationEventId(merchant, randomUUID(), "purchase");
  await withSimulation(merchant, async (db) =>
    recordSimulation(db, merchant, {
      eventId,
      eventType: "purchase",
      source: "admin",
      productId: "synthetic",
      quantity: 1,
      valueMinor: 12345,
      fail: true,
    }),
  );
  expect(
    (await readSimulation(merchant)).events
      .filter((e) => e.eventId === eventId)
      .every((e) => e.status === "failed"),
  ).toBe(true);
  await expect(retrySimulation("other-merchant", eventId)).rejects.toThrow();
  await retrySimulation(merchant, eventId);
  await retrySimulation(merchant, eventId);
  const events = (await readSimulation(merchant)).events.filter(
    (e) => e.eventId === eventId,
  );
  expect(events).toHaveLength(5);
  expect(events.filter((e) => e.status === "simulated")).toHaveLength(3);
  expect(events.filter((e) => e.status === "deduplicated")).toHaveLength(2);
  expect(events.every((e) => e.attempts === 3)).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it("public product catalogs and templates are tenant-scoped and never fall back to another product", async () => {
  const token = await accountLogin(
    "public-a@example.test",
    "Synthetic-test-12345",
    "Public A",
  );
  const a = (await sessionMerchant(token))!;
  const tokenB = await accountLogin(
    "public-b@example.test",
    "Synthetic-test-12345",
    "Public B",
  );
  const b = (await sessionMerchant(tokenB))!;
  let catalog = await getCheckoutCatalog(a);
  catalog = await saveProduct(a, catalog.revision, {
    ...catalog.products[0],
    id: "public-a-product",
    sku: "A-ONLY",
  });
  const good = new Request(
    `http://localhost/api/checkout/catalog?store=${a}&product=public-a-product`,
  );
  expect((await (await readCatalog(good)).json()).products).toHaveLength(1);
  const wrong = new Request(
    `http://localhost/api/checkout/catalog?store=${b}&product=public-a-product`,
  );
  expect((await readCatalog(wrong)).status).toBe(404);
  expect(
    (
      await formConfig(
        new Request(
          `http://localhost/api/form-config?store=${b}&product=public-a-product`,
        ),
      )
    ).status,
  ).toBe(404);
  expect((await readSimulation(b)).events).toEqual([]);
  vi.stubGlobal("window", {
    location: { pathname: "/form", search: "?store=abc&product=a%26b" },
  });
  expect(storefrontUrl("/api/orders")).toBe(
    "/api/orders?store=abc&product=a%26b",
  );
  vi.stubGlobal("window", {
    location: { pathname: "/dashboard", search: "?product=foreign" },
  });
  expect(storefrontUrl("/api/checkout/catalog")).toBe("/api/checkout/catalog");
  vi.unstubAllGlobals();
});
it("does not log order events or retain click identifiers without consent", async () => {
  const input = {
    ...customer,
    productId: "demo-bag",
    variantId: "olive",
    quantity: 1,
    phone: "0552222244",
  };
  const quote = await priceCheckout(
    merchant,
    {
      ...price,
      productId: input.productId,
      variantId: input.variantId,
      quantity: 1,
    },
    await getFormSettings(merchant, input.productId),
  );
  const result = await createOrder(
    merchant,
    { customer: input, quoteToken: quote.quoteToken },
    randomUUID(),
    input.productId,
  );
  expect(result.order.simulation).toBeUndefined();
  await setOrderStatus(merchant, result.order.id, "confirmed");
  expect(
    (await readSimulation(merchant)).events.some(
      (e) => e.orderId === result.order.id,
    ),
  ).toBe(false);
});
it("rolls back order, stock and events together if simulation persistence fails", async () => {
  const catalog = await getCheckoutCatalog(merchant);
  await saveProduct(merchant, catalog.revision, {
    id: "atomic",
    name: "Atomic fixture",
    demo: false,
    active: true,
    variants: [{ id: "atomic-v", name: "Test", priceMinor: 10000, stock: 2 }],
  });
  const input = {
    ...customer,
    productId: "atomic",
    variantId: "atomic-v",
    quantity: 1,
    phone: "0552222255",
  };
  const quote = await priceCheckout(
    merchant,
    {
      ...price,
      productId: input.productId,
      variantId: input.variantId,
      quantity: 1,
    },
    await getFormSettings(merchant, input.productId),
  );
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(process.env.ORDERS_DATABASE_PATH!);
  db.exec(
    "CREATE TRIGGER reject_sim BEFORE INSERT ON simulation_events BEGIN SELECT RAISE(ABORT,'fixture failure'); END",
  );
  const before = (await listOrders(merchant)).length;
  try {
    await expect(
      createOrder(
        merchant,
        {
          customer: input,
          quoteToken: quote.quoteToken,
          simulation: { consent: true, visitId: randomUUID() },
        },
        randomUUID(),
        input.productId,
      ),
    ).rejects.toThrow();
  } finally {
    db.exec("DROP TRIGGER reject_sim");
    db.close();
  }
  expect((await listOrders(merchant)).length).toBe(before);
  expect(
    (await getCheckoutCatalog(merchant)).products.find(
      (p) => p.id === "atomic",
    )!.variants[0].stock,
  ).toBe(2);
});
it("only maps delivered COD to simulated Purchase after explicit merchant configuration", async () => {
  const state = (await readSimulation(merchant)).settings;
  await updateSimulationSettings(merchant, {
    ...state,
    purchaseOnFulfilled: true,
  });
  const input = {
    ...customer,
    productId: "demo-bag",
    variantId: "olive",
    quantity: 1,
    phone: "0552222266",
  };
  const quote = await priceCheckout(
    merchant,
    {
      ...price,
      productId: input.productId,
      variantId: input.variantId,
      quantity: 1,
    },
    await getFormSettings(merchant, input.productId),
  );
  const result = await createOrder(
    merchant,
    {
      customer: input,
      quoteToken: quote.quoteToken,
      simulation: { consent: true, visitId: randomUUID() },
    },
    randomUUID(),
    input.productId,
  );
  await setOrderStatus(merchant, result.order.id, "fulfilled");
  const events = (await readSimulation(merchant)).events.filter(
    (e) => e.orderId === result.order.id && e.eventType === "purchase",
  );
  expect(events).toHaveLength(5);
  expect(events.every((e) => e.payload.providerConfirmed === false)).toBe(true);
});
it("prices both delivery methods for a valid commune in every one of the 58 wilayas", async () => {
  const { listWilayas, listCommunes } =
    await import("../src/modules/geography/repository");
  const wilayas = listWilayas("legacy58");
  expect(wilayas).toHaveLength(58);
  const settings = await getFormSettings(merchant, "atomic");
  for (const wilaya of wilayas) {
    const commune = listCommunes("legacy58", wilaya.code!)[0];
    expect(commune).toBeTruthy();
    const quote = await priceCheckout(
      merchant,
      {
        productId: "atomic",
        variantId: "atomic-v",
        quantity: 1,
        mode: "legacy58",
        wilayaCode: wilaya.code!,
        communeId: commune.id,
      },
      settings,
    );
    expect(quote.methods.home).toMatchObject({
      available: true,
      amountMinor: 50000,
      totalMinor: 60000,
    });
    expect(quote.methods.office).toMatchObject({
      available: true,
      amountMinor: 35000,
      totalMinor: 45000,
    });
  }
});
