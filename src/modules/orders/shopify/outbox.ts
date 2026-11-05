import { Database } from "../../storage/database";
import { join } from "node:path";
import type { StoredOrder } from "../repository";
import {
  orderSyncEnabled,
  type ShopifySyncView,
  type SyncState,
} from "./types";
export const outboxSchema = `CREATE TABLE IF NOT EXISTS shopify_order_outbox(
 merchant_id TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES orders(id),state TEXT NOT NULL,
 shopify_order_id TEXT,attempts INTEGER NOT NULL DEFAULT 0,next_attempt BIGINT NOT NULL DEFAULT 0,
 lease_until BIGINT NOT NULL DEFAULT 0,lease_token TEXT NOT NULL DEFAULT '',dispatched INTEGER NOT NULL DEFAULT 0,
 shop_id TEXT NOT NULL DEFAULT '',payload_hash TEXT NOT NULL DEFAULT '',payload_json TEXT NOT NULL DEFAULT '',
 error_code TEXT NOT NULL DEFAULT '',dispatched_at BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(merchant_id,order_id),UNIQUE(merchant_id,shopify_order_id));
 CREATE INDEX IF NOT EXISTS shopify_order_jobs_due ON shopify_order_outbox(state,next_attempt);`;
export async function openOutbox() {
  const db = new Database(
    process.env.ORDERS_DATABASE_PATH ??
      join(process.cwd(), "data/orders.sqlite"),
  );
  try {
    await db.exec(outboxSchema);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
export async function enqueueOrder(db: Database, order: StoredOrder) {
  if (order.catalogSource !== "shopify") return;
  await db
    .prepare(
      "INSERT OR IGNORE INTO shopify_order_outbox(merchant_id,order_id,state) VALUES(?,?,?)",
    )
    .run(order.merchantId, order.id, "queued");
}
export function syncView(row?: Record<string, unknown>): ShopifySyncView {
  return {
    state: row ? (row.state as SyncState) : "not_queued",
    enabled: orderSyncEnabled(),
    shopifyOrderId: row?.shopify_order_id ? String(row.shopify_order_id) : null,
    attempts: Number(row?.attempts ?? 0),
    errorCode: String(row?.error_code ?? ""),
  };
}
export async function requestOrderSync(merchant: string, id: string) {
  const db = await openOutbox();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`orders:${merchant}`);
    const row = await db
      .prepare("SELECT * FROM orders WHERE merchant_id=? AND id=?")
      .get(merchant, id);
    if (!row) throw new Error("ORDER_NOT_FOUND");
    const order = {
      ...JSON.parse(String(row.data)),
      status: row.status,
    } as StoredOrder;
    if (order.catalogSource !== "shopify") throw new Error("NOT_SHOPIFY_ORDER");
    if (order.status === "cancelled") throw new Error("ORDER_CANCELLED");
    await enqueueOrder(db, order);
    // In-flight and completed jobs are never reset. Ambiguous attempts can only reconcile.
    await db
      .prepare(
        "UPDATE shopify_order_outbox SET state=CASE WHEN dispatched=1 THEN 'uncertain' ELSE 'queued' END,next_attempt=0 WHERE merchant_id=? AND order_id=? AND state NOT IN ('synced','processing','cancelled')",
      )
      .run(merchant, id);
    const result = await db
      .prepare(
        "SELECT * FROM shopify_order_outbox WHERE merchant_id=? AND order_id=?",
      )
      .get(merchant, id);
    await db.exec("COMMIT");
    return syncView(result);
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
