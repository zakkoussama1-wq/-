CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),salt TEXT NOT NULL,hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires BIGINT NOT NULL,merchant_id TEXT);
CREATE TABLE IF NOT EXISTS auth_limits(bucket INTEGER PRIMARY KEY,count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS accounts(merchant_id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shopify_shops(shop_id TEXT PRIMARY KEY,domain TEXT UNIQUE NOT NULL,merchant_id TEXT UNIQUE NOT NULL REFERENCES accounts(merchant_id),active INTEGER NOT NULL CHECK(active IN (0,1)),verified_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tenant_secrets(merchant_id TEXT NOT NULL REFERENCES accounts(merchant_id),provider TEXT NOT NULL,encrypted_value TEXT NOT NULL,PRIMARY KEY(merchant_id,provider));
CREATE TABLE IF NOT EXISTS shopify_catalog(merchant_id TEXT PRIMARY KEY REFERENCES accounts(merchant_id),shop_id TEXT NOT NULL,payload TEXT NOT NULL,synced_at TEXT NOT NULL,revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS shopify_catalog_dirty(merchant_id TEXT PRIMARY KEY REFERENCES accounts(merchant_id),dirty INTEGER NOT NULL DEFAULT 1,error TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS form_settings(merchant_id TEXT PRIMARY KEY,settings TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shopify_states(state_hash TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,shop TEXT NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS shopify_connections(merchant_id TEXT PRIMARY KEY,shop TEXT NOT NULL,encrypted_token TEXT NOT NULL,scope TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shopify_session_metadata(merchant_id TEXT PRIMARY KEY,encrypted_session TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shopify_webhook_receipts(shop TEXT NOT NULL,webhook_id TEXT NOT NULL,body_hash TEXT NOT NULL,received_at TEXT NOT NULL,PRIMARY KEY(shop,webhook_id));
CREATE TABLE IF NOT EXISTS checkout_settings(merchant_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,discount_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checkout_products(merchant_id TEXT NOT NULL,id TEXT NOT NULL,product_json TEXT NOT NULL,PRIMARY KEY(merchant_id,id));
CREATE TABLE IF NOT EXISTS shipping_settings(merchant_id TEXT NOT NULL,mode TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,generic_office INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(merchant_id,mode));
CREATE TABLE IF NOT EXISTS shipping_rules(merchant_id TEXT NOT NULL,mode TEXT NOT NULL,scope TEXT NOT NULL,target TEXT NOT NULL,rule_json TEXT NOT NULL,PRIMARY KEY(merchant_id,mode,scope,target),FOREIGN KEY(merchant_id,mode) REFERENCES shipping_settings(merchant_id,mode));
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,key TEXT NOT NULL,hash TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(merchant_id,key));
CREATE INDEX IF NOT EXISTS order_tenant_date ON orders(merchant_id,created_at);
CREATE TABLE IF NOT EXISTS submission_limits(merchant_id TEXT NOT NULL,phone_hash TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(merchant_id,phone_hash,bucket));

CREATE TABLE IF NOT EXISTS shopify_order_outbox(
 merchant_id TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES orders(id),state TEXT NOT NULL,
 shopify_order_id TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_attempt BIGINT NOT NULL DEFAULT 0,
 lease_until BIGINT NOT NULL DEFAULT 0,lease_token TEXT NOT NULL DEFAULT '',dispatched INTEGER NOT NULL DEFAULT 0,
 shop_id TEXT NOT NULL DEFAULT '',payload_hash TEXT NOT NULL DEFAULT '',payload_json TEXT NOT NULL DEFAULT '',
 error_code TEXT NOT NULL DEFAULT '',dispatched_at BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(merchant_id,order_id),UNIQUE(merchant_id,shopify_order_id));
 CREATE INDEX IF NOT EXISTS shopify_order_jobs_due ON shopify_order_outbox(state,next_attempt);
