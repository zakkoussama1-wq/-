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
  ) {
    super(code);
  }
}
