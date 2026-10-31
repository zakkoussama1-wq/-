"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import type { StoredOrder, OrderStatus } from "@/modules/orders/repository";
import { Button } from "../ui/button";
import { formatDzd } from "@/lib/i18n";
const labels: Record<OrderStatus, string> = {
  submitted: "قيد المراجعة",
  confirmed: "مؤكد",
  fulfilled: "تم التسليم",
  cancelled: "ملغى",
};
const statusClass: Record<OrderStatus, string> = {
  submitted: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  fulfilled: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const orderValue = (o: StoredOrder) =>
  o.quote.methods[o.customer.method].totalMinor ?? 0;
export function OrdersDashboard({
  analytics = false,
}: {
  analytics?: boolean;
}) {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [details, setDetails] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
    setBusy(id);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id, status: next }),
      });
      if (!r.ok) throw new Error();
      await load();
    } catch {
      setError("تعذر حفظ حالة الطلب.");
    } finally {
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
  return (
    <section className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">
          {t(analytics ? "تحليلات الطلبات المحفوظة" : "إدارة الطلبات المحفوظة")}
        </h2>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw size={13} />
          {t("تحديث الطلبات")}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
        >
          {t(error)}
        </p>
      )}
      {!loaded && !error && (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"
        >
          {t("جارٍ تحميل الطلبات…")}
        </p>
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
                    onChange={(e) => setSearch(e.target.value)}
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
                  onChange={(e) => setStatus(e.target.value)}
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
                  onChange={(e) => setDate(e.target.value)}
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
          {loaded && !visible.length && (
            <div className="report-card report-empty !min-h-[220px]">
              <ClipboardList size={30} strokeWidth={1.3} />
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {t("لا توجد طلبات مطابقة.")}
              </p>
              <p className="max-w-sm text-xs leading-6">
                {t(
                  "ستظهر الطلبات هنا بعد إرسالها من النموذج. يمكنك تغيير البحث أو التصفية.",
                )}
              </p>
            </div>
          )}
          <div className="space-y-3">
            {visible.map((o) => (
              <article
                key={o.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
                      {(o.customer.name || "?").slice(0, 1)}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold">
                        {o.customer.name || t("عميل بدون اسم")}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-400">
                        <span dir="ltr">#{o.id.slice(0, 8)}</span>
                        <span className="mx-2">·</span>
                        {o.createdAt.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong className="text-sm">
                      {formatDzd(orderValue(o) / 100)}
                    </strong>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass[o.status]}`}
                    >
                      {t(labels[o.status])}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetails(details === o.id ? null : o.id)}
                    >
                      {t("تفاصيل الطلب")}
                    </Button>
                  </div>
                </div>
                {details === o.id && (
                  <div className="border-t border-slate-100 bg-[#fafbfc] p-4">
                    <dl className="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        { label: "الهاتف", value: o.customer.phone || "—" },
                        {
                          label: "طريقة التوصيل",
                          value: t(
                            o.customer.method === "home"
                              ? "التوصيل إلى المنزل"
                              : "التوصيل إلى المكتب",
                          ),
                        },
                        { label: "العنوان", value: o.customer.address || "—" },
                        {
                          label: "المنتجات",
                          value: `${o.productName} / ${o.variantName}`,
                        },
                        { label: "الكمية", value: String(o.customer.quantity) },
                        { label: "الولاية", value: o.customer.wilayaCode },
                        { label: "البلدية", value: o.customer.communeId },
                        {
                          label: "مجموع المنتجات",
                          value: formatDzd(o.quote.subtotalMinor / 100),
                        },
                        {
                          label: "التوصيل",
                          value: formatDzd(
                            (o.quote.methods[o.customer.method].amountMinor ??
                              0) / 100,
                          ),
                        },
                      ].map((row) => (
                        <div key={row.label}>
                          <dt className="mb-1 text-slate-400">
                            {t(row.label)}
                          </dt>
                          <dd className="break-words font-medium text-slate-700">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <label className="mt-5 block max-w-xs">
                      {t("تحديث حالة الطلب")}
                      <select
                        className="mt-1.5"
                        aria-label={`${t("الحالة")} ${o.id}`}
                        disabled={
                          busy === o.id ||
                          o.status === "cancelled" ||
                          o.status === "fulfilled"
                        }
                        value={o.status}
                        onChange={(e) =>
                          void change(o.id, e.target.value as OrderStatus)
                        }
                      >
                        {Object.entries(labels).map(([k, v]) => (
                          <option
                            value={k}
                            key={k}
                            disabled={
                              k === "submitted" && o.status !== "submitted"
                            }
                          >
                            {t(v)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </article>
            ))}
          </div>
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
              data.flatMap((d) =>
                (d.items ?? []).map(
                  (w: { code: string; nameAr: string; nameLatin: string }) => [
                    w.code,
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
              <Icon size={17} className="text-emerald-700" />
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
              (o) => names[o.customer.wilayaCode] || o.customer.wilayaCode,
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
                        className="h-full rounded-full bg-[#008060]"
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
