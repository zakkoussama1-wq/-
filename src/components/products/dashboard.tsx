"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useState, useRef } from "react";
import {
  catalogSchema,
  productSchema,
  type CheckoutCatalog,
  type CheckoutProduct,
} from "@/modules/checkout/schema";
import { Button } from "../ui/button";
import { Search, ArrowDownUp, Plus, Pencil } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Surface, Skeleton, Toast } from "../ui/surface";
import { TablePagination } from "../ui/table-pagination";
import { formatDzd } from "@/lib/i18n";
export function ProductsDashboard({ onSaved }: { onSaved: () => void }) {
  const { t, language } = useLanguage();
  const [catalog, setCatalog] = useState<CheckoutCatalog | null>(null);
  const [draft, setDraft] = useState<CheckoutProduct | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"name" | "price">("name");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const saving = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Revision explicitly retries the catalog request.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = catalogSchema.parse(await response.json());
        if (!controller.signal.aborted) {
          setCatalog(data);
          setError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("تعذر تحميل المنتجات.");
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function save() {
    if (!draft || !catalog || saving.current) return;
    setError("");
    setNotice("");
    const p = productSchema.safeParse(draft);
    if (!p.success) {
      setError("تحقق من الاسم والأسعار والمخزون ومعرفات الخيارات.");
      return;
    }
    saving.current = true;
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
      saving.current = false;
      setBusy(false);
    }
  }
  const minimum = (p: CheckoutProduct) =>
    Math.min(...p.variants.map((v) => v.priceMinor));
  const visible = (catalog?.products ?? [])
    .filter(
      (p) =>
        (!filter || (filter === "active" ? p.active : !p.active)) &&
        `${p.name} ${p.id} ${p.variants.map((v) => v.name).join(" ")}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        (ascending ? 1 : -1) *
        (sort === "name"
          ? a.name.localeCompare(b.name, language)
          : minimum(a) - minimum(b)),
    );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / size)),
  );
  function reorder(next: "name" | "price") {
    if (sort === next) setAscending(!ascending);
    else {
      setSort(next);
      setAscending(true);
    }
    setPage(1);
  }
  return (
    <section className="data-page products-page">
      <div className="data-toolbar">
        <div>
          <h2>{t("إدارة منتجات متجرك")}</h2>
          <p>{t("أدر الأسعار والخيارات والمخزون من مكان واحد.")}</p>
        </div>
        <Button
          size="sm"
          disabled={!catalog || busy}
          onClick={() => {
            setError("");
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
            });
          }}
        >
          <Plus size={15} />
          {t("إضافة منتج")}
        </Button>
      </div>
      {error && !draft && (
        <div className="data-error" role="alert">
          <p>{t(error)}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRevision((n) => n + 1)}
          >
            {t("إعادة المحاولة")}
          </Button>
        </div>
      )}
      <Surface>
        <div className="data-filters">
          <label className="data-search">
            <span className="sr-only">{t("بحث المنتجات")}</span>
            <Search size={15} />
            <input
              value={search}
              placeholder={t("اسم المنتج أو الخيار أو المعرف")}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label={t("حالة المنتج")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("كل الحالات")}</option>
            <option value="active">{t("نشط")}</option>
            <option value="inactive">{t("موقوف")}</option>
          </select>
          <span className="data-muted">
            {t("المنتجات")}: {catalog?.products.length ?? "—"}
          </span>
        </div>
        {!catalog ? (
          <div
            className="data-loading"
            role="status"
            aria-label={t("جارٍ تحميل المنتجات…")}
          >
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <section
              className="ds-table-scroll"
              aria-label={t("جدول المنتجات")}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the wide data table.
              tabIndex={0}
            >
              <table className="ds-table data-table">
                <thead>
                  <tr>
                    <th
                      aria-sort={
                        sort === "name"
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button type="button" onClick={() => reorder("name")}>
                        {t("المنتج")}
                        <ArrowDownUp size={13} />
                      </button>
                    </th>
                    <th>{t("الحالة")}</th>
                    <th>{t("الخيارات")}</th>
                    <th
                      aria-sort={
                        sort === "price"
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button type="button" onClick={() => reorder("price")}>
                        {t("السعر من")}
                        <ArrowDownUp size={13} />
                      </button>
                    </th>
                    <th>{t("المخزون المتتبع")}</th>
                    <th>{t("الإجراءات")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible
                    .slice((currentPage - 1) * size, currentPage * size)
                    .map((p) => (
                      <tr key={p.id} data-testid={`product-row-${p.id}`}>
                        <td>
                          <b>{t(p.name)}</b>
                          <span>
                            {p.demo ? (
                              t("منتج تجريبي")
                            ) : (
                              <bdi>{p.id.slice(0, 8)}</bdi>
                            )}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`ds-status ${p.active ? "status-fulfilled" : "status-cancelled"}`}
                          >
                            {t(p.active ? "نشط" : "موقوف")}
                          </span>
                        </td>
                        <td>{p.variants.length}</td>
                        <td>{formatDzd(minimum(p) / 100)}</td>
                        <td>
                          {p.variants.every((v) => v.stock === null) ? (
                            t("مخزون غير متتبّع")
                          ) : (
                            <>
                              {p.variants.reduce(
                                (sum, v) => sum + (v.stock ?? 0),
                                0,
                              )}
                              {p.variants.some((v) => v.stock === null) && (
                                <span>{t("مع خيارات دون تتبع")}</span>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            aria-label={`${t("تعديل")} ${t(p.name)}`}
                            onClick={() => {
                              setDraft(structuredClone(p));
                              setError("");
                            }}
                          >
                            <Pencil size={13} />
                            {t("تعديل")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
            {!visible.length && (
              <div className="data-empty">
                <h3>{t("لا توجد منتجات مطابقة.")}</h3>
                <p>{t("أضف منتجًا أو غيّر البحث والتصفية.")}</p>
              </div>
            )}
            <TablePagination
              page={currentPage}
              size={size}
              total={visible.length}
              onPage={setPage}
              onSize={(n) => {
                setSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </Surface>
      <p className="data-note">
        {t(
          "الأسعار بالدينار؛ المخزون هو الكمية المتاحة بعد الحجوزات. تُحجز الكمية عند حفظ الطلب وتُعاد مرة واحدة عند إلغائه. المنتجات الموقوفة لا تظهر للعميل. لا تُحذف الخيارات المحفوظة حفاظًا على سجل المخزون.",
        )}
      </p>
      {notice && (
        <Toast closeLabel={t("إغلاق الإشعار")} onClose={() => setNotice("")}>
          {t(notice)}
        </Toast>
      )}
      {draft && (
        <Dialog
          title={t("بيانات المنتج")}
          busy={busy}
          onClose={() => setDraft(null)}
        >
          <div className="ds-dialog-body">
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
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
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
            {error && (
              <p role="alert" className="data-error">
                {t(error)}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
