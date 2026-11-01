import { afterAll, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { storeImage } from "../src/modules/media/service";
import { LocalMediaStorage } from "../src/modules/media/storage";
import {
  getCheckoutCatalog,
  saveProduct,
} from "../src/modules/checkout/repository";
import {
  getShippingState,
  changeShipping,
} from "../src/modules/shipping/repository";
import {
  createOrder,
  listOrders,
  setOrderStatus,
} from "../src/modules/orders/repository";
const dir = mkdtempSync(join(tmpdir(), "dz-product-media-"));
process.env.CHECKOUT_DATABASE_PATH = join(dir, "catalog.sqlite");
process.env.SHIPPING_DATABASE_PATH = join(dir, "shipping.sqlite");
process.env.ORDERS_DATABASE_PATH = join(dir, "orders.sqlite");
process.env.MEDIA_STORAGE_PATH = join(dir, "media");
afterAll(() => rmSync(dir, { recursive: true, force: true }));
it("preserves legacy products, persists extended fields, isolates media and safely deletes a product with reserved stock", async () => {
  let catalog = await getCheckoutCatalog("media-owner");
  const previous = catalog.products[0];
  expect(previous.id).toBe("demo-bag");
  const legacyUrl = "HTTPS://legacy-images.example/previous.png";
  const database = new DatabaseSync(process.env.CHECKOUT_DATABASE_PATH!);
  database
    .prepare(
      "UPDATE checkout_products SET product_json=? WHERE merchant_id=? AND id=?",
    )
    .run(
      JSON.stringify({ ...previous, imageUrl: legacyUrl }),
      "media-owner",
      previous.id,
    );
  database.close();
  catalog = await getCheckoutCatalog("media-owner");
  catalog = await saveProduct("media-owner", catalog.revision, {
    ...catalog.products[0],
    name: "Legacy product edited",
  });
  expect(catalog.products[0].imageUrl).toBe(legacyUrl);

  const media = await storeImage(
    "media-owner",
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer(),
    "image/png",
  );
  const product = {
    ...previous,
    id: "media-product",
    sku: "SKU-001",
    description: "Test description",
    compareAtMinor: 500000,
    imageUrl: media.url,
    images: [media.url],
    variants: [
      {
        ...previous.variants[0],
        stock: 2,
        sku: "SKU-BLUE",
        imageUrl: media.url,
      },
    ],
  };
  catalog = await saveProduct("media-owner", catalog.revision, product);
  expect(
    (await getCheckoutCatalog("media-owner")).products.find(
      (p) => p.id === product.id,
    ),
  ).toMatchObject(product);
  const other = await getCheckoutCatalog("media-other");
  await expect(
    saveProduct("media-other", other.revision, product),
  ).rejects.toThrow("لا تنتمي");
  await expect(
    saveProduct("media-owner", catalog.revision, {
      ...product,
      imageUrl: "https://images.unsplash.com/unvalidated",
    }),
  ).rejects.toThrow("استورد");
  await expect(
    saveProduct("media-owner", catalog.revision, {
      ...product,
      imageUrl: "HTTPS://images.unsplash.com/unvalidated",
    }),
  ).rejects.toThrow("استورد");
  const shipping = await getShippingState("media-owner", "legacy58");
  await changeShipping("media-owner", "legacy58", shipping.revision, {
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
  });
  const customer = {
    productId: product.id,
    variantId: product.variants[0].id,
    quantity: 1,
    mode: "legacy58",
    wilayaCode: "28",
    communeId: "dz:commune:1006",
    name: "عميل تجربة",
    phone: "0552222222",
    method: "home",
    address: "شارع الاختبار 12",
  };
  // Existing order and inventory logic remains authoritative.
  const { priceCheckout } = await import("../src/modules/checkout/service");
  const quote = await priceCheckout("media-owner", {
    productId: customer.productId,
    variantId: customer.variantId,
    quantity: customer.quantity,
    mode: "legacy58",
    wilayaCode: customer.wilayaCode,
    communeId: customer.communeId,
  });
  const order = await createOrder(
    "media-owner",
    { customer, quoteToken: quote.quoteToken },
    randomUUID(),
  );
  const snapshot = (await listOrders("media-owner"))[0];
  catalog = await getCheckoutCatalog("media-owner");
  const saved = catalog.products.find((p) => p.id === product.id)!;
  await saveProduct("media-owner", catalog.revision, {
    ...saved,
    active: false,
    deleted: true,
  });
  await setOrderStatus("media-owner", order.order.id, "cancelled");
  const deleted = (await getCheckoutCatalog("media-owner")).products.find(
    (p) => p.id === product.id,
  )!;
  expect(deleted).toMatchObject({ deleted: true, active: false });
  expect(deleted.variants[0].stock).toBe(2);
  const historical = (await listOrders("media-owner"))[0];
  expect(historical.productName).toBe(snapshot.productName);
  expect(historical.quote).toEqual(snapshot.quote);
  expect(
    (await new LocalMediaStorage(join(dir, "media")).get(media.url.slice(7)))
      .bytes.length,
  ).toBeGreaterThan(0);
});
