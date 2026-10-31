"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
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
  useEffect(() => {
    fetch("/api/integrations/shopify")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        setState(data);
        setShop((value) => value || data.shop || data.suggestedShop || "");
      })
      .catch(() => setError("تعذر تحميل حالة الربط."));
  }, []);
  return (
    <section className="mb-8 space-y-4 rounded-xl bg-white p-5">
      <h2 className="text-xl font-bold">{t("التكاملات الخارجية")}</h2>
      <h3 className="font-bold">Shopify</h3>
      <p>
        {t(
          state?.connected
            ? `${t("متجر مربوط:")} ${state.shop}`
            : "لا يوجد متجر مربوط لهذا الحساب.",
        )}
      </p>
      <p className="text-sm leading-7">
        {t(
          "الربط الحالي يطلب قراءة المنتجات فقط. لا توجد مزامنة منتجات أو إنشاء طلب Shopify تلقائي بعد. نجاح الربط ليس دليلًا على عمل تلك الميزات.",
        )}
      </p>
      {state && !state.configured && (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm leading-7">
          {t(
            "يلزم ضبط معرّف تطبيق Shopify وسره وURL عودة HTTPS ومفتاح تشفير الاعتمادات في إعدادات الخادم الآمنة. لا تدخل الرموز في المحادثة.",
          )}
        </p>
      )}
      <label htmlFor="shopify-shop">{t("نطاق متجر Shopify")}</label>
      <input
        id="shopify-shop"
        dir="ltr"
        placeholder="example.myshopify.com"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
      />
      <Button
        disabled={busy || !state?.configured || !shop}
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
            setError(e instanceof Error ? e.message : "تعذر الربط.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(busy ? "جارٍ الإعداد…" : "بدء ربط المتجر")}
      </Button>
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
      <h3 className="font-bold">{t("Meta وTikTok")}</h3>
      <p className="text-sm leading-7">
        {t(
          "محولات إرسال أحداث اختبار خادمية موجودة مع التحقق من الموافقة ومعرف الحدث، لكنها غير موصولة تلقائيًا بالطلبات. لا يتم إرسال أحداث حقيقية، ولا يُعتبر طلب COD عملية شراء مدفوعة.",
        )}
      </p>
    </section>
  );
}
