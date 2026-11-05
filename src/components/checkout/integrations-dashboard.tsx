"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Skeleton, Surface } from "../ui/surface";
import { RefreshCw } from "lucide-react";
export function IntegrationsDashboard() {
  const { t, language } = useLanguage();
  const [scopeResult, setScopeResult] = useState<{
    readProductsGranted: boolean;
    writeOrdersGranted: boolean;
  } | null>(null);
  const [scopeError, setScopeError] = useState("");
  const [scopeLoginRequired, setScopeLoginRequired] = useState(false);
  const [scopeChecking, setScopeChecking] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
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
    setScopeResult(null);
    setScopeError("");
    setScopeLoginRequired(false);
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
  async function checkScopes() {
    if (scopeChecking) return;
    setScopeChecking(true);
    setScopeResult(null);
    setScopeError("");
    setScopeLoginRequired(false);
    try {
      // Match the dashboard's relative fetch API and HttpOnly session-cookie model.
      // Do not navigate to an external link or read/transfer a token in JavaScript.
      const response = await fetch("/api/integrations/shopify/scopes", {
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setScopeLoginRequired(true);
          setScopeError(
            "انتهت جلسة التاجر أو لم تُرسل. سجّل الدخول من لوحة التحكم ثم أعد الفحص.",
          );
        } else if (data.code === "MERCHANT_SESSION_REQUIRED") {
          setScopeLoginRequired(true);
          setScopeError(
            "جلسة الإدارة القديمة لا تحدد تاجرًا. سجّل الدخول ببريد حساب التاجر المرتبط بالمتجر.",
          );
        } else if (data.code === "TENANT_FORBIDDEN")
          setScopeError("لا يمكن فحص صلاحيات متجر آخر.");
        else if (data.code === "SHOPIFY_CONNECTION_REQUIRED")
          setScopeError(
            "هذا الحساب لا يرتبط بمتجر Shopify موثّق. أعد الربط من الحساب الصحيح.",
          );
        else if (data.code === "AUTH_CHECK_FAILED")
          setScopeError("تعذر التحقق من جلسة التاجر مؤقتًا. أعد المحاولة.");
        else
          setScopeError(
            "تعذر فحص الصلاحيات من Shopify. أعد المحاولة، أو أعد ربط المتجر إذا انتهى التفويض.",
          );
        return;
      }
      if (
        data.verified !== true ||
        typeof data.readProductsGranted !== "boolean" ||
        typeof data.writeOrdersGranted !== "boolean"
      )
        throw new Error("Invalid scope response");
      setScopeResult({
        readProductsGranted: data.readProductsGranted,
        writeOrdersGranted: data.writeOrdersGranted,
      });
    } catch {
      setScopeError("تعذر الاتصال لفحص صلاحيات Shopify. أعد المحاولة.");
    } finally {
      setScopeChecking(false);
    }
  }

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
            "حالة الربط لا تثبت الصلاحيات الفعلية. نفّذ الفحص من هذه الصفحة باستخدام جلسة حساب التاجر.",
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
        {state?.connected && (
          <div className="settings-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setSyncMessage("");
                try {
                  const response = await fetch(
                    "/api/integrations/shopify/sync",
                    { method: "POST" },
                  );
                  const data = await response.json();
                  if (!response.ok || !data.synced) throw new Error();
                  setSyncMessage(
                    {
                      ar: `اكتملت المزامنة: ${data.products} منتج.`,
                      fr: `Synchronisation terminée : ${data.products} produits.`,
                      en: `Synchronized ${data.products} products.`,
                    }[language],
                  );
                } catch {
                  setSyncMessage(
                    t(
                      "فشلت المزامنة. تحقق من التفويض وعملة المتجر ثم أعد المحاولة.",
                    ),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("مزامنة منتجات Shopify")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setSyncMessage("");
                try {
                  const r = await fetch("/api/integrations/shopify/verify");
                  const d = await r.json();
                  if (!r.ok || !d.verified) throw new Error();
                  setSyncMessage(t("نجح التحقق الحي من المتجر."));
                } catch {
                  setSyncMessage(
                    t("تعذر التحقق الحي؛ لا يُعتبر الاتصال مثبتًا."),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("التحقق الحي من الاتصال")}
            </Button>
          </div>
        )}
        <section
          className="mt-4 space-y-3 text-sm"
          aria-label={t("صلاحيات Shopify الفعلية")}
        >
          <Button
            type="button"
            variant="outline"
            disabled={loading || busy || scopeChecking}
            onClick={() => void checkScopes()}
          >
            {t(
              scopeChecking
                ? "جارٍ فحص صلاحيات Shopify…"
                : "فحص صلاحيات Shopify",
            )}
          </Button>
          <p>
            {t(
              "يستخدم الفحص جلسة حساب التاجر الحالية، ولا يفعّل مزامنة الطلبات.",
            )}
          </p>
          {scopeResult && (
            <div role="status" aria-label={t("نتيجة فحص صلاحيات Shopify")}>
              <dl className="space-y-2">
                <div>
                  <dt dir="ltr">read_products</dt>
                  <dd>
                    {t(
                      scopeResult.readProductsGranted ? "ممنوحة" : "غير ممنوحة",
                    )}
                  </dd>
                </div>
                <div>
                  <dt dir="ltr">write_orders</dt>
                  <dd>
                    {t(
                      scopeResult.writeOrdersGranted ? "ممنوحة" : "غير ممنوحة",
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {scopeError && (
            <div role="alert">
              <p>{t(scopeError)}</p>
              {scopeLoginRequired && (
                <a href="/login" className="underline">
                  {t("تسجيل الدخول بحساب التاجر")}
                </a>
              )}
            </div>
          )}
        </section>
        {syncMessage && <p role="status">{syncMessage}</p>}
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
