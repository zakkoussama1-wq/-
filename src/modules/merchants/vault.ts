import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { authDb } from "../auth/store";
import { authenticatedShopTenant } from "./local-context";
export const vaultSchema =
  "CREATE TABLE IF NOT EXISTS tenant_secrets(merchant_id TEXT NOT NULL REFERENCES accounts(merchant_id),provider TEXT NOT NULL,encrypted_value TEXT NOT NULL,PRIMARY KEY(merchant_id,provider))";
function key() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new Error("Encryption key required");
  return Buffer.from(raw, "hex");
}
function providerName(provider: string) {
  if (!["meta", "tiktok", "google"].includes(provider))
    throw new Error("Unsupported provider");
}
/** Internal server infrastructure only; no HTTP route returns decrypted provider secrets. */
export async function writeTenantSecret(
  request: Request,
  provider: string,
  value: string,
) {
  providerName(provider);
  if (!value || value.length > 16384)
    throw new Error("Invalid credential length");
  const { merchantId } = await authenticatedShopTenant(request);
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(merchantId + ":" + provider));
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const encrypted = [iv, cipher.getAuthTag(), bytes]
    .map((b) => b.toString("base64"))
    .join(".");
  const db = await authDb();
  try {
    await db.exec(vaultSchema);
    await db
      .prepare(
        "INSERT INTO tenant_secrets VALUES(?,?,?) ON CONFLICT(merchant_id,provider) DO UPDATE SET encrypted_value=excluded.encrypted_value",
      )
      .run(merchantId, provider, encrypted);
  } finally {
    await db.close();
  }
}
export async function readTenantSecret(request: Request, provider: string) {
  providerName(provider);
  const { merchantId } = await authenticatedShopTenant(request);
  const db = await authDb();
  try {
    await db.exec(vaultSchema);
    const row = await db
      .prepare(
        "SELECT encrypted_value FROM tenant_secrets WHERE merchant_id=? AND provider=?",
      )
      .get(merchantId, provider);
    if (!row) return null;
    const [iv, tag, value] = String(row.encrypted_value)
      .split(".")
      .map((s) => Buffer.from(s, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAAD(Buffer.from(merchantId + ":" + provider));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(value), decipher.final()]).toString(
      "utf8",
    );
  } finally {
    await db.close();
  }
}
