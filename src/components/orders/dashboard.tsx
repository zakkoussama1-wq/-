"use client";
import { useEffect, useState, useRef } from "react";
import {
  ArrowDownToLine,
  ArrowDownUp,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { ProductImage } from "../products/image";
import { useLanguage } from "@/components/language-provider";
import type { StoredOrder, OrderStatus } from "@/modules/orders/repository";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Surface, Skeleton, Toast } from "../ui/surface";
import { TablePagination } from "../ui/table-pagination";
import { OrderLocation } from "./location";
import { formatDzd } from "@/lib/i18n";
const labels: Record<OrderStatus, string> = {
  submitted: "قيد المراجعة",
  confirmed: "مؤكد",
  fulfilled: "تم التسليم",
  cancelled: "ملغى",
};
const orderValue = (o: StoredOrder) =>
  o.quote.methods[o.customer.method].totalMinor ?? 0;
export function OrdersDashboard({
  analytics = false,
}: {
  analytics?: boolean;
}) {
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [details, setDetails] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [ascending, setAscending] = useState(false);
  const [sort, setSort] = useState<"date" | "total">("date");
  const [notice, setNotice] = useState("");
  const updating = useRef(false);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function load() {
    try {
      const r = await fetch("/api/orders");
      if (!r.ok) throw new Error();
      setOrders((await r.json()).orders);
      setLoaded(true);
      setError("");
    } catch {
      setError("تعذر تحميل الطلبات.");
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/orders", { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!abort.signal.aborted) {
          setOrders(data.orders);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setError("تعذر تحميل الطلبات.");
      });
    return () => abort.abort();
  }, []);
  async function change(id: string, next: OrderStatus) {
    if (updating.current) return;
    updating.current = true;
    setError("");
    setBusy(id);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id, status: next }),
      });
      if (!r.ok) throw new Error();
      await load();
      setNotice("تم تحديث حالة الطلب.");
    } catch {
      setError("تعذر حفظ حالة الطلب.");
    } finally {
      updating.current = false;
      setBusy(null);
    }
  }
  const visible = orders.filter(
    (o) =>
      (!status || o.status === status) &&
      (!date || o.createdAt.slice(0, 10) === date) &&
      [o.id, o.customer.name, o.customer.phone].some((v) =>
        v.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  visible.sort(
    (a, b) =>
      (ascending ? 1 : -1) *
      (sort === "date"
        ? a.createdAt.localeCompare(b.createdAt)
        : orderValue(a) - orderValue(b)),
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / size)),
  );
  const selected = orders.find((o) => o.id === details);
  function reorder(next: "date" | "total") {
    if (sort === next) setAscending(!ascending);
    else {
      setSort(next);
      setAscending(false);
    }
    setPage(1);
  }
  return (
    <section className="data-page mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">
          {t(analytics ? "تحليلات الطلبات المحفوظة" : "إدارة الطلبات المحفوظة")}
        </h2>
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => void load()}
        >
          <RefreshCw size={13} />
          {t("تحديث الطلبات")}
        </Button>
      </div>
      {error && !selected && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
        >
          {t(error)}
        </p>
      )}
      {!loaded && !error && (
        <Surface
          className="data-loading"
          role="status"
          aria-label={t("جارٍ تحميل الطلبات…")}
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </Surface>
      )}
      {loaded && analytics ? (
        <AnalyticsView orders={orders} />
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(160px,1fr)_180px_180px_auto]">
              <label className="!mb-0" htmlFor="order-search">
                {t("بحث الطلبات")}
                <div className="relative mt-1.5">
                  <Search
                    className="pointer-events-none absolute end-3 top-3 text-slate-400"
                    size={15}
                  />
                  <input
                    id="order-search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="!pe-9"
                    placeholder={t("ابحث بالاسم أو الهاتف أو رقم الطلب")}
                  />
                </div>
              </label>
              <label className="!mb-0" htmlFor="order-filter">
                {t("حالة الطلب")}
                <select
                  className="mt-1.5"
                  id="order-filter"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("الكل")}</option>
                  {Object.entries(labels).map(([k, v]) => (
                    <option value={k} key={k}>
                      {t(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="!mb-0" htmlFor="order-date">
                {t("تاريخ الطلب (UTC)")}
                <input
                  className="mt-1.5"
                  id="order-date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <Button asChild variant="outline" size="sm">
                <a href="/api/orders?format=csv">
                  <ArrowDownToLine size={14} />
                  {t("تصدير جميع الطلبات CSV")}
                </a>
              </Button>
            </div>
          </div>
          {loaded && (
            <Surface>
              <section
                className="ds-table-scroll"
                aria-label={t("جدول الطلبات")}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the wide data table.
                tabIndex={0}
              >
                <table className="ds-table data-table orders-table">
                  <thead>
                    <tr>
                      <th>{t("العميل")}</th>
                      <th>{t("المنتج")}</th>
                      <th>{t("طريقة التوصيل")}</th>
                      <th>{t("الحالة")}</th>
                      <th
                        aria-sort={
                          sort === "total"
                            ? ascending
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button type="button" onClick={() => reorder("total")}>
                          {t("الإجمالي")}
                          <ArrowDownUp size={13} />
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sort === "date"
                            ? ascending
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button type="button" onClick={() => reorder("date")}>
                          {t("التاريخ")}
                          <ArrowDownUp size={13} />
                        </button>
                      </th>
                      <th>{t("الإجراءات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible
                      .slice((currentPage - 1) * size, currentPage * size)
                      .map((o) => (
                        <tr key={o.id} data-testid={`order-row-${o.id}`}>
                          <td>
                            <b>{o.customer.name || t("عميل بدون اسم")}</b>
                            <span>
                              <bdi dir="ltr">{o.customer.phone || "—"}</bdi>
                            </span>
                            <span>
                              <bdi>#{o.id.slice(0, 8)}</bdi>
                            </span>
                          </td>
                          <td>
                            <div className="product-table-name">
                              {o.productImageUrl && (
                                <ProductImage
                                  src={o.productImageUrl}
                                  name={o.productName}
                                  size={40}
                                />
                              )}
                              <b>{o.productName}</b>
                            </div>
                            <span>
                              {o.variantName} · {t("الكمية")}:{" "}
                              {o.customer.quantity}
                            </span>
                          </td>
                          <td>
                            {t(
                              o.customer.method === "home"
                                ? "التوصيل إلى المنزل"
                                : "التوصيل إلى المكتب",
                            )}
                          </td>
                          <td>
                            <span className={`ds-status status-${o.status}`}>
                              {t(labels[o.status])}
                            </span>
                          </td>
                          <td>{formatDzd(orderValue(o) / 100)}</td>
                          <td>
                            <time dateTime={o.createdAt}>
                              {new Intl.DateTimeFormat(language, {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: "UTC",
                              }).format(new Date(o.createdAt))}
                            </time>
                            <span>UTC</span>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDetails(o.id)}
                            >
                              {t("تفاصيل الطلب")}
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
              {!visible.length && (
                <div className="data-empty">
                  <h3>{t("لا توجد طلبات مطابقة.")}</h3>
                  <p>
                    {t(
                      "ستظهر الطلبات هنا بعد إرسالها من النموذج. يمكنك تغيير البحث أو التصفية.",
                    )}
                  </p>
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
            </Surface>
          )}
          {selected && (
            <Dialog
              title={t("تفاصيل الطلب")}
              busy={!!busy}
              onClose={() => setDetails(null)}
            >
              <div className="ds-dialog-body">
                {selected.productImageUrl && (
                  <div className="mb-4 flex items-center gap-3">
                    <ProductImage
                      src={selected.productImageUrl}
                      name={selected.productName}
                      size={80}
                    />
                    <span>
                      {selected.productName}
                      <br />
                      {selected.variantName}
                    </span>
                  </div>
                )}
                <p className="data-detail-id">
                  <bdi>{selected.id}</bdi>
                </p>
                <dl className="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      label: "رمز المنتج SKU",
                      value: selected.productSku || "—",
                    },
                    {
                      label: "رمز الخيار SKU",
                      value: selected.variantSku || "—",
                    },
                    {
                      label: "سعر الوحدة",
                      value: formatDzd(
                        (selected.unitPriceMinor ??
                          selected.quote.unitPriceMinor) / 100,
                      ),
                    },
                    {
                      label: "تعليمات الاستلام",
                      value: selected.pickupInstructions || "—",
                    },
                    { label: "الهاتف", value: selected.customer.phone || "—" },
                    {
                      label: "طريقة التوصيل",
                      value: t(
                        selected.customer.method === "home"
                          ? "التوصيل إلى المنزل"
                          : "التوصيل إلى المكتب",
                      ),
                    },
                    {
                      label: "العنوان",
                      value: selected.customer.address || "—",
                    },
                    {
                      label: "المنتجات",
                      value: `${selected.productName} / ${selected.variantName}`,
                    },
                    {
                      label: "الكمية",
                      value: String(selected.customer.quantity),
                    },

                    {
                      label: "الخصم",
                      value: formatDzd(
                        (selected.quote.discountMinor ?? 0) / 100,
                      ),
                    },
                    {
                      label: "الإجمالي النهائي",
                      value: formatDzd(orderValue(selected) / 100),
                    },
                    {
                      label: "مجموع المنتجات",
                      value: formatDzd(selected.quote.subtotalMinor / 100),
                    },
                    {
                      label: "التوصيل",
                      value: formatDzd(
                        (selected.quote.methods[selected.customer.method]
                          .amountMinor ?? 0) / 100,
                      ),
                    },
                  ].map((row) => (
                    <div key={row.label}>
                      <dt className="mb-1 text-slate-500">{t(row.label)}</dt>
                      <dd className="break-words font-medium text-slate-700">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                  <OrderLocation customer={selected.customer} />
                </dl>
                <label className="mt-5 block max-w-xs">
                  {t("تحديث حالة الطلب")}
                  <select
                    className="mt-1.5"
                    aria-label={`${t("الحالة")} ${selected.id}`}
                    disabled={
                      busy === selected.id ||
                      selected.status === "cancelled" ||
                      selected.status === "fulfilled"
                    }
                    value={selected.status}
                    onChange={(e) =>
                      void change(selected.id, e.target.value as OrderStatus)
                    }
                  >
                    {Object.entries(labels).map(([k, v]) => (
                      <option
                        value={k}
                        key={k}
                        disabled={
                          k === "submitted" && selected.status !== "submitted"
                        }
                      >
                        {t(v)}
                      </option>
                    ))}
                  </select>
                </label>
                {error && (
                  <p role="alert" className="data-error">
                    {t(error)}
                  </p>
                )}
              </div>
            </Dialog>
          )}
          {notice && (
            <Toast
              closeLabel={t("إغلاق الإشعار")}
              onClose={() => setNotice("")}
            >
              {t(notice)}
            </Toast>
          )}
        </>
      )}
    </section>
  );
}
function AnalyticsView({ orders }: { orders: StoredOrder[] }) {
  const { t, language } = useLanguage();
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const abort = new AbortController();
    Promise.all(
      ["legacy58", "updated69"].map((mode) =>
        fetch(`/api/geography/wilayas?mode=${mode}`, {
          signal: abort.signal,
        }).then((r) => r.json()),
      ),
    )
      .then((data) => {
        if (!abort.signal.aborted)
          setNames(
            Object.fromEntries(
              data.flatMap((d, index) =>
                (d.items ?? []).map(
                  (w: { code: string; nameAr: string; nameLatin: string }) => [
                    `${index === 0 ? "legacy58" : "updated69"}:${w.code}`,
                    language === "ar" ? w.nameAr : w.nameLatin,
                  ],
                ),
              ),
            ),
          );
      })
      .catch(() => {});
    return () => abort.abort();
  }, [language]);
  const group = (key: (o: StoredOrder) => string) =>
    Object.entries(
      orders.reduce<Record<string, number>>((r, o) => {
        const k = key(o);
        r[k] = (r[k] ?? 0) + 1;
        return r;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  const stats = [
    {
      label: "إجمالي الطلبات",
      value: String(orders.length),
      icon: ShoppingBag,
    },
    {
      label: "مؤكد",
      value: String(orders.filter((o) => o.status === "confirmed").length),
      icon: CheckCircle2,
    },
    {
      label: "تم التسليم",
      value: String(orders.filter((o) => o.status === "fulfilled").length),
      icon: PackageCheck,
    },
    {
      label: "قيمة الطلبات",
      value: formatDzd(
        orders
          .filter((o) => o.status !== "cancelled")
          .reduce((n, o) => n + orderValue(o), 0) / 100,
      ),
      icon: Wallet,
    },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">{t(label)}</p>
              <Icon size={17} className="text-[var(--ds-accent)]" />
            </div>
            <p className="stat-value !text-xl sm:!text-2xl">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        {t("قيمة الطلبات ليست إيرادًا محصلًا أو إثبات دفع.")}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "حسب الولاية",
            rows: group(
              (o) =>
                names[`${o.customer.mode}:${o.customer.wilayaCode}`] ||
                o.customer.wilayaCode,
            ),
          },
          {
            title: "حسب طريقة التوصيل",
            rows: group((o) =>
              t(o.customer.method === "home" ? "المنزل" : "المكتب"),
            ),
          },
          { title: "حسب المنتج", rows: group((o) => o.productName) },
          { title: "حسب الحالة", rows: group((o) => t(labels[o.status])) },
        ].map((g) => (
          <div key={g.title} className="report-card">
            <h3 className="text-xs font-bold">{t(g.title)}</h3>
            {g.rows.length ? (
              <div className="mt-5 space-y-4">
                {g.rows.map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-2 flex justify-between gap-3 text-xs">
                      <span className="truncate text-slate-600">{k}</span>
                      <strong>{v}</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[var(--ds-accent)]"
                        style={{
                          width: `${Math.round((v / Math.max(...g.rows.map((r) => r[1]))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="report-empty">
                <BarPlaceholder />
                <p className="text-xs">{t("بانتظار أول طلب")}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
function BarPlaceholder() {
  return (
    <div aria-hidden="true" className="flex h-9 items-end gap-1.5">
      {[14, 26, 20, 36, 28].map((height) => (
        <span
          key={height}
          className="w-2.5 rounded-sm bg-slate-100"
          style={{ height }}
        />
      ))}
    </div>
  );
}
