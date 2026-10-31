import { Database as DatabaseSync } from "../storage/database";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { validationRequestSchema } from "../checkout/schema";
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
  return db;
}
function decode(row: Record<string, unknown>): StoredOrder {
  return {
    ...JSON.parse(String(row.data)),
    status: statusSchema.parse(row.status),
  };
}
export async function createOrder(merchant: string, raw: unknown, key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key))
    throw new CheckoutError("معرف منع التكرار غير صالح.", 400);
  const input = validationRequestSchema.parse(raw);
  const hash = createHash("sha256")
    .update(JSON.stringify(input.customer))
    .digest("hex");
  await getCheckoutCatalog(merchant);
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
    const catalogPrefix = await db.attach(
      checkoutDatabasePath(),
      "checkout_store",
    );
    const shippingPrefix = await db.attach(
      shippingDatabasePath(),
      "shipping_store",
    );
    await db.lock(`catalog:${merchant}`);
    await db.lock(`shipping:${merchant}:${input.customer.mode}`);
    const catalog = await readCheckoutSnapshot(db, merchant, catalogPrefix);
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
    const reservedStock = variant.stock !== null;
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
      productName: product.name,
      variantName: variant.name,
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
    await db
      .prepare(
        "INSERT INTO submission_limits VALUES(?,?,?,1) ON CONFLICT(merchant_id,phone_hash,bucket) DO UPDATE SET count=submission_limits.count+1",
      )
      .run(merchant, phoneHash, bucket);
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
    return (
      await db
        .prepare(
          "SELECT * FROM orders WHERE merchant_id=? ORDER BY created_at DESC,id",
        )
        .all(merchant)
    ).map(decode);
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
  await getCheckoutCatalog(merchant);
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
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
