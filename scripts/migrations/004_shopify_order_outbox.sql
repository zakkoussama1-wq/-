-- Additive durable COD sync queue; no customer rows or inventory are changed.
CREATE TABLE IF NOT EXISTS shopify_order_outbox(
 merchant_id TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES orders(id),state TEXT NOT NULL,
 shopify_order_id TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_attempt BIGINT NOT NULL DEFAULT 0,
 lease_until BIGINT NOT NULL DEFAULT 0,lease_token TEXT NOT NULL DEFAULT '',dispatched INTEGER NOT NULL DEFAULT 0,
 shop_id TEXT NOT NULL DEFAULT '',payload_hash TEXT NOT NULL DEFAULT '',payload_json TEXT NOT NULL DEFAULT '',
 error_code TEXT NOT NULL DEFAULT '',dispatched_at BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(merchant_id,order_id),UNIQUE(merchant_id,shopify_order_id));
 CREATE INDEX IF NOT EXISTS shopify_order_jobs_due ON shopify_order_outbox(state,next_attempt);
