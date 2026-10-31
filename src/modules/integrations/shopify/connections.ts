import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { authDb } from "../../auth/store";
import { shopHostname } from "./client";
function key() {
  const value = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("يلزم مفتاح تشفير تكاملات من ٣٢ بايت في الإعدادات الآمنة.");
  return Buffer.from(value, "hex");
}
async function dbOpen() {
  const db = await authDb();
  await db.exec(
    "CREATE TABLE IF NOT EXISTS shopify_states(state_hash TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,shop TEXT NOT NULL,expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS shopify_connections(merchant_id TEXT PRIMARY KEY,shop TEXT NOT NULL,encrypted_token TEXT NOT NULL,scope TEXT NOT NULL,updated_at TEXT NOT NULL)",
  );
  return db;
}
export async function createOAuthState(merchant: string, shop: string) {
  key();
  shop = shopHostname(shop);
  const state = randomBytes(32).toString("hex");
  const db = await dbOpen();
  try {
    await db
      .prepare("DELETE FROM shopify_states WHERE expires<?")
      .run(Date.now());
    await db
      .prepare("INSERT INTO shopify_states VALUES(?,?,?,?)")
      .run(
        createHash("sha256").update(state).digest("hex"),
        merchant,
        shop,
        Date.now() + 600000,
      );
    return state;
  } finally {
    await db.close();
  }
}
/** Consumed once, atomically, only after the callback HMAC has been verified. */
export async function consumeOAuthState(state: string, shop: string) {
  if (!/^[a-f0-9]{64}$/.test(state)) throw new Error("حالة OAuth غير صالحة.");
  const db = await dbOpen();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`oauth:${state}`);
    const hash = createHash("sha256").update(state).digest("hex");
    const row = await db
      .prepare(
        "SELECT merchant_id FROM shopify_states WHERE state_hash=? AND shop=? AND expires>?",
      )
      .get(hash, shopHostname(shop), Date.now());
    if (!row) throw new Error("انتهت جلسة الربط أو استُخدمت مسبقًا.");
    await db.prepare("DELETE FROM shopify_states WHERE state_hash=?").run(hash);
    await db.exec("COMMIT");
    return String(row.merchant_id);
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  } finally {
    await db.close();
  }
}
export async function saveConnection(
  merchant: string,
  shop: string,
  token: string,
  scope: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(merchant));
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const value = [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
  const db = await dbOpen();
  try {
    await db
      .prepare(
        "INSERT INTO shopify_connections VALUES(?,?,?,?,?) ON CONFLICT(merchant_id) DO UPDATE SET shop=excluded.shop,encrypted_token=excluded.encrypted_token,scope=excluded.scope,updated_at=excluded.updated_at",
      )
      .run(
        merchant,
        shopHostname(shop),
        value,
        scope,
        new Date().toISOString(),
      );
  } finally {
    await db.close();
  }
}
export async function connectionStatus(merchant: string) {
  const db = await dbOpen();
  try {
    const row = await db
      .prepare(
        "SELECT shop,scope,updated_at FROM shopify_connections WHERE merchant_id=?",
      )
      .get(merchant);
    return row
      ? {
          connected: true,
          shop: String(row.shop),
          scope: String(row.scope),
          updatedAt: String(row.updated_at),
        }
      : { connected: false };
  } finally {
    await db.close();
  }
}
export async function connectionCredential(merchant: string) {
  const db = await dbOpen();
  try {
    const row = await db
      .prepare(
        "SELECT shop,encrypted_token FROM shopify_connections WHERE merchant_id=?",
      )
      .get(merchant);
    if (!row) throw new Error("المتجر غير مربوط.");
    const parts = String(row.encrypted_token)
      .split(".")
      .map((s) => Buffer.from(s, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), parts[0]);
    decipher.setAAD(Buffer.from(merchant));
    decipher.setAuthTag(parts[1]);
    return {
      shop: String(row.shop),
      accessToken: Buffer.concat([
        decipher.update(parts[2]),
        decipher.final(),
      ]).toString("utf8"),
    };
  } finally {
    await db.close();
  }
}
