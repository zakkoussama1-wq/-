import { randomUUID } from "node:crypto";
import type { StoredOrder } from "../repository";
import { openOutbox } from "./outbox";
import { syncSelection, permittedOrder } from "./trial";
import { orderSyncEnabled, SyncFailure, type SyncState } from "./types";
import {
  buildOrderPayload,
  payloadFingerprint,
  findRemote,
  orderClient,
  ORDER_FIELDS,
  remoteMatches,
  remoteReferenceMatches,
  type RemoteOrder,
} from "./client";
type Job = Record<string, unknown>;
async function claim(): Promise<Job | undefined> {
  const db = await openOutbox();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock("shopify-order-scope");
    await db.lock("shopify-order-claim");
    const selection = await syncSelection(db);
    if (!selection.allowed) {
      await db.exec("COMMIT");
      return;
    }
    const now = Date.now();
    const row = await db
      .prepare(
        "SELECT * FROM shopify_order_outbox WHERE next_attempt<=? AND (state IN ('queued','retryable','uncertain') OR (state='processing' AND lease_until<=?)) AND (?='' OR (merchant_id=? AND order_id=?)) ORDER BY next_attempt,order_id LIMIT 1",
      )
      .get(
        now,
        now,
        selection.orderId ?? "",
        selection.merchantId ?? "",
        selection.orderId ?? "",
      );
    if (!row) {
      await db.exec("COMMIT");
      return;
    }
    const token = randomUUID();
    await db
      .prepare(
        "UPDATE shopify_order_outbox SET state='processing',lease_token=?,lease_until=?,attempts=attempts+1 WHERE merchant_id=? AND order_id=?",
      )
      .run(token, now + 120000, String(row.merchant_id), String(row.order_id));
    await db.exec("COMMIT");
    return { ...row, lease_token: token, attempts: Number(row.attempts) + 1 };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
async function finish(
  job: Job,
  state: SyncState,
  code = "",
  id: string | null = null,
  delay = 0,
  dispatched = Number(job.dispatched),
) {
  const db = await openOutbox();
  try {
    await db
      .prepare(
        "UPDATE shopify_order_outbox SET state=?,error_code=?,shopify_order_id=COALESCE(?,shopify_order_id),next_attempt=?,lease_until=0,dispatched=? WHERE merchant_id=? AND order_id=? AND lease_token=? AND state='processing'",
      )
      .run(
        state,
        code,
        id,
        Date.now() + delay,
        id ? 1 : dispatched,
        String(job.merchant_id),
        String(job.order_id),
        String(job.lease_token),
      );
  } finally {
    await db.close();
  }
}
async function localOrder(job: Job) {
  const db = await openOutbox();
  try {
    const row = await db
      .prepare("SELECT * FROM orders WHERE merchant_id=? AND id=?")
      .get(String(job.merchant_id), String(job.order_id));
    if (!row) throw new SyncFailure("LOCAL_ORDER_MISSING");
    return {
      ...JSON.parse(String(row.data)),
      status: row.status,
    } as StoredOrder;
  } finally {
    await db.close();
  }
}
async function markDispatched(
  job: Job,
  payload: ReturnType<typeof buildOrderPayload>,
  shopId: string,
) {
  const db = await openOutbox();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock("shopify-order-scope");
    if (
      !(await permittedOrder(db, String(job.merchant_id), String(job.order_id)))
    )
      throw new SyncFailure("TRIAL_SCOPE_DENIED");
    await db.lock(`orders:${job.merchant_id}`);
    const local = await db
      .prepare("SELECT status FROM orders WHERE merchant_id=? AND id=?")
      .get(String(job.merchant_id), String(job.order_id));
    if (local?.status === "cancelled")
      throw new SyncFailure("LOCAL_ORDER_CANCELLED");
    const result = await db
      .prepare(
        "UPDATE shopify_order_outbox SET dispatched=1,dispatched_at=?,shop_id=?,payload_hash=?,payload_json=? WHERE merchant_id=? AND order_id=? AND lease_token=? AND state='processing' AND dispatched=0 AND lease_until>?",
      )
      .run(
        Date.now(),
        shopId,
        payload.hash,
        JSON.stringify(payload),
        String(job.merchant_id),
        String(job.order_id),
        String(job.lease_token),
        Date.now(),
      );
    await db.exec("COMMIT");
    return result.changes === 1;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
async function recordRemote(
  job: Job,
  remote: RemoteOrder,
  local: StoredOrder,
  hash: string,
  reconciled = false,
) {
  // Keep the returned ID even when totals/payment/lines need human review.
  if (!/^gid:\/\/shopify\/Order\/\d+$/.test(remote.id))
    throw new SyncFailure("REMOTE_ID_INVALID");
  if (reconciled && !remoteReferenceMatches(remote, local, hash))
    return finish(job, "review", "REMOTE_REFERENCE_MISMATCH", null, 0, 1);
  const current = await localOrder(job);
  if (current.status === "cancelled")
    return finish(job, "review", "LOCAL_CANCELLED_REMOTE_EXISTS", remote.id);
  if (!remoteMatches(remote, local, hash))
    return finish(job, "review", "REMOTE_ORDER_MISMATCH", remote.id);
  return finish(job, "synced", "", remote.id);
}
export async function processNextOrderSync(): Promise<boolean> {
  if (!orderSyncEnabled()) return false;
  const job = await claim();
  if (!job) return false;
  let sent = Number(job.dispatched) === 1;
  let attemptedCreate = false;
  try {
    const local = await localOrder(job);
    if (local.catalogSource !== "shopify")
      throw new SyncFailure("NOT_SHOPIFY_ORDER");
    if (local.status === "cancelled" && !sent) {
      await finish(job, "cancelled");
      return true;
    }
    const client = await orderClient(local.merchantId);
    if (job.shop_id && job.shop_id !== client.shopId)
      throw new SyncFailure("SHOP_BINDING_MISMATCH");
    const sourceSupported = await client.contract.hasSourceIdentifier();
    const payload = job.payload_json
      ? (JSON.parse(String(job.payload_json)) as ReturnType<
          typeof buildOrderPayload
        >)
      : buildOrderPayload(local, sourceSupported, client.shopId);
    if (
      !payload?.hash ||
      payload.source !== `dz-cod-${local.id}` ||
      payloadFingerprint(payload.order, payload.options, client.shopId) !==
        payload.hash ||
      (job.payload_json && payload.hash !== job.payload_hash)
    )
      throw new SyncFailure("PAYLOAD_CORRUPT");
    // Validate even optional notifications, inventory and nested money/address inputs.
    if (!sent) await client.contract.mutation(payload.order, payload.options);
    if (!job.payload_json) {
      const planDb = await openOutbox();
      try {
        const stored = await planDb
          .prepare(
            "UPDATE shopify_order_outbox SET shop_id=?,payload_hash=?,payload_json=? WHERE merchant_id=? AND order_id=? AND lease_token=? AND state='processing' AND payload_json=''",
          )
          .run(
            client.shopId,
            payload.hash,
            JSON.stringify(payload),
            local.merchantId,
            local.id,
            String(job.lease_token),
          );
        if (stored.changes !== 1) return true;
      } finally {
        await planDb.close();
      }
    }
    const existing = job.shopify_order_id
      ? ((
          await client.graph(
            `query DzReadCod($id:ID!) { order(id:$id) { ${ORDER_FIELDS}${sourceSupported ? " sourceIdentifier" : ""} } }`,
            { id: job.shopify_order_id },
          )
        ).order as RemoteOrder | null)
      : await findRemote(client.graph, payload.source, sourceSupported);
    if (existing) {
      if (!sent && !(await markDispatched(job, payload, client.shopId)))
        return true;
      sent = true;
      await recordRemote(job, existing, local, payload.hash, true);
      return true;
    }
    if (sent) {
      const expired = Date.now() - Number(job.dispatched_at) > 55 * 86400000;
      await finish(
        job,
        expired ? "review" : "uncertain",
        expired ? "READ_WINDOW_EXCEEDED" : "AWAITING_REMOTE_RECONCILIATION",
        null,
        60000,
      );
      return true;
    }
    if (!orderSyncEnabled()) throw new SyncFailure("SYNC_DISABLED");
    if (!(await markDispatched(job, payload, client.shopId))) return true;
    sent = true;
    attemptedCreate = true;
    const result = await client.graph(
      `mutation DzCreateCod($order:OrderCreateOrderInput!,$options:OrderCreateOptionsInput) { orderCreate(order:$order,options:$options) { order { ${ORDER_FIELDS}${sourceSupported ? " sourceIdentifier" : ""} } userErrors { field message } } }`,
      { order: payload.order, options: payload.options },
    );
    const created = result.orderCreate as {
      order?: RemoteOrder | null;
      userErrors?: unknown[];
    };
    if (created?.order) {
      await recordRemote(job, created.order, local, payload.hash);
      return true;
    }
    if (
      created?.order === null &&
      Array.isArray(created.userErrors) &&
      created.userErrors.length
    ) {
      // Explicit rejection proves no order was created. Do not retry invalid input in a loop.
      await finish(job, "review", "SHOPIFY_VALIDATION", null, 0, 0);
      return true;
    }
    throw new SyncFailure("CREATE_RESULT_UNKNOWN");
  } catch (error) {
    const failure =
      error instanceof SyncFailure
        ? error
        : new SyncFailure("TRANSPORT_OR_STORAGE_FAILURE", "retryable");
    const definiteRejection =
      attemptedCreate && failure.outcome === "not_created";
    if (failure.code === "MULTIPLE_REMOTE_MATCHES") sent = true;
    const ambiguous = sent && !definiteRejection;
    let state: SyncState = ambiguous ? "uncertain" : failure.kind;
    if (failure.code === "MULTIPLE_REMOTE_MATCHES") state = "review";
    if (Number(job.attempts) >= 5 && state === "retryable") state = "review";
    await finish(
      job,
      state,
      failure.code,
      null,
      Math.max(
        failure.delay,
        Math.min(3600000, 30000 * 2 ** Math.min(Number(job.attempts) - 1, 7)),
      ),
      ambiguous ? 1 : 0,
    );
  }
  return true;
}
let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
export function startOrderSyncWorker() {
  if (timer || !orderSyncEnabled()) return;
  const tick = async () => {
    if (running || !orderSyncEnabled()) return;
    running = true;
    try {
      await processNextOrderSync();
    } catch {
      console.error(
        JSON.stringify({
          event: "shopify_order_sync_worker_failed",
          code: "QUEUE_UNAVAILABLE",
        }),
      );
    } finally {
      running = false;
    }
  };
  timer = setInterval(() => void tick(), 30000);
  timer.unref();
  void tick();
}
