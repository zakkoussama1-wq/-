import { createHash } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { postgresConfiguration } from "../../storage/database";
import { diagnoseOfflineCredential } from "../../integrations/shopify/connections";
import { safeJobError, type DiagnosticReport } from "./diagnostic-contract";
export class DiagnosticAccessError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export async function orderTrialDiagnostics(
  request: Request,
): Promise<DiagnosticReport> {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|; )dz_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) throw new DiagnosticAccessError("AUTH_REQUIRED", 401);
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success)
    throw new DiagnosticAccessError("DIAGNOSTIC_ORDER_REQUIRED", 400);
  const pool = new Pool({
    ...postgresConfiguration(process.env.DATABASE_URL ?? ""),
    max: 1,
  });
  try {
    const db = await pool.connect();
    try {
      await db.query("BEGIN READ ONLY");
      const session = await db.query(
        "SELECT a.merchant_id FROM sessions s JOIN accounts a ON a.merchant_id=s.merchant_id WHERE s.hash=$1 AND s.expires>$2",
        [createHash("sha256").update(token).digest("hex"), Date.now()],
      );
      const merchant = session.rows[0]?.merchant_id;
      if (!merchant) throw new DiagnosticAccessError("AUTH_REQUIRED", 401);
      const requested = new URL(request.url).searchParams.get("store");
      if (requested && requested !== merchant)
        throw new DiagnosticAccessError("TENANT_FORBIDDEN", 403);
      const owner = await db.query(
        "SELECT 1 FROM orders WHERE merchant_id=$1 AND id=$2",
        [merchant, id.data],
      );
      if (!owner.rows.length)
        throw new DiagnosticAccessError("ORDER_NOT_FOUND", 404);
      const binding = await db.query(
        "SELECT 1 FROM shopify_order_trial WHERE singleton=1 AND merchant_id=$1 AND order_id=$2",
        [merchant, id.data],
      );
      if (!binding.rows.length)
        throw new DiagnosticAccessError("DIAGNOSTIC_TRIAL_NOT_BOUND", 409);
      const shop = await db.query(
        "SELECT s.domain,c.encrypted_token,m.encrypted_session FROM shopify_shops s LEFT JOIN shopify_connections c ON c.merchant_id=s.merchant_id AND c.shop=s.domain LEFT JOIN shopify_session_metadata m ON m.merchant_id=s.merchant_id WHERE s.merchant_id=$1 AND s.active=1",
        [merchant],
      );
      if (!shop.rows.length)
        throw new DiagnosticAccessError("SHOPIFY_CONNECTION_REQUIRED", 409);
      const row = shop.rows[0];
      const job = await db.query(
        "SELECT state,dispatched,attempts,error_code,(shopify_order_id IS NOT NULL AND shopify_order_id <> '') AS has_shopify_order_id FROM shopify_order_outbox WHERE merchant_id=$1 AND order_id=$2",
        [merchant, id.data],
      );
      const j = job.rows[0];
      const states = [
        "queued",
        "processing",
        "retryable",
        "reauthorization",
        "uncertain",
        "review",
        "synced",
        "cancelled",
      ] as const;
      const state = j ? (states.includes(j.state) ? j.state : "unknown") : null;
      const result: DiagnosticReport = {
        readOnly: true,
        networkChecked: false,
        job: {
          exists: !!j,
          state,
          dispatched:
            j && (j.dispatched === 0 || j.dispatched === 1)
              ? j.dispatched
              : null,
          attempts:
            j && Number.isSafeInteger(j.attempts) && j.attempts >= 0
              ? j.attempts
              : null,
          errorCode: j ? safeJobError(j.error_code) : "",
          hasShopifyOrderId: j?.has_shopify_order_id === true,
        },
        offline: diagnoseOfflineCredential(
          merchant,
          row.domain,
          row.encrypted_token ?? null,
          row.encrypted_session ?? null,
        ),
      };
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  } finally {
    await pool.end();
  }
}
