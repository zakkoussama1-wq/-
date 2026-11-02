-- Additive migration. Run after accounts/shopify_connections exist, with application writes paused.
-- Existing data is preserved; unbound legacy tenants cannot access production until OAuth reauthorization.
BEGIN;
CREATE TABLE IF NOT EXISTS shopify_shops (
  shop_id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  merchant_id TEXT UNIQUE NOT NULL REFERENCES accounts(merchant_id),
  active INTEGER NOT NULL CHECK (active IN (0,1)),
  verified_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tenant_secrets (
  merchant_id TEXT NOT NULL REFERENCES accounts(merchant_id),
  provider TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  PRIMARY KEY (merchant_id, provider)
);
COMMIT;
-- Rollback: revert application code with the deployment stopped; retain these additive tables.
-- Do not drop populated tables or reset encryption keys. Access must stay closed during rollback.
