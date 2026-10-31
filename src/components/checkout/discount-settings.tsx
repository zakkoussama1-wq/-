"use client";
import { useLanguage } from "@/components/language-provider";
import { useState } from "react";
import { Button } from "../ui/button";
import { useCheckoutCatalog } from "./use-checkout";
import {
  discountUpdateSchema,
  catalogSchema,
  type Discount,
} from "@/modules/checkout/schema";
export function DiscountSettings({ onSaved }: { onSaved: () => void }) {
  const { t } = useLanguage();
  const catalog = useCheckoutCatalog(0);
  const [draft, setDraft] = useState<{
    revision: number;
    type: Discount["type"];
    value: string;
  } | null>(null);
  const currentDraft =
    draft && draft.revision === catalog.catalog?.revision ? draft : null;
  const type = currentDraft?.type ?? catalog.catalog?.discount.type ?? "none";
  const value =
    currentDraft?.value ??
    (catalog.catalog?.discount.type === "none"
      ? ""
      : String((catalog.catalog?.discount.value ?? 0) / 100));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    if (!catalog.catalog) return;
    setMessage("");
    setError("");
    const num = type === "none" ? 0 : Number(value);
    if (
      type !== "none" &&
      (value.trim() === "" ||
        !Number.isFinite(num) ||
        Math.abs(num * 100 - Math.round(num * 100)) > 1e-6)
    ) {
      setError("أدخل قيمة خصم صحيحة حتى منزلتين عشريتين.");
      return;
    }
    const input = discountUpdateSchema.safeParse({
      revision: catalog.catalog.revision,
      discount: { type, value: Math.round(num * 100) },
    });
    if (!input.success) {
      setError(
        "الخصم يجب أن يكون غير سالب، وبحد أقصى ١٠٠٪ أو ١٠ ملايين دينار.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/checkout/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      catalogSchema.parse(data);
      setMessage("تم حفظ خصم التاجر وتحديث نموذج الطلب.");
      catalog.retry();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الخصم.");
    } finally {
      setBusy(false);
    }
  }
  const current = catalog.catalog?.discount;
  return (
    <section className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">{t("خصم نموذج الطلب")}</h2>
      <p className="text-sm leading-7 text-slate-600">
        {t(
          "خصم اختياري على مجموع المنتجات فقط، ولا يخفض تكلفة الشحن. يقتصر الخصم الثابت على قيمة المنتجات، ولا يصبح الإجمالي سالبًا.",
        )}
      </p>
      {current && (
        <p className="text-sm" data-testid="saved-discount">
          {t("المحفوظ:")} {t(" ")}{" "}
          {t(
            current.type === "none"
              ? "بدون خصم"
              : `${current.value / 100} ${t(current.type === "fixed" ? "د.ج. ثابت" : "٪")}`,
          )}
        </p>
      )}{" "}
      {catalog.loading && <p role="status">{t("جارٍ تحميل إعدادات الخصم…")}</p>}{" "}
      {catalog.error && <p role="alert">{t(catalog.error)}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="discount-type">{t("نوع خصم التاجر")}</label>
          <select
            id="discount-type"
            value={type}
            disabled={busy || catalog.loading || !catalog.catalog}
            onChange={(e) => {
              setDraft({
                revision: catalog.catalog?.revision ?? -1,
                type: e.target.value as Discount["type"],
                value: "",
              });
              setMessage("");
            }}
          >
            <option value="none">{t("بدون خصم")}</option>
            <option value="fixed">{t("مبلغ ثابت بالدينار")}</option>
            <option value="percent">{t("نسبة مئوية")}</option>
          </select>
        </div>
        {type !== "none" && (
          <div>
            <label htmlFor="discount-value">
              {t(type === "percent" ? "نسبة الخصم (٪)" : "قيمة الخصم بالدينار")}
            </label>
            <input
              id="discount-value"
              type="number"
              min="0"
              step="0.01"
              max={type === "percent" ? 100 : 10000000}
              value={value}
              disabled={busy || catalog.loading || !catalog.catalog}
              onChange={(e) =>
                setDraft({
                  revision: catalog.catalog?.revision ?? -1,
                  type,
                  value: e.target.value,
                })
              }
            />
          </div>
        )}
      </div>
      <Button
        type="button"
        disabled={busy || catalog.loading || !catalog.catalog}
        onClick={() => void save()}
      >
        {t(busy ? "جارٍ حفظ الخصم…" : "حفظ خصم التاجر")}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy || catalog.loading}
        onClick={catalog.retry}
      >
        {t("تحديث إعدادات الخصم")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}{" "}
      {message && (
        <p role="status" className="text-sm text-emerald-800">
          {t(message)}
        </p>
      )}
      <p className="text-xs text-slate-500">
        {t(
          "هذه إعدادات تاجر التطوير المحلي، وليست نظام دخول أو إدارة منتجات كاملة.",
        )}
      </p>
    </section>
  );
}
