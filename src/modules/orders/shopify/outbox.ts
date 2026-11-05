import { trialSchema, trialGuardSchema, permittedOrder } from "./trial";
import { SyncFailure, orderSyncMode, trialOrderId } from "./types";
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
    await ensureOutbox(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
export async function ensureOutbox(db: Database) {
  await db.exec(outboxSchema + trialSchema);
  if (process.env.DATABASE_URL) await db.exec(trialGuardSchema);
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
    await db.lock("shopify-order-scope");
    if (!(await permittedOrder(db, merchant, id)))
      throw new SyncFailure("TRIAL_SCOPE_DENIED");
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

// This operation is explicit and separate from the read-only readiness endpoint.
export async function prepareOrderTrial(merchant: string, id: string) {
  if (process.env.DZ_SHOPIFY_ORDER_SYNC === "1")
    throw new SyncFailure("DISABLE_SYNC_BEFORE_TRIAL");
  if (orderSyncMode() !== "single_order" || trialOrderId() !== id)
    throw new SyncFailure("TRIAL_CONFIG_MISMATCH");
  const db = await openOutbox();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock("shopify-order-scope");
    const current = await db
      .prepare(
        "SELECT merchant_id,order_id FROM shopify_order_trial WHERE singleton=1",
      )
      .get();
    if (current) {
      if (current.merchant_id !== merchant || current.order_id !== id)
        throw new SyncFailure("TRIAL_ALREADY_BOUND");
    } else {
      const row = await db
        .prepare("SELECT * FROM orders WHERE merchant_id=? AND id=?")
        .get(merchant, id);
      if (
        !row ||
        row.status === "cancelled" ||
        JSON.parse(String(row.data)).catalogSource !== "shopify"
      )
        throw new SyncFailure("TRIAL_ORDER_INVALID");
      if (
        await db
          .prepare(
            "SELECT order_id FROM shopify_order_outbox WHERE state='processing' LIMIT 1",
          )
          .get()
      )
        throw new SyncFailure("TRIAL_WORKERS_IN_FLIGHT");
      await db
        .prepare(
          "INSERT INTO shopify_order_trial(singleton,merchant_id,order_id,created_at) VALUES(1,?,?,?)",
        )
        .run(merchant, id, new Date().toISOString());
    }
    await db.exec("COMMIT");
    return { prepared: true, orderId: id };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
