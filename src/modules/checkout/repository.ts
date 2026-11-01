import { Database as DatabaseSync } from "../storage/database";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  catalogSchema,
  discountSchema,
  productSchema,
  type Discount,
  type CheckoutCatalog,
} from "./schema";
import { assertOwnedMedia } from "../media/storage";
import { ConflictError } from "../shipping/repository";
/** Explicit local fixture, not synchronized inventory or a live merchant product. */
const demoProduct = {
  id: "demo-bag",
  name: "حقيبة يومية عصرية",
  demo: true,
  variants: [
    { id: "olive", name: "أخضر زيتوني · مقاس واحد", priceMinor: 390000 },
    { id: "black", name: "أسود · مقاس واحد", priceMinor: 420000 },
  ],
};
export function checkoutDatabasePath() {
  return process.env.CHECKOUT_DATABASE_PATH
    ? resolve(/* turbopackIgnore: true */ process.env.CHECKOUT_DATABASE_PATH)
    : join(process.cwd(), "data", "checkout.sqlite");
}
async function database() {
  const file = checkoutDatabasePath();
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  await db.exec(
    `PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS checkout_settings(merchant_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,discount_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS checkout_products(merchant_id TEXT NOT NULL,id TEXT NOT NULL,product_json TEXT NOT NULL,PRIMARY KEY(merchant_id,id));`,
  );
  return db;
}
async function ensure(db: DatabaseSync, merchant: string) {
  const created = await db
    .prepare(
      "INSERT OR IGNORE INTO checkout_settings(merchant_id,discount_json) VALUES(?,?)",
    )
    .run(merchant, JSON.stringify({ type: "none", value: 0 }));
  if (created.changes)
    await db
      .prepare("INSERT OR IGNORE INTO checkout_products VALUES(?,?,?)")
      .run(merchant, demoProduct.id, JSON.stringify(demoProduct));
}
export async function readCheckoutSnapshot(
  db: DatabaseSync,
  merchant: string,
  prefix = "",
): Promise<CheckoutCatalog> {
  const row = (await db
    .prepare(
      `SELECT revision,discount_json FROM ${prefix}checkout_settings WHERE merchant_id=?`,
    )
    .get(merchant))!;
  return catalogSchema.parse({
    revision: Number(row.revision),
    discount: JSON.parse(String(row.discount_json)),
    products: (
      await db
        .prepare(
          `SELECT product_json FROM ${prefix}checkout_products WHERE merchant_id=? ORDER BY id`,
        )
        .all(merchant)
    ).map((r) => productSchema.parse(JSON.parse(String(r.product_json)))),
  });
}
export async function getCheckoutCatalog(merchant: string) {
  const db = await database();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`catalog:${merchant}`);
    await ensure(db, merchant);
    const result = await readCheckoutSnapshot(db, merchant);
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
export async function updateDiscount(
  merchant: string,
  revision: number,
  discount: Discount,
) {
  const valid = discountSchema.parse(discount);
  const db = await database();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`catalog:${merchant}`);
    await ensure(db, merchant);
    if ((await readCheckoutSnapshot(db, merchant)).revision !== revision)
      throw new ConflictError("تغير الخصم في جلسة أخرى. أعد تحميل الإعدادات.");
    await db
      .prepare(
        "UPDATE checkout_settings SET discount_json=?,revision=revision+1 WHERE merchant_id=?",
      )
      .run(JSON.stringify(valid), merchant);
    const next = await readCheckoutSnapshot(db, merchant);
    await db.exec("COMMIT");
    return next;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}

export async function saveProduct(
  merchant: string,
  revision: number,
  raw: unknown,
) {
  const product = productSchema.parse(raw);
  await assertOwnedMedia(merchant, [
    product.imageUrl,
    ...(product.images ?? []),
    ...product.variants.map((v) => v.imageUrl),
  ]);
  if (product.deleted) product.active = false;
  if (
    !product.id ||
    product.id.length > 100 ||
    product.variants.some(
      (v) =>
        !v.id || v.id.length > 100 || !v.name.trim() || v.name.length > 200,
    )
  )
    throw new RangeError("تحقق من بيانات المنتج والخيارات.");
  const db = await database();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`catalog:${merchant}`);
    await ensure(db, merchant);
    const current = await readCheckoutSnapshot(db, merchant);
    if (current.revision !== revision)
      throw new ConflictError("تغير الكتالوج. أعد تحميل المنتجات.");
    const references = (p: typeof product) =>
      [
        p.imageUrl,
        ...(p.images ?? []),
        ...p.variants.map((v) => v.imageUrl),
      ].filter((value): value is string => !!value);
    const legacy = new Set(
      current.products
        .flatMap(references)
        .filter((value) => !value.startsWith("/media/")),
    );
    if (
      references(product).some(
        (value) => !value.startsWith("/media/") && !legacy.has(value),
      )
    )
      throw new RangeError(
        "استورد رابط الصورة أولًا للتحقق منه وحفظ نسخة محلية.",
      );
    if (
      new Set([product.imageUrl, ...(product.images ?? [])].filter(Boolean))
        .size > 12
    )
      throw new RangeError("يمكن إضافة 12 صورة كحد أقصى للمنتج.");
    const previous = current.products.find((p) => p.id === product.id);
    if (previous?.deleted)
      throw new RangeError("المنتج محذوف. أنشئ نسخة بمعرف جديد.");
    if (
      previous?.variants.some(
        (v) => !product.variants.some((n) => n.id === v.id),
      )
    )
      throw new RangeError(
        "لا تحذف خيارات منتج محفوظ؛ أوقف المنتج للاحتفاظ بسجل المخزون.",
      );
    await db
      .prepare(
        "INSERT INTO checkout_products VALUES(?,?,?) ON CONFLICT(merchant_id,id) DO UPDATE SET product_json=excluded.product_json",
      )
      .run(merchant, product.id, JSON.stringify(product));
    await db
      .prepare(
        "UPDATE checkout_settings SET revision=revision+1 WHERE merchant_id=?",
      )
      .run(merchant);
    const result = await readCheckoutSnapshot(db, merchant);
    await db.exec("COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  } finally {
    await db.close();
  }
}
