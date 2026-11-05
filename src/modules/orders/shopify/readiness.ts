import { createHash } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { postgresConfiguration } from "../../storage/database";
import { inspectOfflineCredential } from "../../integrations/shopify/connections";
import { Session } from "@shopify/shopify-api";
import { shopHostname } from "../../integrations/shopify/client";
import { OrderContract, type Graph } from "./contract";
import { buildOrderPayload, findRemote, shopifyOrderGraph } from "./client";
import { orderSyncMode, trialOrderId, SyncFailure } from "./types";
import type { StoredOrder } from "../repository";
export class ReadinessAuthError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
type Check = { status: "passed" | "blocked" | "unverified"; code: string };
export async function checkOrderSyncReadiness(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|; )dz_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) throw new ReadinessAuthError("AUTH_REQUIRED", 401);
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) throw new ReadinessAuthError("ORDER_ID_REQUIRED", 400);
  const pool = new Pool({
    ...postgresConfiguration(process.env.DATABASE_URL ?? ""),
    max: 1,
  });
  const checks: Record<string, Check> = {};
  let local: StoredOrder | undefined;
  let shop = "",
    shopId = "",
    accessToken = "",
    savedScope = "";
  let queue: Record<string, number> = {};
  try {
    const db = await pool.connect();
    try {
      // Includes authentication and credential reading. No schema initialization or
      // refresh helpers are called. PostgreSQL itself rejects accidental writes.
      await db.query("BEGIN READ ONLY");
      const session = await db.query(
        "SELECT a.merchant_id FROM sessions s JOIN accounts a ON a.merchant_id=s.merchant_id WHERE s.hash=$1 AND s.expires>$2",
        [createHash("sha256").update(token).digest("hex"), Date.now()],
      );
      const merchant = session.rows[0]?.merchant_id as string | undefined;
      if (!merchant) throw new ReadinessAuthError("AUTH_REQUIRED", 401);
      const requested = new URL(request.url).searchParams.get("store");
      if (requested && requested !== merchant)
        throw new ReadinessAuthError("TENANT_FORBIDDEN", 403);
      const installation = await db.query(
        "SELECT s.domain,s.shop_id,c.encrypted_token,m.encrypted_session FROM shopify_shops s JOIN shopify_connections c ON c.merchant_id=s.merchant_id AND c.shop=s.domain LEFT JOIN shopify_session_metadata m ON m.merchant_id=s.merchant_id WHERE s.merchant_id=$1 AND s.active=1",
        [merchant],
      );
      const stored = installation.rows[0];
      if (!stored)
        throw new ReadinessAuthError("SHOPIFY_CONNECTION_REQUIRED", 409);
      shop = shopHostname(stored.domain);
      shopId = stored.shop_id;
      try {
        const credential = inspectOfflineCredential(
          merchant,
          shop,
          stored.encrypted_token,
          stored.encrypted_session,
        );
        accessToken = credential.accessToken;
        savedScope = credential.scope;
        checks.offline = {
          status: "passed",
          code: "OFFLINE_CURRENT_TOKEN_VERIFIED",
        };
      } catch {
        checks.offline = {
          status: "blocked",
          code: "OFFLINE_CURRENT_TOKEN_UNUSABLE",
        };
      }
      const tables = await db.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('orders','shopify_order_outbox','shopify_order_trial')",
      );
      const expected = {
        orders: ["id", "merchant_id", "status", "data"],
        shopify_order_outbox: [
          "merchant_id",
          "order_id",
          "state",
          "dispatched",
          "dispatched_at",
          "lease_token",
          "lease_until",
          "payload_hash",
          "payload_json",
          "shop_id",
          "shopify_order_id",
          "attempts",
          "next_attempt",
          "error_code",
        ],
        shopify_order_trial: [
          "singleton",
          "merchant_id",
          "order_id",
          "created_at",
        ],
      };
      const schemaOK = Object.entries(expected).every(([t, cols]) =>
        cols.every((c) =>
          tables.rows.some((r) => r.table_name === t && r.column_name === c),
        ),
      );
      checks.postgres = {
        status: schemaOK ? "passed" : "blocked",
        code: schemaOK ? "QUEUE_SCHEMA_PRESENT" : "QUEUE_SCHEMA_MISSING",
      };
      if (schemaOK) {
        const permissions = await db.query(
          "SELECT has_table_privilege('shopify_order_outbox','SELECT') AND has_table_privilege('shopify_order_outbox','UPDATE') AND has_table_privilege('shopify_order_outbox','INSERT') AND has_table_privilege('orders','SELECT') AS ok",
        );
        if (!permissions.rows[0].ok)
          checks.postgres = {
            status: "blocked",
            code: "QUEUE_PRIVILEGES_MISSING",
          };
        const constraints = await db.query(
          "SELECT c.contype,ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord) AS columns FROM pg_constraint c WHERE c.conrelid='shopify_order_outbox'::regclass",
        );
        const uniqueKeys = [
          ["p", "merchant_id,order_id"],
          ["u", "merchant_id,shopify_order_id"],
        ].every(([kind, columns]) =>
          constraints.rows.some(
            (c) =>
              c.contype === kind &&
              Array.isArray(c.columns) &&
              c.columns.join(",") === columns,
          ),
        );
        if (!uniqueKeys)
          checks.postgres = {
            status: "blocked",
            code: "QUEUE_UNIQUENESS_MISSING",
          };
        const triggers = await db.query(
          "SELECT t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND NOT t.tgisinternal AND c.relname IN ('shopify_order_trial','shopify_order_outbox')",
        );
        const guards = [
          "dz_trial_dispatch",
          "dz_trial_immutable",
          "dz_trial_no_truncate",
        ].every((n) =>
          triggers.rows.some(
            (r) => r.tgname === n && ["O", "A"].includes(r.tgenabled),
          ),
        );
        checks.databaseFence = {
          status: guards ? "passed" : "blocked",
          code: guards ? "TRIAL_GUARDS_PRESENT" : "TRIAL_GUARDS_MISSING",
        };
        const counts = await db.query(
          "SELECT state,count(*)::integer AS count FROM shopify_order_outbox WHERE merchant_id=$1 GROUP BY state",
          [merchant],
        );
        queue = Object.fromEntries(counts.rows.map((r) => [r.state, r.count]));
        const selectedJob = await db.query(
          "SELECT state,dispatched,shopify_order_id FROM shopify_order_outbox WHERE merchant_id=$1 AND order_id=$2",
          [merchant, id.data],
        );
        const candidate = selectedJob.rows[0];
        const unsent =
          candidate &&
          candidate.dispatched === 0 &&
          !candidate.shopify_order_id &&
          ["queued", "retryable"].includes(candidate.state);
        checks.selectedJob = {
          status: unsent ? "passed" : "blocked",
          code: unsent
            ? "SELECTED_JOB_UNSENT"
            : "SELECTED_JOB_NOT_READY_FOR_CREATION",
        };
        const binding = await db.query(
          "SELECT merchant_id,order_id FROM shopify_order_trial WHERE singleton=1",
        );
        const match =
          binding.rows[0]?.merchant_id === merchant &&
          binding.rows[0]?.order_id === id.data &&
          trialOrderId() === id.data &&
          orderSyncMode() === "single_order";
        checks.trial = {
          status: match ? "passed" : "blocked",
          code: match ? "SINGLE_ORDER_BOUND" : "SINGLE_ORDER_NOT_BOUND",
        };
      }
      const order = await db.query(
        "SELECT data,status FROM orders WHERE merchant_id=$1 AND id=$2",
        [merchant, id.data],
      );
      if (!order.rows[0]) throw new ReadinessAuthError("ORDER_NOT_FOUND", 404);
      local = {
        ...JSON.parse(order.rows[0].data),
        status: order.rows[0].status,
      } as StoredOrder;
      checks.localOrder = {
        status:
          local.catalogSource === "shopify" && local.status !== "cancelled"
            ? "passed"
            : "blocked",
        code:
          local.catalogSource === "shopify" && local.status !== "cancelled"
            ? "LOCAL_ORDER_ELIGIBLE"
            : "LOCAL_ORDER_INELIGIBLE",
      };
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  } finally {
    await pool.end();
  }
  if (accessToken && local) {
    const upstream = shopifyOrderGraph(shop, accessToken);
    const graph: Graph = (query, variables) => {
      if (!/^\s*query\b/.test(query))
        throw new SyncFailure("READ_ONLY_QUERY_REQUIRED");
      return upstream(query, variables);
    };
    try {
      const identity = await graph(
        "query DzOrderReadiness { shop { id currencyCode taxesIncluded } currentAppInstallation { accessScopes { handle } } }",
      );
      const scopes =
        (
          identity.currentAppInstallation as {
            accessScopes: { handle: string }[];
          }
        )?.accessScopes?.map((s) => s.handle) ?? [];
      const saved = new Session({
        id: "readiness",
        shop,
        state: "",
        isOnline: false,
        scope: savedScope,
      });
      const actual = new Session({
        id: "readiness",
        shop,
        state: "",
        isOnline: false,
        scope: scopes.join(","),
      });
      const granted = actual.isScopeIncluded(["read_products", "write_orders"]);
      checks.storedScope = {
        status: saved.isScopeIncluded(["write_orders"]) ? "passed" : "blocked",
        code: saved.isScopeIncluded(["write_orders"])
          ? "STORED_ORDER_SCOPE_VERIFIED"
          : "STORED_ORDER_SCOPE_MISSING",
      };
      checks.scopes = {
        status: granted ? "passed" : "blocked",
        code: granted ? "REQUIRED_SCOPES_VERIFIED" : "REQUIRED_SCOPES_MISSING",
      };
      const remoteShop = identity.shop as {
        id: string;
        currencyCode: string;
        taxesIncluded: boolean;
      };
      const policyOK =
        remoteShop?.id === shopId &&
        remoteShop.currencyCode === "DZD" &&
        remoteShop.taxesIncluded === false;
      checks.shopPolicy = {
        status: policyOK ? "passed" : "blocked",
        code: policyOK
          ? "DZD_ZERO_ADDITIONAL_TAX_POLICY"
          : "SHOP_CURRENCY_OR_TAX_UNSUPPORTED",
      };
      const contract = new OrderContract(graph);
      const payload = buildOrderPayload(
        local,
        await contract.hasSourceIdentifier(),
        shopId,
      );
      await contract.mutation(payload.order, payload.options);
      await findRemote(graph, payload.source, payload.sourceIdentifier);
      checks.schema = {
        status: "passed",
        code: "API_2026_10_PAYLOAD_AND_LOOKUP_VALIDATED",
      };
    } catch (error) {
      checks.upstream = {
        status: "blocked",
        code:
          error instanceof SyncFailure
            ? error.code
            : "SHOPIFY_READINESS_UNAVAILABLE",
      };
    }
    try {
      // Never return/log any customer values. A successful empty/redacted result is
      // insufficient evidence of protected field access, and stays unverified.
      const result = await graph(
        'query DzProtectedDataReadiness { orders(first:1,query:"status:any") { nodes { shippingAddress { firstName phone address1 } } } }',
      );
      const nodes = (
        result.orders as {
          nodes?: {
            shippingAddress?: {
              firstName?: string;
              phone?: string;
              address1?: string;
            } | null;
          }[];
        }
      )?.nodes;
      const observed = nodes?.some(
        (n) =>
          n.shippingAddress?.firstName &&
          n.shippingAddress.phone &&
          n.shippingAddress.address1,
      );
      checks.protectedData = {
        status: observed ? "passed" : "unverified",
        code: observed
          ? "PROTECTED_ADDRESS_READ_OBSERVED"
          : "PROTECTED_DATA_NOT_PROVEN",
      };
    } catch {
      checks.protectedData = {
        status: "blocked",
        code: "PROTECTED_DATA_READ_DENIED_OR_UNAVAILABLE",
      };
    }
  }
  const required = [
    "postgres",
    "databaseFence",
    "trial",
    "selectedJob",
    "offline",
    "localOrder",
    "scopes",
    "storedScope",
    "shopPolicy",
    "schema",
    "protectedData",
  ];
  for (const key of required)
    checks[key] ??= { status: "unverified", code: "NOT_CHECKED" };
  return {
    readOnly: true,
    liveOrderCreationVerified: false,
    ready:
      required.every((k) => checks[k]?.status === "passed") && !checks.upstream,
    checks,
    queue,
    apiVersion: "2026-10",
    syncEnabled: process.env.DZ_SHOPIFY_ORDER_SYNC === "1",
  };
}
