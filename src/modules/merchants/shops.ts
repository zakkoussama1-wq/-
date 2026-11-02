import { authDb } from "../auth/store";
import type { Database } from "../storage/database";

export const shopSchema = `CREATE TABLE IF NOT EXISTS shopify_shops(shop_id TEXT PRIMARY KEY,domain TEXT UNIQUE NOT NULL,merchant_id TEXT UNIQUE NOT NULL REFERENCES accounts(merchant_id),active INTEGER NOT NULL CHECK(active IN (0,1)),verified_at TEXT NOT NULL)`;

/** Called only inside the OAuth persistence transaction, after authenticated Admin API verification. */
export async function bindVerifiedShop(
  db: Database,
  merchant: string,
  domain: string,
  shopId: string,
) {
  if (!/^gid:\/\/shopify\/Shop\/[1-9][0-9]*$/.test(shopId))
    throw new Error("Invalid verified Shopify identity");
  await db.exec(shopSchema);
  await db.lock(`shop-id:${shopId}`);
  const existing = await db
    .prepare("SELECT merchant_id FROM shopify_shops WHERE shop_id=?")
    .get(shopId);
  if (existing && existing.merchant_id !== merchant)
    throw new Error("Shop belongs to another merchant");
  await db
    .prepare(
      "INSERT INTO shopify_shops VALUES(?,?,?,1,?) ON CONFLICT(shop_id) DO UPDATE SET domain=excluded.domain,active=1,verified_at=excluded.verified_at",
    )
    .run(shopId, domain, merchant, new Date().toISOString());
}

export async function verifiedShopForMerchant(merchant: string) {
  const db = await authDb();
  try {
    await db.exec(shopSchema);
    const row = await db
      .prepare(
        "SELECT s.shop_id,s.domain FROM shopify_shops s JOIN shopify_connections c ON c.merchant_id=s.merchant_id AND c.shop=s.domain WHERE s.merchant_id=? AND s.active=1",
      )
      .get(merchant);
    if (!row) throw new Error("Verified Shopify installation required");
    return {
      merchantId: merchant,
      shopId: String(row.shop_id),
      domain: String(row.domain),
    };
  } finally {
    await db.close();
  }
}
