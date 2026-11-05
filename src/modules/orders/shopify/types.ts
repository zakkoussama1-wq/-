export type SyncState =
  | "queued"
  | "processing"
  | "retryable"
  | "reauthorization"
  | "uncertain"
  | "review"
  | "synced"
  | "cancelled";
export interface ShopifySyncView {
  state: SyncState | "not_queued";
  enabled: boolean;
  shopifyOrderId: string | null;
  attempts: number;
  errorCode: string;
  trialPreparationAllowed?: boolean;
  trialDiagnosticsAllowed?: boolean;
}
export const syncLabels: Record<ShopifySyncView["state"], string> = {
  not_queued: "لم تُجهّز المزامنة",
  queued: "بانتظار المزامنة",
  processing: "جارٍ المزامنة",
  retryable: "تعذرت المزامنة مؤقتًا",
  reauthorization: "يلزم إعادة تفويض Shopify",
  uncertain: "نتيجة غير مؤكدة؛ جارٍ التحقق دون إنشاء جديد",
  review: "تحتاج المزامنة إلى مراجعة",
  synced: "تم إنشاء طلب Shopify غير المدفوع",
  cancelled: "أوقفت المزامنة للطلب الملغى",
};
export function orderSyncEnabled() {
  return (
    process.env.DZ_SHOPIFY_ORDER_SYNC === "1" &&
    !!process.env.DATABASE_URL &&
    process.env.DZ_BOOTSTRAP_MODE !== "1" &&
    process.env.DZ_LOCAL_DEMO !== "1" &&
    process.env.DZ_DISABLE_EXTERNAL_INTEGRATIONS !== "1"
  );
}
export class SyncFailure extends Error {
  constructor(
    public code: string,
    public kind: "retryable" | "reauthorization" | "review" = "review",
    public delay = 30000,
    public outcome: "unknown" | "not_created" = "unknown",
  ) {
    super(code);
  }
}

export function orderSyncMode() {
  return process.env.DZ_SHOPIFY_ORDER_SYNC_MODE ?? "single_order";
}
export function trialOrderId() {
  const id = process.env.DZ_SHOPIFY_ORDER_TRIAL_ID ?? "";
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    id,
  )
    ? id
    : null;
}
