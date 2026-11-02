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
import { productFormLink } from "@/modules/forms/product-form";
import { MediaEditor, productImages } from "./media-editor";
import { ProductImage } from "./image";
import { formatDzd } from "@/lib/i18n";
export function ProductsDashboard({ onSaved }: { onSaved: () => void }) {
  const { t, language } = useLanguage();
  const [catalog, setCatalog] = useState<CheckoutCatalog | null>(null);
  const [shopify, setShopify] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
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
  const [store, setStore] = useState<string | null>(null);
  const [linksReady, setLinksReady] = useState(false);
  useEffect(() => {
    if (!shopify) return;
    const refresh = () => {
      if (document.visibilityState === "visible") setRevision((n) => n + 1);
    };
    const interval = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [shopify]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/auth", { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data.localDemo || typeof data.merchantId === "string") {
          setStore(
            /^[a-f0-9-]{36}$/.test(data.merchantId ?? "")
              ? data.merchantId
              : null,
          );
          setLinksReady(true);
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, []);
  const saving = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Revision explicitly retries the catalog request.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const raw = await response.json();
        const data = catalogSchema.parse(raw);
        if (!controller.signal.aborted) {
          setShopify(raw.source === "shopify");
          setShopDomain(raw.shop ?? "");
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
  async function save(removing = false) {
    if (shopify || !draft || !catalog || saving.current || uploading) return;
    setError("");
    setNotice("");
    const p = productSchema.safeParse(
      removing
        ? {
            ...catalog.products.find((p) => p.id === draft.id),
            active: false,
            deleted: true,
          }
        : draft,
    );
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
      setNotice(
        removing
          ? "تم حذف المنتج مع الاحتفاظ بسجله وصوره."
          : "تم حفظ المنتج وتحديث النموذج.",
      );
      setDeleteConfirm(false);
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
        !p.deleted &&
        (!filter || (filter === "active" ? p.active : !p.active)) &&
        `${p.name} ${p.id} ${p.sku ?? ""} ${p.variants.map((v) => `${v.name} ${v.sku ?? ""}`).join(" ")}`
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
          <p>
            {shopify
              ? t(
                  "تُقرأ المنتجات والأسعار والخيارات من Shopify. عدّلها في متجرك.",
                )
              : t("أدر الأسعار والخيارات والمخزون من مكان واحد.")}
          </p>
        </div>
        {!shopify && (
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
        )}
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
            {t("المنتجات")}:{" "}
            {catalog?.products.filter((p) => !p.deleted).length ?? "—"}
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
                          <div className="product-table-name">
                            {p.imageUrl && (
                              <ProductImage
                                src={p.imageUrl}
                                name={p.name}
                                size={40}
                              />
                            )}
                            <div>
                              <b>{t(p.name)}</b>
                              {p.sku && (
                                <span className="data-muted">
                                  <bdi>{p.sku}</bdi>
                                </span>
                              )}
                            </div>
                          </div>
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
                          {shopify ? (
                            <a
                              href={`https://${shopDomain}/admin/products/${encodeURIComponent(p.id.split("/").pop() ?? "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t("تعديل في Shopify")}
                            </a>
                          ) : (
                            <>
                              {" "}
                              {linksReady && p.active ? (
                                <>
                                  <Button asChild size="sm" variant="outline">
                                    <a
                                      href={productFormLink(p.id, store)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`${t("فتح نموذج المنتج")} ${p.name}`}
                                    >
                                      {t("فتح نموذج المنتج")}
                                    </a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    aria-label={`${t("نسخ رابط المنتج")} ${p.name}`}
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(
                                          new URL(
                                            productFormLink(p.id, store),
                                            window.location.origin,
                                          ).href,
                                        );
                                        setNotice("تم نسخ رابط نموذج المنتج.");
                                      } catch {
                                        setError(
                                          "تعذر نسخ الرابط. افتح النموذج وانسخ العنوان.",
                                        );
                                      }
                                    }}
                                  >
                                    {t("نسخ الرابط")}
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" disabled>
                                  {t("فتح نموذج المنتج")}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                aria-label={`${t("تعديل")} ${t(p.name)}`}
                                onClick={() => {
                                  setDeleteConfirm(false);
                                  setDraft(structuredClone(p));
                                  setError("");
                                }}
                              >
                                <Pencil size={13} />
                                {t("تعديل")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                aria-label={`${t("نسخ المنتج")} ${p.name}`}
                                onClick={() => {
                                  setDeleteConfirm(false);
                                  setError("");
                                  setDraft({
                                    ...structuredClone(p),
                                    id: crypto.randomUUID(),
                                    sku: "",
                                    name: `${p.name} (${t("نسخة")})`,
                                    demo: false,
                                    deleted: false,
                                    variants: p.variants.map((v) => ({
                                      ...v,
                                      id: crypto.randomUUID(),
                                      sku: "",
                                    })),
                                  });
                                }}
                              >
                                {t("نسخ المنتج")}
                              </Button>
                            </>
                          )}{" "}
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
        {shopify
          ? t(
              "لقطة Shopify تُحدّث عند إعادة القراءة بعد دقيقة أو عند وصول webhook. لا ينشأ حجز مخزون أو طلب Shopify في هذه المرحلة.",
            )
          : t(
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
          busy={busy || uploading}
          onClose={() => {
            if (!uploading) setDraft(null);
          }}
        >
          <div className="ds-dialog-body">
            <fieldset
              disabled={busy || uploading}
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
              <label htmlFor="product-sku">{t("رمز المنتج SKU")}</label>
              <input
                id="product-sku"
                dir="ltr"
                maxLength={100}
                value={draft.sku ?? ""}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              />
              <label htmlFor="product-description">{t("وصف المنتج")}</label>
              <textarea
                id="product-description"
                dir="auto"
                maxLength={2000}
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
              <label htmlFor="product-compare">
                {t("سعر المقارنة بالدينار (اختياري)")}
              </label>
              <input
                id="product-compare"
                type="number"
                min="0"
                step="0.01"
                value={
                  draft.compareAtMinor === undefined
                    ? ""
                    : draft.compareAtMinor / 100
                }
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    compareAtMinor:
                      e.target.value === ""
                        ? undefined
                        : Math.round(Number(e.target.value) * 100),
                  })
                }
              />
              <MediaEditor
                product={draft}
                onChange={setDraft}
                onBusy={setUploading}
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
                    {t("رمز الخيار SKU")}
                    <input
                      aria-label={`${t("رمز الخيار SKU")} ${i + 1}`}
                      dir="ltr"
                      maxLength={100}
                      value={v.sku ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.map((n, k) =>
                            k === i ? { ...n, sku: e.target.value } : n,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("صورة الخيار")}
                    <select
                      aria-label={`${t("صورة الخيار")} ${i + 1}`}
                      value={v.imageUrl ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.map((n, k) =>
                            k === i
                              ? { ...n, imageUrl: e.target.value || undefined }
                              : n,
                          ),
                        })
                      }
                    >
                      <option value="">{t("الصورة الرئيسية")}</option>
                      {[
                        ...new Set([
                          ...productImages(draft),
                          ...(v.imageUrl ? [v.imageUrl] : []),
                        ]),
                      ].map((src, k) => (
                        <option key={src} value={src}>
                          {t("صورة المنتج")} {k + 1}
                        </option>
                      ))}
                    </select>
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
              <Button disabled={uploading} onClick={() => void save()}>
                {t(busy ? "جارٍ الحفظ…" : "حفظ المنتج")}
              </Button>
              <Button
                disabled={uploading}
                variant="outline"
                onClick={() => setDraft(null)}
              >
                {t("إلغاء التعديل")}
              </Button>
              {catalog?.products.some((p) => p.id === draft.id) && (
                <div className="product-delete">
                  <p>
                    {t(
                      "حذف المنتج يخفيه ويحفظ خياراته وصوره لاستمرار سجل الطلبات والمخزون.",
                    )}
                  </p>
                  {deleteConfirm ? (
                    <>
                      <p>{t("هل تريد حذف هذا المنتج؟")}</p>
                      <Button
                        disabled={uploading}
                        variant="outline"
                        onClick={() => void save(true)}
                      >
                        {t("تأكيد حذف المنتج")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        {t("إلغاء")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      disabled={uploading}
                      variant="outline"
                      onClick={() => setDeleteConfirm(true)}
                    >
                      {t("حذف المنتج")}
                    </Button>
                  )}
                </div>
              )}
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
