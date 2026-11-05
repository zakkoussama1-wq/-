import type { Database } from "../../storage/database";
import { orderSyncMode, trialOrderId } from "./types";
export const trialSchema = `CREATE TABLE IF NOT EXISTS shopify_order_trial(
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),merchant_id TEXT NOT NULL,
 order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),created_at TEXT NOT NULL);`;
// Immutable binding; resetting/ending a trial requires an explicitly reviewed migration.
// The same transaction lock serializes activation, claims and dispatch transitions.
export const trialGuardSchema = `
CREATE OR REPLACE FUNCTION dz_guard_order_trial() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
 IF TG_TABLE_NAME='shopify_order_outbox' THEN
  IF NEW.dispatched<>1 THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
   IF OLD.dispatched=1 THEN RETURN NEW; END IF;
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('shopify-order-scope'));
 IF TG_TABLE_NAME='shopify_order_trial' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'TRIAL_BINDING_IMMUTABLE'; END IF;
  IF EXISTS(SELECT 1 FROM shopify_order_outbox WHERE state='processing') THEN
   RAISE EXCEPTION 'TRIAL_WORKERS_IN_FLIGHT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND merchant_id=NEW.merchant_id) THEN
   RAISE EXCEPTION 'TRIAL_ORDER_BINDING_INVALID';
  END IF;
 ELSE
  IF NEW.dispatched=1 AND (TG_OP='INSERT' OR OLD.dispatched=0) AND
   EXISTS(SELECT 1 FROM shopify_order_trial) AND NOT EXISTS(
    SELECT 1 FROM shopify_order_trial WHERE merchant_id=NEW.merchant_id AND order_id=NEW.order_id
   ) THEN RAISE EXCEPTION 'TRIAL_SCOPE_DENIED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER dz_trial_immutable BEFORE INSERT OR UPDATE OR DELETE ON shopify_order_trial
 FOR EACH ROW EXECUTE FUNCTION dz_guard_order_trial();
CREATE OR REPLACE TRIGGER dz_trial_no_truncate BEFORE TRUNCATE ON shopify_order_trial
 FOR EACH STATEMENT EXECUTE FUNCTION dz_guard_order_trial();
CREATE OR REPLACE TRIGGER dz_trial_dispatch BEFORE INSERT OR UPDATE ON shopify_order_outbox
 FOR EACH ROW EXECUTE FUNCTION dz_guard_order_trial();`;
export async function syncSelection(db: Database): Promise<{
  allowed: boolean;
  merchantId?: string;
  orderId?: string;
}> {
  const binding = await db
    .prepare(
      "SELECT merchant_id,order_id FROM shopify_order_trial WHERE singleton=1",
    )
    .get();
  if (orderSyncMode() === "all") return { allowed: !binding };
  const id = trialOrderId();
  if (
    orderSyncMode() !== "single_order" ||
    !id ||
    !binding ||
    binding.order_id !== id
  )
    return { allowed: false };
  return {
    allowed: true,
    merchantId: String(binding.merchant_id),
    orderId: id,
  };
}
export async function permittedOrder(
  db: Database,
  merchant: string,
  id: string,
) {
  const selection = await syncSelection(db);
  return (
    selection.allowed &&
    (!selection.orderId ||
      (selection.orderId === id && selection.merchantId === merchant))
  );
}
