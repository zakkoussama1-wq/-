import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Database } from "../storage/database";
import { ConflictError } from "../shipping/repository";
import type { EventType, SimulationSettings, SimulationEvent } from "./schema";
export async function ensureSimulationTables(db: Database) {
  await db.exec(`CREATE TABLE IF NOT EXISTS simulation_settings(merchant_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 0, purchase_on_fulfilled INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS simulation_events(merchant_id TEXT NOT NULL,event_id TEXT NOT NULL,platform TEXT NOT NULL,channel TEXT NOT NULL,event_type TEXT NOT NULL,source TEXT NOT NULL,order_id TEXT,product_id TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,last_attempt_at TEXT NOT NULL,PRIMARY KEY(merchant_id,event_id,platform,channel));
  CREATE TABLE IF NOT EXISTS simulation_limits(merchant_id TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(merchant_id,bucket));`);
}
async function open() {
  const path = process.env.ORDERS_DATABASE_PATH
    ? resolve(/* turbopackIgnore: true */ process.env.ORDERS_DATABASE_PATH)
    : join(process.cwd(), "data", "orders.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  await ensureSimulationTables(db);
  return db;
}
export async function simulationSettings(
  db: Database,
  merchant: string,
): Promise<SimulationSettings> {
  const row = await db
    .prepare("SELECT * FROM simulation_settings WHERE merchant_id=?")
    .get(merchant);
  return {
    revision: Number(row?.revision ?? 0),
    enabled: row?.enabled === 1,
    purchaseOnFulfilled: row?.purchase_on_fulfilled === 1,
  };
}
export function simulationEventId(
  merchant: string,
  key: string,
  event: EventType,
) {
  return createHash("sha256")
    .update(JSON.stringify([merchant, key, event]))
    .digest("hex");
}
const names = {
  meta: {
    page_view: "PageView",
    product_view: "ViewContent",
    checkout_started: "InitiateCheckout",
    order_submitted: "Lead",
    order_confirmed: "CODOrderConfirmed",
    order_delivered: "CODOrderDelivered",
    purchase: "Purchase",
  },
  tiktok: {
    page_view: "Pageview",
    product_view: "ViewContent",
    checkout_started: "InitiateCheckout",
    order_submitted: "SubmitForm",
    order_confirmed: "CODOrderConfirmed",
    order_delivered: "CODOrderDelivered",
    purchase: "CompletePayment",
  },
  google: {
    page_view: "page_view",
    product_view: "view_item",
    checkout_started: "begin_checkout",
    order_submitted: "generate_lead",
    order_confirmed: "cod_order_confirmed",
    order_delivered: "cod_order_delivered",
    purchase: "purchase",
  },
};
export type SimulationInput = {
  eventId: string;
  eventType: EventType;
  source: "browser" | "order" | "admin";
  productId: string;
  sku?: string;
  variantId?: string;
  quantity: number;
  valueMinor: number;
  orderId?: string;
  attributionKeys?: string[];
  fail?: boolean;
};
/** No transport, SDK, credentials, phone hashes or external URLs exist in this module. */
export async function recordSimulation(
  db: Database,
  merchant: string,
  event: SimulationInput,
) {
  if (!(await simulationSettings(db, merchant)).enabled) return;
  const now = new Date().toISOString();
  for (const platform of ["meta", "tiktok", "google"] as const)
    for (const channel of platform === "google"
      ? ["browser"]
      : ["browser", "server"]) {
      const existing = await db
        .prepare(
          "SELECT * FROM simulation_events WHERE merchant_id=? AND event_id=? AND platform=? AND channel=?",
        )
        .get(merchant, event.eventId, platform, channel);
      if (existing) {
        await db
          .prepare(
            "UPDATE simulation_events SET attempts=attempts+1,last_attempt_at=? WHERE merchant_id=? AND event_id=? AND platform=? AND channel=?",
          )
          .run(now, merchant, event.eventId, platform, channel);
        continue;
      }
      const counterpart = await db
        .prepare(
          "SELECT status FROM simulation_events WHERE merchant_id=? AND event_id=? AND platform=? AND status<>'failed'",
        )
        .get(merchant, event.eventId, platform);
      const status = event.fail
        ? "failed"
        : counterpart
          ? "deduplicated"
          : "simulated";
      const properties = {
        currency: "DZD",
        value: event.valueMinor / 100,
        content_ids: [event.sku || event.productId],
        product_id: event.productId,
        variant_id: event.variantId,
        quantity: event.quantity,
      };
      const payload = {
        simulation: true,
        providerConfirmed: false,
        event_name: names[platform][event.eventType],
        event_id: event.eventId,
        ...(platform === "google"
          ? {
              transaction_id: event.orderId || event.eventId,
              send_to: "SIMULATION_ONLY",
            }
          : {}),
        ...(event.orderId ? { order_id: event.orderId } : {}),
        properties,
        attribution_present: event.attributionKeys ?? [],
      };
      await db
        .prepare(
          "INSERT OR IGNORE INTO simulation_events VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)",
        )
        .run(
          merchant,
          event.eventId,
          platform,
          channel,
          event.eventType,
          event.source,
          event.orderId ?? null,
          event.productId,
          JSON.stringify(payload),
          status,
          now,
          now,
        );
    }
}
export async function withSimulation<T>(
  merchant: string,
  callback: (db: Database) => Promise<T>,
) {
  const db = await open();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`simulation:${merchant}`);
    const result = await callback(db);
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
export async function readSimulation(merchant: string) {
  return withSimulation(merchant, async (db) => {
    const settings = await simulationSettings(db, merchant);
    const rows = await db
      .prepare(
        "SELECT * FROM simulation_events WHERE merchant_id=? ORDER BY created_at DESC,event_id,platform,channel LIMIT 200",
      )
      .all(merchant);
    const events: SimulationEvent[] = rows.map((r) => ({
      eventId: String(r.event_id),
      platform: String(r.platform),
      channel: String(r.channel),
      eventType: String(r.event_type) as EventType,
      source: String(r.source) as SimulationEvent["source"],
      orderId: r.order_id ? String(r.order_id) : null,
      productId: String(r.product_id),
      payload: JSON.parse(String(r.payload)),
      status: String(r.status) as SimulationEvent["status"],
      attempts: Number(r.attempts),
      createdAt: String(r.created_at),
      lastAttemptAt: String(r.last_attempt_at),
    }));
    return { settings, events, mode: "simulation" as const };
  });
}
export async function updateSimulationSettings(
  merchant: string,
  settings: SimulationSettings,
) {
  return withSimulation(merchant, async (db) => {
    const current = await simulationSettings(db, merchant);
    if (current.revision !== settings.revision)
      throw new ConflictError("تغيرت إعدادات المحاكاة. حدّث الصفحة.");
    await db
      .prepare(
        "INSERT INTO simulation_settings VALUES(?,?,?,?) ON CONFLICT(merchant_id) DO UPDATE SET revision=excluded.revision,enabled=excluded.enabled,purchase_on_fulfilled=excluded.purchase_on_fulfilled",
      )
      .run(
        merchant,
        settings.revision + 1,
        settings.enabled ? 1 : 0,
        settings.purchaseOnFulfilled ? 1 : 0,
      );
    return { ...settings, revision: settings.revision + 1 };
  });
}
export async function retrySimulation(merchant: string, eventId: string) {
  return withSimulation(merchant, async (db) => {
    if (!(await simulationSettings(db, merchant)).enabled)
      throw new RangeError("فعّل المحاكاة المحلية أولًا.");
    const rows = await db
      .prepare(
        "SELECT * FROM simulation_events WHERE merchant_id=? AND event_id=? ORDER BY platform,channel",
      )
      .all(merchant, eventId);
    if (!rows.length) throw new RangeError("حدث المحاكاة غير موجود.");
    for (const row of rows) {
      const other = await db
        .prepare(
          "SELECT channel FROM simulation_events WHERE merchant_id=? AND event_id=? AND platform=? AND channel<>? AND status='simulated'",
        )
        .get(merchant, eventId, String(row.platform), String(row.channel));
      const status =
        row.status === "failed"
          ? other
            ? "deduplicated"
            : "simulated"
          : String(row.status);
      await db
        .prepare(
          "UPDATE simulation_events SET status=?,attempts=attempts+1,last_attempt_at=? WHERE merchant_id=? AND event_id=? AND platform=? AND channel=?",
        )
        .run(
          status,
          new Date().toISOString(),
          merchant,
          eventId,
          String(row.platform),
          String(row.channel),
        );
    }
  });
}
