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
import { bindVerifiedShop, shopSchema } from "../../merchants/shops";
function key() {
  const value = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("يلزم مفتاح تشفير تكاملات من ٣٢ بايت في الإعدادات الآمنة.");
  return Buffer.from(value, "hex");
}
async function dbOpen() {
  const db = await authDb();
  await db.exec(shopSchema);
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
  verifiedShopId?: string,
) {
  if (process.env.NODE_ENV === "production" && !verifiedShopId)
    throw new Error("Verified Shopify shop identity required");
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
    if (verifiedShopId)
      await bindVerifiedShop(db, merchant, shop, verifiedShopId);
    if (verifiedShopId) {
      await db.exec(
        "CREATE TABLE IF NOT EXISTS shopify_catalog_dirty(merchant_id TEXT PRIMARY KEY REFERENCES accounts(merchant_id),dirty INTEGER NOT NULL DEFAULT 1,error TEXT NOT NULL DEFAULT '')",
      );
      await db
        .prepare(
          "INSERT INTO shopify_catalog_dirty VALUES(?,1,'') ON CONFLICT(merchant_id) DO UPDATE SET dirty=1,error=''",
        )
        .run(merchant);
    }
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
export async function connectionCredential(
  merchant: string,
  requireOffline = false,
  refreshIfExpired = true,
) {
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
    let grantedScope = "";
    if (requireOffline && !metadata)
      throw new Error("Verified offline session required");
    if (metadata) {
      let session = Session.fromPropertyArray(
        JSON.parse(unseal(merchant, String(metadata.encrypted_session))),
      );
      if (session.shop !== row.shop || session.isOnline)
        throw new Error("Invalid session binding");
      if (session.isExpired(refreshIfExpired ? 60000 : 0)) {
        if (!refreshIfExpired)
          throw new Error(
            "Current Shopify token expired; authorization check requires reconnecting.",
          );
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
      if (requireOffline && session.isExpired())
        throw new Error("Offline session expired");
      grantedScope = session.scope ?? "";
      accessToken = session.accessToken ?? "";
    }
    await db.exec("COMMIT");
    return {
      shop: String(row.shop),
      accessToken,
      offline: !!metadata,
      scopes: grantedScope.split(/[, ]+/).filter(Boolean),
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
          .prepare(
            "UPDATE shopify_shops SET active=0 WHERE merchant_id=? AND domain=?",
          )
          .run(String(row.merchant_id), shop);
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

/** Pure decoding for readiness: no database access, token refresh or credential writes. */
export function inspectOfflineCredential(
  merchant: string,
  shop: string,
  encryptedToken: string,
  encryptedSession: string | null,
) {
  if (!encryptedSession) throw new Error("OFFLINE_SESSION_REQUIRED");
  unseal(merchant, encryptedToken);
  const session = Session.fromPropertyArray(
    JSON.parse(unseal(merchant, encryptedSession)),
  );
  if (session.shop !== shop || session.isOnline || !session.accessToken)
    throw new Error("TOKEN_BINDING_INVALID");
  if (session.isExpired()) throw new Error("TOKEN_EXPIRED");
  return {
    accessToken: session.accessToken,
    scope: session.scope ?? "",
    offline: true,
  };
}

/** Local, pure diagnostic: return booleans/allowlisted reasons only; never refresh or log. */
export function diagnoseOfflineCredential(
  merchant: string,
  shop: string,
  encryptedToken: string | null,
  encryptedSession: string | null,
): import("../../orders/shopify/diagnostic-contract").OfflineDiagnostic {
  const result: import("../../orders/shopify/diagnostic-contract").OfflineDiagnostic =
    {
      connectionPresent: encryptedToken !== null,
      sessionMetadataPresent: !!encryptedSession,
      encryptionKeyFormatValid: /^[a-f0-9]{64}$/i.test(
        process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "",
      ),
      connectionTokenPresent: null,
      accessTokenPresent: null,
      offlineSession: null,
      connectionDecryptionSucceeded: null,
      sessionDecryptionSucceeded: null,
      decryptionSucceeded: null,
      shopMatches: null,
      accessTokenExpired: null,
      refreshTokenPresent: null,
      refreshTokenTimeValid: null,
      reasons: [],
    };
  if (encryptedToken === null) result.reasons.push("CONNECTION_MISSING");
  else if (!encryptedToken) result.reasons.push("CONNECTION_TOKEN_MISSING");
  if (!encryptedSession) result.reasons.push("SESSION_METADATA_MISSING");
  if (!result.encryptionKeyFormatValid) {
    result.reasons.push("ENCRYPTION_KEY_INVALID");
    return result;
  }
  if (encryptedToken) {
    try {
      const plaintext = unseal(merchant, encryptedToken);
      result.connectionDecryptionSucceeded = true;
      result.connectionTokenPresent = !!plaintext;
      if (!plaintext) result.reasons.push("CONNECTION_TOKEN_MISSING");
    } catch {
      result.connectionDecryptionSucceeded = false;
      result.reasons.push("TOKEN_DECRYPTION_FAILED");
    }
  }
  if (encryptedSession) {
    let plaintext: string;
    try {
      plaintext = unseal(merchant, encryptedSession);
      result.sessionDecryptionSucceeded = true;
    } catch {
      result.sessionDecryptionSucceeded = false;
      result.reasons.push("SESSION_DECRYPTION_FAILED");
      plaintext = "";
    }
    if (result.sessionDecryptionSucceeded) {
      try {
        const properties: unknown = JSON.parse(plaintext);
        if (
          !Array.isArray(properties) ||
          !properties.every(
            (p) =>
              Array.isArray(p) &&
              p.length === 2 &&
              typeof p[0] === "string" &&
              (p[1] === null ||
                ["string", "number", "boolean"].includes(typeof p[1])),
          )
        )
          throw new Error();
        const session = Session.fromPropertyArray(properties);
        if (
          typeof session.shop !== "string" ||
          !session.shop ||
          !properties.some((p) => p[0].toLowerCase() === "isonline") ||
          typeof session.isOnline !== "boolean" ||
          (session.accessToken !== undefined &&
            typeof session.accessToken !== "string") ||
          (session.expires && !Number.isFinite(session.expires.getTime())) ||
          (session.refreshTokenExpires &&
            !Number.isFinite(session.refreshTokenExpires.getTime()))
        )
          throw new Error();
        result.offlineSession = session.isOnline === false;
        result.accessTokenPresent = !!session.accessToken;
        result.shopMatches = session.shop === shop;
        result.accessTokenExpired = session.accessToken
          ? session.isExpired()
          : null;
        result.refreshTokenPresent = !!session.refreshToken;
        result.refreshTokenTimeValid =
          !!session.refreshToken &&
          !!session.refreshTokenExpires &&
          session.refreshTokenExpires.getTime() > Date.now();
        if (!result.offlineSession)
          result.reasons.push("OFFLINE_SESSION_REQUIRED");
        if (!result.accessTokenPresent)
          result.reasons.push("ACCESS_TOKEN_MISSING");
        if (!result.shopMatches) result.reasons.push("SHOP_BINDING_MISMATCH");
        if (result.accessTokenExpired)
          result.reasons.push("ACCESS_TOKEN_EXPIRED");
        if (!result.refreshTokenTimeValid)
          result.reasons.push("REFRESH_TOKEN_UNUSABLE");
      } catch {
        result.reasons.push("SESSION_METADATA_INVALID");
      }
    }
  }
  result.decryptionSucceeded =
    result.connectionDecryptionSucceeded === false ||
    result.sessionDecryptionSucceeded === false
      ? false
      : result.connectionDecryptionSucceeded === true &&
          result.sessionDecryptionSucceeded === true
        ? true
        : null;
  if (!result.reasons.length)
    result.reasons.push("LOCAL_CREDENTIAL_CHECKS_PASSED");
  return result;
}
