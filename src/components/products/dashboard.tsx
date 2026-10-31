"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useState } from "react";
import {
  catalogSchema,
  productSchema,
  type CheckoutCatalog,
  type CheckoutProduct,
} from "@/modules/checkout/schema";
import { Button } from "../ui/button";
import { formatDzd } from "@/lib/i18n";
export function ProductsDashboard({ onSaved }: { onSaved: () => void }) {
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState<CheckoutCatalog | null>(null);
  const [draft, setDraft] = useState<CheckoutProduct | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/products")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setCatalog(catalogSchema.parse(await r.json()));
      })
      .catch(() => setError("تعذر تحميل المنتجات."));
  }, []);
  async function save() {
    if (!draft || !catalog) return;
    setError("");
    setNotice("");
    const p = productSchema.safeParse(draft);
    if (!p.success) {
      setError("تحقق من الاسم والأسعار والمخزون ومعرفات الخيارات.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: catalog.revision, product: p.data }),
      });
      const raw = await r.json();
      if (!r.ok) throw new Error(raw.error);
      setCatalog(catalogSchema.parse(raw));
      setDraft(null);
      setNotice("تم حفظ المنتج وتحديث النموذج.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-8 space-y-4 rounded-xl bg-white p-5">
      <h2 className="text-xl font-bold">{t("إدارة منتجات متجرك")}</h2>
      <p className="text-sm leading-7">
        {t(
          "الأسعار بالدينار؛ المخزون هو الكمية المتاحة بعد الحجوزات. تُحجز الكمية عند حفظ الطلب وتُعاد مرة واحدة عند إلغائه. المنتجات الموقوفة لا تظهر للعميل. لا تُحذف الخيارات المحفوظة حفاظًا على سجل المخزون.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {t(error)}
        </p>
      )}{" "}
      {notice && (
        <p role="status" className="text-emerald-800">
          {t(notice)}
        </p>
      )}
      <Button
        disabled={!catalog || busy}
        onClick={() =>
          setDraft({
            id: crypto.randomUUID(),
            name: "",
            demo: false,
            active: true,
            variants: [
              {
                id: crypto.randomUUID(),
                name: "الخيار الأساسي",
                priceMinor: 0,
                stock: null,
              },
            ],
          })
        }
      >
        {t("إضافة منتج")}
      </Button>
      {!catalog && !error && <p role="status">{t("جارٍ تحميل المنتجات…")}</p>}{" "}
      {catalog?.products.map((p) => (
        <article key={p.id} className="rounded-lg border border-slate-200 p-4">
          <p className="font-bold">
            {t(p.name)} {t(p.demo ? "· تجريبي" : "")} ·{" "}
            {t(p.active ? "نشط" : "موقوف")}
          </p>
          <p className="my-2 text-sm">
            {t(
              p.variants
                .map(
                  (v) =>
                    `${t(v.name)}: ${formatDzd(v.priceMinor / 100)} · ${v.stock === null ? t("مخزون غير متتبّع") : `${t("متاح")} ${v.stock}`}`,
                )
                .join(" | "),
            )}
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setDraft(structuredClone(p));
              setError("");
            }}
          >
            {t("تعديل")} {t(p.name)}
          </Button>
        </article>
      ))}{" "}
      {draft && (
        <fieldset
          disabled={busy}
          className="space-y-4 rounded-xl border border-emerald-200 p-4"
        >
          <legend>{t("بيانات المنتج")}</legend>
          <label htmlFor="product-name">{t("اسم المنتج")}</label>
          <input
            id="product-name"
            maxLength={200}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <label htmlFor="product-image">
            {t("رابط صورة HTTPS (اختياري)")}
          </label>
          <input
            id="product-image"
            type="url"
            value={draft.imageUrl ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, imageUrl: e.target.value || undefined })
            }
          />
          <label className="flex items-center gap-2">
            <input
              className="!w-4"
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            {t("المنتج نشط")}
          </label>
          {draft.variants.map((v, i) => (
            <div
              key={v.id}
              className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3"
            >
              <label>
                {t("اسم الخيار")}
                <input
                  aria-label={`${t("اسم الخيار")} ${i + 1}`}
                  value={v.name}
                  maxLength={200}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variants: draft.variants.map((n, k) =>
                        k === i ? { ...n, name: e.target.value } : n,
                      ),
                    })
                  }
                />
              </label>
              <label>
                {t("السعر بالدينار")}
                <input
                  aria-label={`${t("سعر الخيار")} ${i + 1}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.priceMinor / 100}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value))
                      setDraft({
                        ...draft,
                        variants: draft.variants.map((n, k) =>
                          k === i
                            ? { ...n, priceMinor: Math.round(value * 100) }
                            : n,
                        ),
                      });
                  }}
                />
              </label>
              <label>
                {t("الكمية المتاحة (فارغ: دون تتبع)")}
                <input
                  aria-label={`${t("مخزون الخيار")} ${i + 1}`}
                  type="number"
                  min="0"
                  step="1"
                  value={v.stock ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variants: draft.variants.map((n, k) =>
                        k === i
                          ? {
                              ...n,
                              stock:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            }
                          : n,
                      ),
                    })
                  }
                />
              </label>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setDraft({
                ...draft,
                variants: [
                  ...draft.variants,
                  {
                    id: crypto.randomUUID(),
                    name: "خيار جديد",
                    priceMinor: 0,
                    stock: null,
                  },
                ],
              })
            }
          >
            {t("إضافة خيار")}
          </Button>
          <Button onClick={() => void save()}>
            {t(busy ? "جارٍ الحفظ…" : "حفظ المنتج")}
          </Button>
          <Button variant="outline" onClick={() => setDraft(null)}>
            {t("إلغاء التعديل")}
          </Button>
        </fieldset>
      )}
    </section>
  );
}
