import { enqueueOrder, ensureOutbox, syncView } from "./shopify/outbox";
import type { ShopifySyncView } from "./shopify/types";
import {
  readShopifyCatalog,
  shopifyCatalogMode,
} from "../integrations/shopify/catalog";
import { assertFormPricing } from "../forms/policy";
import {
  ensureSimulationTables,
  recordSimulation,
  simulationEventId,
  simulationSettings,
} from "../advertising/simulation";
import type { SimulationConsent } from "../advertising/schema";
import { getFormSettings } from "../forms/repository";
import { formValidationSchema } from "../forms/policy";
import { Database as DatabaseSync } from "../storage/database";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { validationRequestSchema } from "../checkout/schema";
import { type validateCheckout, CheckoutError } from "../checkout/service";
import {
  getShippingState,
  shippingDatabasePath,
  readShippingSnapshot,
} from "../shipping/repository";
import { priceCheckoutSnapshot } from "../checkout/service";
import {
  checkoutDatabasePath,
  readCheckoutSnapshot,
} from "../checkout/repository";
import { getCheckoutCatalog } from "../checkout/repository";
export const statusSchema = z.enum([
  "submitted",
  "confirmed",
  "fulfilled",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof statusSchema>;
export interface StoredOrder {
  id: string;
  merchantId: string;
  status: OrderStatus;
  createdAt: string;
  customer: ReturnType<typeof validationRequestSchema.parse>["customer"];
  quote: Awaited<ReturnType<typeof validateCheckout>>["quote"];
  productName: string;
  variantName: string;
  reservedStock?: boolean;
  catalogSource?: "shopify";
  shopifySync?: ShopifySyncView;
  productSku?: string;
  variantSku?: string;
  productImageUrl?: string;
  unitPriceMinor?: number;
  pickupInstructions?: string;
  simulation?: SimulationConsent;
}
async function dbOpen() {
  const file = process.env.ORDERS_DATABASE_PATH
    ? resolve(/* turbopackIgnore: true */ process.env.ORDERS_DATABASE_PATH)
    : join(process.cwd(), "data", "orders.sqlite");
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  await db.exec(
    `PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,key TEXT NOT NULL,hash TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(merchant_id,key)); CREATE INDEX IF NOT EXISTS order_tenant_date ON orders(merchant_id,created_at); CREATE TABLE IF NOT EXISTS submission_limits(merchant_id TEXT NOT NULL,phone_hash TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(merchant_id,phone_hash,bucket));`,
  );
  await ensureOutbox(db);
  if (process.env.NODE_ENV !== "production") await ensureSimulationTables(db);
  return db;
}
function decode(row: Record<string, unknown>): StoredOrder {
  return {
    ...JSON.parse(String(row.data)),
    status: statusSchema.parse(row.status),
  };
}
export async function createOrder(
  merchant: string,
  raw: unknown,
  key: string,
  productFormId?: string,
) {
  if (!/^[a-f0-9-]{36}$/.test(key))
    throw new CheckoutError("معرف منع التكرار غير صالح.", 400);
  const settings = await getFormSettings(merchant, productFormId);
  const input = formValidationSchema(settings).parse(raw);
  assertFormPricing(settings, input.customer);
  const shopify = shopifyCatalogMode();
  const hash = createHash("sha256")
    .update(JSON.stringify(input.customer))
    .digest("hex");
  // Resolve retries before any provider request. Recheck under the transaction lock below.
  if (shopify) {
    const previousDb = await dbOpen();
    try {
      const previous = await previousDb
        .prepare("SELECT * FROM orders WHERE merchant_id=? AND key=?")
        .get(merchant, key);
      if (previous) {
        if (previous.hash !== hash)
          throw new CheckoutError(
            "لا يمكن إعادة استخدام معرف الإرسال لطلب مختلف.",
            409,
          );
        return { order: decode(previous), duplicate: true };
      }
    } finally {
      await previousDb.close();
    }
  } else await getCheckoutCatalog(merchant);
  // Read-only Shopify access before acquiring any order transaction/client locks.
  const shopifyCatalog = shopify
    ? await readShopifyCatalog(merchant)
    : undefined;
  await getShippingState(merchant, input.customer.mode);
  const db = await dbOpen();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`orders:${merchant}`);
    const previous = await db
      .prepare("SELECT * FROM orders WHERE merchant_id=? AND key=?")
      .get(merchant, key);
    if (previous) {
      if (previous.hash !== hash)
        throw new CheckoutError(
          "لا يمكن إعادة استخدام معرف الإرسال لطلب مختلف.",
          409,
        );
      await db.exec("COMMIT");
      return { order: decode(previous), duplicate: true };
    }
    const bucket = Math.floor(Date.now() / 60000);
    const phoneHash = createHash("sha256")
      .update(input.customer.phone)
      .digest("hex");
    await db
      .prepare("DELETE FROM submission_limits WHERE bucket<?")
      .run(bucket - 60);
    const limit = await db
      .prepare(
        "SELECT count FROM submission_limits WHERE merchant_id=? AND phone_hash=? AND bucket=?",
      )
      .get(merchant, phoneHash, bucket);
    if (Number(limit?.count ?? 0) >= 5)
      throw new CheckoutError(
        "تم تجاوز محاولات الإرسال لهذا الرقم. حاول بعد دقيقة.",
        429,
      );
    const catalogPrefix = shopify
      ? ""
      : await db.attach(checkoutDatabasePath(), "checkout_store");
    const shippingPrefix = await db.attach(
      shippingDatabasePath(),
      "shipping_store",
    );
    if (!shopify) await db.lock(`catalog:${merchant}`);
    await db.lock(`shipping:${merchant}:${input.customer.mode}`);
    const catalog =
      shopifyCatalog ??
      (await readCheckoutSnapshot(db, merchant, catalogPrefix));
    const shipping = await readShippingSnapshot(
      db,
      merchant,
      input.customer.mode,
      shippingPrefix,
    );
    const { productId, variantId, quantity, mode, wilayaCode, communeId } =
      input.customer;
    const quote = await priceCheckoutSnapshot(
      merchant,
      { productId, variantId, quantity, mode, wilayaCode, communeId },
      catalog,
      shipping,
      settings,
    );
    if (!quote.methods[input.customer.method].available)
      throw new CheckoutError(quote.methods[input.customer.method].reason);
    if (quote.quoteToken !== input.quoteToken)
      throw new CheckoutError(
        "تغيرت الأسعار أو الإعدادات. حدّث الحساب وراجع الإجمالي ثم أكد مجددًا.",
        409,
      );
    const product = catalog.products.find((p) => p.id === productId)!;
    const variant = product.variants.find((v) => v.id === variantId)!;
    if (shopify && variant.stock !== null) {
      const rows = await db
        .prepare("SELECT * FROM orders WHERE merchant_id=? AND status<>?")
        .all(merchant, "cancelled");
      const allocated = rows
        .map(decode)
        .filter(
          (o) =>
            o.catalogSource === "shopify" &&
            o.customer.productId === productId &&
            o.customer.variantId === variantId,
        )
        .reduce((n, o) => n + o.customer.quantity, 0);
      if (allocated + quantity > variant.stock)
        throw new CheckoutError(
          "الكمية المطلوبة غير متوفرة بعد احتساب طلبات COD المحفوظة.",
          422,
        );
    }
    // Never mutate the Shopify catalog/inventory. Local COD allocations live in orders only.
    const reservedStock = !shopify && variant.stock !== null;
    if (reservedStock) {
      variant.stock = variant.stock! - quantity;
      await db
        .prepare(
          `UPDATE ${catalogPrefix}checkout_products SET product_json=? WHERE merchant_id=? AND id=?`,
        )
        .run(JSON.stringify(product), merchant, product.id);
    }
    const order: StoredOrder = {
      id: randomUUID(),
      merchantId: merchant,
      status: "submitted",
      createdAt: new Date().toISOString(),
      customer: input.customer,
      quote,
      reservedStock,
      ...(shopify ? { catalogSource: "shopify" as const } : {}),
      productName: product.name,
      variantName: variant.name,
      simulation:
        process.env.NODE_ENV !== "production" &&
        input.simulation &&
        (await simulationSettings(db, merchant)).enabled
          ? input.simulation
          : undefined,
      productSku: product.sku,
      variantSku: variant.sku,
      productImageUrl:
        variant.imageUrl || product.imageUrl || product.images?.[0],
      unitPriceMinor: variant.priceMinor,
      pickupInstructions:
        input.customer.method === "office"
          ? settings.officePickupInstructions
          : undefined,
    };
    await db
      .prepare("INSERT INTO orders VALUES(?,?,?,?,?,?,?)")
      .run(
        order.id,
        merchant,
        key,
        hash,
        order.status,
        order.createdAt,
        JSON.stringify(order),
      );
    await enqueueOrder(db, order);
    await db
      .prepare(
        "INSERT INTO submission_limits VALUES(?,?,?,1) ON CONFLICT(merchant_id,phone_hash,bucket) DO UPDATE SET count=submission_limits.count+1",
      )
      .run(merchant, phoneHash, bucket);
    if (order.simulation)
      await recordOrderSimulation(db, merchant, order, "order_submitted");
    await db.exec("COMMIT");
    return { order, duplicate: false };
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  } finally {
    await db.close();
  }
}
export async function listOrders(merchant: string) {
  const db = await dbOpen();
  try {
    const jobs = await db
      .prepare("SELECT * FROM shopify_order_outbox WHERE merchant_id=?")
      .all(merchant);
    const byId = new Map(jobs.map((row) => [String(row.order_id), row]));
    return (
      await db
        .prepare(
          "SELECT * FROM orders WHERE merchant_id=? ORDER BY created_at DESC,id",
        )
        .all(merchant)
    ).map((row) => {
      const order = decode(row);
      return order.catalogSource === "shopify"
        ? { ...order, shopifySync: syncView(byId.get(order.id)) }
        : order;
    });
  } finally {
    await db.close();
  }
}
export async function setOrderStatus(
  merchant: string,
  id: string,
  status: OrderStatus,
) {
  status = statusSchema.parse(status);
  if (!shopifyCatalogMode()) await getCheckoutCatalog(merchant);
  const db = await dbOpen();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`orders:${merchant}`);
    const row = await db
      .prepare("SELECT * FROM orders WHERE merchant_id=? AND id=?")
      .get(merchant, id);
    if (!row) throw new CheckoutError("الطلب غير موجود.", 404);
    const order = decode(row);
    if (order.status === status) {
      await db.exec("COMMIT");
      return;
    }
    if (
      order.status === "cancelled" ||
      order.status === "fulfilled" ||
      status === "submitted"
    )
      throw new CheckoutError(
        "لا يمكن إعادة فتح طلب ملغى أو مسلّم أو إرجاعه إلى المراجعة.",
        409,
      );
    if (status === "cancelled" && order.reservedStock) {
      const prefix = await db.attach(checkoutDatabasePath(), "checkout_store");
      await db.lock(`catalog:${merchant}`);
      const catalog = await readCheckoutSnapshot(db, merchant, prefix);
      const product = catalog.products.find(
        (p) => p.id === order.customer.productId,
      );
      const variant = product?.variants.find(
        (v) => v.id === order.customer.variantId,
      );
      if (!product || !variant)
        throw new CheckoutError(
          "تعذر استعادة المخزون؛ المنتج أو الخيار غير موجود.",
          409,
        );
      if (variant.stock !== null) {
        if (variant.stock + order.customer.quantity > 100000000)
          throw new CheckoutError(
            "تعذر إعادة المخزون: الكمية تتجاوز الحد المسموح.",
            409,
          );
        variant.stock += order.customer.quantity;
        await db
          .prepare(
            `UPDATE ${prefix}checkout_products SET product_json=? WHERE merchant_id=? AND id=?`,
          )
          .run(JSON.stringify(product), merchant, product.id);
      }
    }
    await db
      .prepare("UPDATE orders SET status=? WHERE merchant_id=? AND id=?")
      .run(status, merchant, id);
    if (
      process.env.NODE_ENV !== "production" &&
      order.simulation &&
      (status === "confirmed" || status === "fulfilled")
    ) {
      const settings = await simulationSettings(db, merchant);
      await recordOrderSimulation(
        db,
        merchant,
        order,
        status === "confirmed"
          ? "order_confirmed"
          : settings.purchaseOnFulfilled
            ? "purchase"
            : "order_delivered",
      );
    }
    await db.exec("COMMIT");
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  } finally {
    await db.close();
  }
}
export function exportOrders(orders: StoredOrder[]) {
  const cell = (s: string) =>
    '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      [
        "المعرف",
        "الاسم",
        "الهاتف",
        "الولاية",
        "البلدية",
        "الطريقة",
        "الكمية",
        "الإجمالي بالدينار",
        "الحالة",
        "التاريخ",
        "معرف المنتج",
        "رمز المنتج SKU",
        "المنتج",
        "رابط الصورة",
        "معرف الخيار",
        "الخيار",
        "رمز الخيار SKU",
        "سعر الوحدة",
        "مجموع المنتجات",
        "التوصيل",
        "الخصم",
        "تعليمات الاستلام",
      ],
      ...orders.map((o) => [
        o.id,
        o.customer.name,
        o.customer.phone,
        o.customer.wilayaCode,
        o.customer.communeId,
        o.customer.method === "home" ? "المنزل" : "المكتب",
        String(o.customer.quantity),
        String(o.quote.methods[o.customer.method].totalMinor! / 100),
        o.status,
        o.createdAt,
        o.customer.productId,
        o.productSku || "",
        o.productName,
        o.productImageUrl || "",
        o.customer.variantId,
        o.variantName,
        o.variantSku || "",
        String((o.unitPriceMinor ?? o.quote.unitPriceMinor) / 100),
        String(o.quote.subtotalMinor / 100),
        String(o.quote.methods[o.customer.method].amountMinor! / 100),
        String(o.quote.discountMinor / 100),
        o.pickupInstructions || "",
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}

async function recordOrderSimulation(
  db: DatabaseSync,
  merchant: string,
  order: StoredOrder,
  eventType:
    "order_submitted" | "order_confirmed" | "order_delivered" | "purchase",
) {
  await recordSimulation(db, merchant, {
    eventId: simulationEventId(merchant, order.id, eventType),
    eventType,
    source: "order",
    orderId: order.id,
    productId: order.customer.productId,
    sku: order.variantSku || order.productSku,
    variantId: order.customer.variantId,
    quantity: order.customer.quantity,
    valueMinor: order.quote.methods[order.customer.method].totalMinor!,
    attributionKeys: Object.keys(order.simulation?.attribution ?? {}),
  });
}
