-- Additive cached Shopify catalog; independent from local products and historical orders.
BEGIN;
CREATE TABLE IF NOT EXISTS shopify_catalog(merchant_id TEXT PRIMARY KEY REFERENCES accounts(merchant_id),shop_id TEXT NOT NULL,payload TEXT NOT NULL,synced_at TEXT NOT NULL,revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS shopify_catalog_dirty(merchant_id TEXT PRIMARY KEY REFERENCES accounts(merchant_id),dirty INTEGER NOT NULL DEFAULT 1,error TEXT NOT NULL DEFAULT '');
COMMIT;
-- Revert code with service stopped and retain these tables; never delete local catalog/order data.
