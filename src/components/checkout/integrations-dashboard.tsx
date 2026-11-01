"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Skeleton, Surface } from "../ui/surface";
import { RefreshCw } from "lucide-react";
export function IntegrationsDashboard() {
  const { t } = useLanguage();
  const [state, setState] = useState<{
    connected: boolean;
    configured: boolean;
    shop?: string;
  } | null>(null);
  const [shop, setShop] = useState("");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry intentionally repeats the same read after a failure.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setState(null);
    setError("");
    fetch("/api/integrations/shopify", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        setState(data);
        setShop((value) => value || data.shop || data.suggestedShop || "");
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("تعذر تحميل حالة الربط.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <div className="integration-grid">
      <Surface className="settings-panel">
        <div className="settings-panel-header">
          <h2 className="settings-heading">Shopify</h2>
          <span className="ds-status status-cancelled">
            {t(
              loading
                ? "جارٍ تحميل حالة الربط…"
                : !state
                  ? "تعذر تحميل حالة الربط."
                  : state.connected
                    ? "متصل"
                    : "غير متصل",
            )}
          </span>
        </div>
        {loading && (
          <div role="status" aria-label={t("جارٍ تحميل حالة الربط…")}>
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {!loading && state && (
          <p>
            {state.connected ? (
              <>
                {t("متجر مربوط:")} <bdi>{state.shop}</bdi>
              </>
            ) : (
              t("لا يوجد متجر مربوط لهذا الحساب.")
            )}
          </p>
        )}
        <p className="text-sm leading-7">
          {t(
            "الربط الحالي يطلب قراءة المنتجات فقط. لا توجد مزامنة منتجات أو إنشاء طلب Shopify تلقائي بعد. نجاح الربط ليس دليلًا على عمل تلك الميزات.",
          )}
        </p>
        {state && !state.configured && (
          <p
            role="note"
            className="rounded-lg bg-amber-50 p-3 text-sm leading-7"
          >
            {t(
              "يلزم ضبط معرّف تطبيق Shopify وسره وURL عودة HTTPS ومفتاح تشفير الاعتمادات في إعدادات الخادم الآمنة. لا تدخل الرموز في المحادثة.",
            )}
          </p>
        )}
        <div>
          <label htmlFor="shopify-shop">{t("نطاق متجر Shopify")}</label>
          <input
            id="shopify-shop"
            dir="ltr"
            placeholder="example.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
          />
        </div>
        <div className="settings-actions">
          <Button
            disabled={loading || busy || !state?.configured || !shop}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/integrations/shopify/start", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ shop }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setUrl(d.url);
              } catch (e) {
                setError(
                  e instanceof Error && /[\u0600-\u06ff]/.test(e.message)
                    ? e.message
                    : "تعذر الربط.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(busy ? "جارٍ الإعداد…" : "بدء ربط المتجر")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading || busy}
            onClick={() => setRetry((n) => n + 1)}
          >
            <RefreshCw size={14} />
            {t("تحديث حالة الربط")}
          </Button>
        </div>
        {url && (
          <a className="block text-emerald-800 underline" href={url}>
            {t("متابعة التفويض على Shopify")}
          </a>
        )}{" "}
        {error && (
          <p role="alert" className="text-red-700">
            {t(error)}
          </p>
        )}
      </Surface>
      <Surface className="settings-panel">
        <div className="settings-panel-header">
          <h2 className="settings-heading">{t("Meta وTikTok")}</h2>
          <span className="ds-status status-cancelled">{t("غير متصل")}</span>
        </div>
        <p className="text-sm leading-7">
          {t(
            "محولات إرسال أحداث اختبار خادمية موجودة مع التحقق من الموافقة ومعرف الحدث، لكنها غير موصولة تلقائيًا بالطلبات. لا يتم إرسال أحداث حقيقية، ولا يُعتبر طلب COD عملية شراء مدفوعة.",
          )}
        </p>
      </Surface>
    </div>
  );
}
