"use client";
import { useLanguage } from "@/components/language-provider";
import { useState } from "react";
import type { AdministrativeMode } from "@/modules/contracts";
import type { LocationOption } from "@/modules/geography/schema";
import { geographyResponseSchema } from "@/modules/geography/schema";
import { Button } from "../ui/button";
import { formatDzd } from "@/lib/i18n";
import type { EffectiveQuote } from "@/modules/shipping/calculator";
export function QuoteTester({
  mode,
  wilayas,
}: {
  mode: AdministrativeMode;
  wilayas: LocationOption[];
}) {
  const { t, language } = useLanguage();
  const [wilaya, setWilaya] = useState("");
  const [communes, setCommunes] = useState<LocationOption[]>([]);
  const [commune, setCommune] = useState("");
  const [method, setMethod] = useState("home");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EffectiveQuote | null>(null);
  const [error, setError] = useState("");
  async function choose(code: string) {
    setWilaya(code);
    setCommune("");
    setCommunes([]);
    setResult(null);
    setError("");
    if (!code) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/geography/communes?mode=${mode}&wilayaCode=${code}`,
      );
      if (!r.ok) throw new Error("تعذر تحميل بلديات الاختبار.");
      setCommunes(geographyResponseSchema.parse(await r.json()).items);
    } catch {
      setError("تعذر تحميل بلديات الاختبار. أعد اختيار الولاية.");
    } finally {
      setBusy(false);
    }
  }
  async function quote() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch(
        `/api/shipping/quote?${new URLSearchParams({ mode, wilayaCode: wilaya, communeId: commune, method })}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حساب الشحن.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold">{t("اختبار السعر الفعلي من الخادم")}</h2>
      <p className="text-xs leading-6 text-slate-500">
        {t(
          "النتيجة تستخدم تجاوز البلدية ثم الولاية ثم الافتراضي. لا يتم إنشاء طلب.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="quote-wilaya">{t("ولاية اختبار الشحن")}</label>
          <select
            id="quote-wilaya"
            value={wilaya}
            disabled={busy}
            onChange={(e) => void choose(e.target.value)}
          >
            <option value="">{t("اختر الولاية")}</option>
            {wilayas.map((w) => (
              <option key={w.id} value={w.code}>
                {t(w.code)} · {language === "ar" ? w.nameAr : w.nameLatin}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quote-commune">{t("بلدية اختبار الشحن")}</label>
          <select
            id="quote-commune"
            value={commune}
            disabled={busy || !wilaya}
            onChange={(e) => {
              setCommune(e.target.value);
              setResult(null);
            }}
          >
            <option value="">{t("اختر البلدية")}</option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {language === "ar" ? c.nameAr : c.nameLatin}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quote-method">{t("طريقة اختبار الشحن")}</label>
          <select
            id="quote-method"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setResult(null);
            }}
          >
            <option value="home">{t("المنزل")}</option>
            <option value="office">{t("المكتب")}</option>
          </select>
        </div>
      </div>
      <Button
        type="button"
        disabled={busy || !commune}
        onClick={() => void quote()}
      >
        {t(busy ? "جارٍ الحساب…" : "حساب الشحن")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}{" "}
      {result && (
        <p
          role="status"
          data-testid="shipping-quote"
          className="rounded-lg bg-emerald-50 p-4 text-sm leading-7"
        >
          {t(
            result.available
              ? `${t("السعر الفعلي:")} ${formatDzd(result.amount!)} · ${t("المصدر:")} ${t({ commune: "البلدية", wilaya: "الولاية", default: "الافتراضي", unavailable: "غير متاح" }[result.source])}${result.eta ? ` · ${result.eta}` : ""}`
              : result.reason,
          )}
        </p>
      )}
    </section>
  );
}
