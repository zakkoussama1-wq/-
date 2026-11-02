import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { authDb } from "../../auth/store";
import { shopHostname } from "./client";
import { Session } from "@shopify/shopify-api";
import { shopifySdk, SHOPIFY_SCOPES } from "./sdk";
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
  await db.exec(
    "CREATE TABLE IF NOT EXISTS shopify_session_metadata(merchant_id TEXT PRIMARY KEY,encrypted_session TEXT NOT NULL)",
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS shopify_webhook_receipts(shop TEXT NOT NULL,webhook_id TEXT NOT NULL,body_hash TEXT NOT NULL,received_at TEXT NOT NULL,PRIMARY KEY(shop,webhook_id))",
  );
  return db;
}
export async function createOAuthState(
  merchant: string,
  shop: string,
  nonce?: string,
) {
  key();
  shop = shopHostname(shop);
  const state = nonce ?? randomBytes(32).toString("hex");
  if (!/^[a-f0-9]{64}$/.test(state)) throw new Error("Invalid OAuth nonce");
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
function seal(merchant: string, plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(merchant));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
}
function unseal(merchant: string, value: string) {
  const parts = value.split(".").map((s) => Buffer.from(s, "base64"));
  if (parts.length !== 3) throw new Error("Invalid encrypted credential");
  const decipher = createDecipheriv("aes-256-gcm", key(), parts[0]);
  decipher.setAAD(Buffer.from(merchant));
  decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString(
    "utf8",
  );
}
export async function saveConnection(
  merchant: string,
  shop: string,
  token: string,
  scope: string,
  session?: Session,
) {
  shop = shopHostname(shop);
  if (
    session &&
    (session.shop !== shop || session.accessToken !== token || session.isOnline)
  )
    throw new Error("Invalid offline session binding");
  const value = seal(merchant, token);
  const db = await dbOpen();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`shopify-shop:${shop}`);
    await db.lock(`shopify:${merchant}`);
    const bound = await db
      .prepare(
        "SELECT merchant_id FROM shopify_connections WHERE shop=? AND merchant_id<>?",
      )
      .get(shop, merchant);
    if (bound)
      throw new Error("Shop already belongs to another merchant account");
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
    await db
      .prepare("DELETE FROM shopify_session_metadata WHERE merchant_id=?")
      .run(merchant);
    if (session)
      await db
        .prepare("INSERT INTO shopify_session_metadata VALUES(?,?)")
        .run(
          merchant,
          seal(merchant, JSON.stringify(session.toPropertyArray())),
        );
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
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
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`shopify:${merchant}`);
    const row = await db
      .prepare(
        "SELECT shop,encrypted_token FROM shopify_connections WHERE merchant_id=?",
      )
      .get(merchant);
    if (!row) throw new Error("المتجر غير مربوط.");
    let accessToken = unseal(merchant, String(row.encrypted_token));
    const metadata = await db
      .prepare(
        "SELECT encrypted_session FROM shopify_session_metadata WHERE merchant_id=?",
      )
      .get(merchant);
    if (metadata) {
      let session = Session.fromPropertyArray(
        JSON.parse(unseal(merchant, String(metadata.encrypted_session))),
      );
      if (session.shop !== row.shop || session.isOnline)
        throw new Error("Invalid session binding");
      if (session.isExpired(60000)) {
        if (
          !session.refreshToken ||
          !session.refreshTokenExpires ||
          session.refreshTokenExpires.getTime() <= Date.now()
        )
          throw new Error("Shopify authorization expired; reconnect the shop.");
        session = (
          await shopifySdk().auth.refreshToken({
            shop: session.shop,
            refreshToken: session.refreshToken,
          })
        ).session;
        if (
          !session.accessToken ||
          session.shop !== row.shop ||
          session.isOnline ||
          session.isExpired() ||
          !session.isScopeIncluded(SHOPIFY_SCOPES)
        )
          throw new Error("Invalid refreshed session");
        await db
          .prepare(
            "UPDATE shopify_connections SET encrypted_token=?,scope=?,updated_at=? WHERE merchant_id=?",
          )
          .run(
            seal(merchant, session.accessToken),
            session.scope ?? "",
            new Date().toISOString(),
            merchant,
          );
        await db
          .prepare(
            "UPDATE shopify_session_metadata SET encrypted_session=? WHERE merchant_id=?",
          )
          .run(
            seal(merchant, JSON.stringify(session.toPropertyArray())),
            merchant,
          );
      }
      accessToken = session.accessToken ?? "";
    }
    await db.exec("COMMIT");
    return {
      shop: String(row.shop),
      accessToken,
    };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}

/** Removes only revoked integration credentials. Customer, shipping and order data stay intact. */
export async function uninstallConnection(
  shop: string,
  webhookId: string,
  bodyHash: string,
  triggeredAt: string,
) {
  shop = shopHostname(shop);
  const db = await dbOpen();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`shopify-shop:${shop}`);
    const receipt = await db
      .prepare(
        "SELECT 1 FROM shopify_webhook_receipts WHERE shop=? AND webhook_id=?",
      )
      .get(shop, webhookId);
    if (!receipt) {
      const rows = await db
        .prepare(
          "SELECT merchant_id FROM shopify_connections WHERE shop=? AND updated_at<=?",
        )
        .all(shop, triggeredAt);
      for (const row of rows) {
        await db
          .prepare("DELETE FROM shopify_session_metadata WHERE merchant_id=?")
          .run(String(row.merchant_id));
      }
      await db
        .prepare(
          "DELETE FROM shopify_connections WHERE shop=? AND updated_at<=?",
        )
        .run(shop, triggeredAt);
      await db
        .prepare("DELETE FROM shopify_states WHERE shop=? AND expires<=?")
        .run(shop, new Date(triggeredAt).getTime() + 600000);
      await db
        .prepare("INSERT INTO shopify_webhook_receipts VALUES(?,?,?,?)")
        .run(shop, webhookId, bodyHash, new Date().toISOString());
    }
    await db.exec("COMMIT");
    return { duplicate: !!receipt };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
