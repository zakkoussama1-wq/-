"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  CircleAlert,
  RefreshCw,
  Search,
} from "lucide-react";
import type { StoredOrder, OrderStatus } from "@/modules/orders/repository";
import { useLanguage } from "../language-provider";
import { Button } from "../ui/button";
import { Skeleton, Surface, Toast } from "../ui/surface";
import { orderAmount, overviewData } from "./model";
const statuses: Record<OrderStatus, string> = {
  submitted: "قيد المراجعة",
  confirmed: "مؤكد",
  fulfilled: "تم التسليم",
  cancelled: "ملغى",
};
export function OverviewDashboard({
  onNavigate,
}: {
  onNavigate: (section: string) => void;
}) {
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState(false);
  const [range, setRange] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [ascending, setAscending] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/orders", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.orders)) throw new Error();
        if (controller.signal.aborted) return;
        setOrders(data.orders);
        setNow(new Date());
        setError(false);
        if (revision) setNotice(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const data = overviewData(orders, range, now);
  const number = (value: number) =>
    new Intl.NumberFormat(language).format(value);
  const money = (minor: number) =>
    new Intl.NumberFormat(language, {
      style: "currency",
      currency: "DZD",
      maximumFractionDigits: 2,
    }).format(minor / 100);
  const date = (value: string, short = false) =>
    new Intl.DateTimeFormat(language, {
      month: "short",
      day: "numeric",
      ...(short
        ? {}
        : { hour: "2-digit" as const, minute: "2-digit" as const }),
      timeZone: "UTC",
    }).format(new Date(value));
  const visible = data.selected
    .filter(
      (order) =>
        (!status || order.status === status) &&
        `${order.id} ${order.customer.name} ${order.customer.phone} ${order.productName}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) => (ascending ? 1 : -1) * a.createdAt.localeCompare(b.createdAt),
    );
  const max = Math.max(1, ...data.series.map((item) => item.count));
  function refresh() {
    setLoading(true);
    setNotice(false);
    setRevision((n) => n + 1);
  }
  return (
    <div className="overview" aria-busy={loading}>
      <div className="overview-controls">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="ds-live-dot" />
          {t("بيانات الطلبات المحفوظة")}
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="overview-range">
            {t("الفترة الزمنية")}
          </label>
          <select
            id="overview-range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="all">{t("كل الفترات")}</option>
            <option value="7">{t("آخر 7 أيام")}</option>
            <option value="30">{t("آخر 30 يومًا")}</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {t("تحديث")}
          </Button>
        </div>
      </div>
      {error ? (
        <Surface className="overview-error" role="alert">
          <CircleAlert size={24} />
          <div>
            <h2>{t("تعذر تحميل الطلبات.")}</h2>
            <p>{t("تحقق من الاتصال ثم أعد المحاولة. لم تتغير بياناتك.")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            {t("إعادة المحاولة")}
          </Button>
        </Surface>
      ) : (
        <>
          <div className="overview-metrics">
            {[
              ["إجمالي الطلبات", number(data.selected.length), "جميع الحالات"],
              [
                "قيمة الطلبات",
                money(data.value),
                "باستثناء الملغاة، وليست إيرادات محصّلة",
              ],
              [
                "بانتظار التأكيد",
                number(data.pending),
                "طلبات تحتاج إلى مراجعتك",
              ],
              ["طلبات مسلّمة", number(data.fulfilled), "حسب الحالة المحفوظة"],
            ].map(([label, value, caption]) => (
              <Surface key={label} className="overview-metric">
                <h2>{t(label)}</h2>
                {loading ? (
                  <Skeleton className="h-8 w-28 my-3" />
                ) : (
                  <p
                    className="overview-number"
                    data-testid={`metric-${label}`}
                  >
                    {value}
                  </p>
                )}
                <span>{t(caption)}</span>
              </Surface>
            ))}
          </div>
          <div className="overview-reports">
            <Surface className="overview-chart">
              <div className="ds-panel-heading">
                <div>
                  <h2>{t("نشاط الطلبات")}</h2>
                  <p>
                    {t(range === "30" ? "آخر 30 يومًا" : "آخر 7 أيام")} ·{" "}
                    {t("التوقيت العالمي UTC")}
                  </p>
                </div>
                <span className="overview-chart-legend">
                  <i />
                  {t("عدد الطلبات")}
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-44 w-full mt-6" />
              ) : (
                <>
                  <div className="overview-chart-plot" dir="ltr">
                    <div className="overview-chart-y" aria-hidden="true">
                      <span>{number(max)}</span>
                      <span>{number(0)}</span>
                    </div>
                    <svg
                      viewBox="0 0 700 160"
                      role="img"
                      aria-label={t("عدد الطلبات اليومية")}
                      preserveAspectRatio="none"
                    >
                      <title>{t("عدد الطلبات اليومية")}</title>
                      {[0, 80, 159].map((y) => (
                        <line
                          key={y}
                          x1="0"
                          x2="700"
                          y1={y}
                          y2={y}
                          stroke="var(--ds-border)"
                          strokeDasharray="3 5"
                        />
                      ))}
                      {data.series.map((item, index) => (
                        <rect
                          key={item.date}
                          x={((index + 0.18) * 700) / data.series.length}
                          y={159 - (item.count / max) * 145}
                          width={(700 / data.series.length) * 0.64}
                          height={(item.count / max) * 145}
                          rx="3"
                          fill="var(--ds-accent)"
                        >
                          <title>
                            {date(item.date, true)}: {number(item.count)}
                          </title>
                        </rect>
                      ))}
                    </svg>
                  </div>
                  <div className="overview-chart-dates" dir="ltr">
                    <span>{date(data.series[0].date, true)}</span>
                    <span>{date(data.series.at(-1)!.date, true)}</span>
                  </div>
                  <table className="sr-only">
                    <caption>{t("عدد الطلبات اليومية")}</caption>
                    <thead>
                      <tr>
                        <th>{t("التاريخ")}</th>
                        <th>{t("عدد الطلبات")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.series.map((item) => (
                        <tr key={item.date}>
                          <td>{item.date}</td>
                          <td>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="overview-chart-note">
                    {t(
                      data.series.some((item) => item.count)
                        ? "يشمل المخطط جميع حالات الطلبات خلال الفترة الموضحة."
                        : "لا توجد طلبات خلال هذه الأيام. سيظهر النشاط عند حفظ طلب.",
                    )}
                  </p>
                </>
              )}
            </Surface>
            <Surface className="overview-status">
              <div className="ds-panel-heading">
                <h2>{t("حالات الطلبات")}</h2>
              </div>
              {Object.entries(statuses).map(([key, label]) => {
                const count = data.selected.filter(
                  (order) => order.status === key,
                ).length;
                return (
                  <div className="overview-status-row" key={key}>
                    <div>
                      <span className={`ds-status-dot status-${key}`} />
                      {t(label)}
                      <b>{loading ? "—" : number(count)}</b>
                    </div>
                    <progress
                      aria-label={t(label)}
                      value={loading ? 0 : count}
                      max={Math.max(1, data.selected.length)}
                    />
                  </div>
                );
              })}
              <p className="overview-chart-note">
                {t("الأعداد من طلباتك الفعلية فقط.")}
              </p>
            </Surface>
          </div>
          <Surface className="overview-orders">
            <div className="ds-panel-heading">
              <div>
                <h2>{t("أحدث الطلبات")}</h2>
                <p>{t("آخر 5 نتائج ضمن الفترة المحددة")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("الطلبات")}
              >
                {t("إدارة الطلبات")}
                <ArrowUpRight size={14} />
              </Button>
            </div>
            <div className="overview-table-tools">
              <div className="overview-search">
                <Search size={15} aria-hidden="true" />
                <input
                  aria-label={t("البحث في أحدث الطلبات")}
                  placeholder={t("ابحث بالاسم أو الهاتف أو رقم الطلب")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                aria-label={t("تصفية حسب الحالة")}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{t("كل الحالات")}</option>
                {Object.entries(statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </div>
            {loading ? (
              <div
                className="overview-table-loading"
                role="status"
                aria-label={t("جار تحميل الطلبات")}
              >
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : visible.length ? (
              <section
                className="ds-table-scroll"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the wide table on small screens.
                tabIndex={0}
                aria-label={t("أحدث الطلبات")}
              >
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>{t("العميل")}</th>
                      <th>{t("المنتج")}</th>
                      <th>{t("الحالة")}</th>
                      <th>{t("الإجمالي")}</th>
                      <th aria-sort={ascending ? "ascending" : "descending"}>
                        <button
                          type="button"
                          onClick={() => setAscending(!ascending)}
                        >
                          {t("التاريخ")}
                          <ArrowDownUp size={13} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, 5).map((order) => (
                      <tr key={order.id}>
                        <td>
                          <b>{order.customer.name || "—"}</b>
                          <span>
                            <bdi dir="ltr">{order.customer.phone || "—"}</bdi>
                          </span>
                        </td>
                        <td>
                          <b>{order.productName}</b>
                          <span>{order.variantName}</span>
                        </td>
                        <td>
                          <span className={`ds-status status-${order.status}`}>
                            {t(statuses[order.status])}
                          </span>
                        </td>
                        <td className="tabular-nums">
                          {money(orderAmount(order))}
                        </td>
                        <td>
                          <time dateTime={order.createdAt}>
                            {date(order.createdAt)}
                          </time>
                          <span>UTC</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <div className="overview-empty">
                <h3>
                  {t(
                    orders.length || search || status
                      ? "لا توجد نتائج مطابقة"
                      : "ابدأ بطلبك الأول",
                  )}
                </h3>
                <p>
                  {t(
                    orders.length || search || status
                      ? "غيّر البحث أو الحالة أو الفترة الزمنية."
                      : "افتح نموذج الطلب وأرسل طلبًا تجريبيًا؛ سيظهر هنا بعد حفظه.",
                  )}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("المنتجات")}
                >
                  {t("إدارة المنتجات")}
                </Button>
              </div>
            )}
          </Surface>
        </>
      )}
      {notice && (
        <Toast closeLabel={t("إغلاق الإشعار")} onClose={() => setNotice(false)}>
          {t("تم تحديث بيانات النظرة العامة")}
        </Toast>
      )}
    </div>
  );
}
