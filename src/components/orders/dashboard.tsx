"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useState } from "react";
import type { StoredOrder, OrderStatus } from "@/modules/orders/repository";
import { Button } from "../ui/button";
import { formatDzd } from "@/lib/i18n";
const labels: Record<OrderStatus, string> = {
  submitted: "قيد المراجعة",
  confirmed: "مؤكد",
  fulfilled: "تم التسليم",
  cancelled: "ملغى",
};
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
    void fetch("/api/orders")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setOrders((await r.json()).orders);
        setLoaded(true);
      })
      .catch(() => setError("تعذر تحميل الطلبات."));
  }, []);
  async function change(id: string, next: OrderStatus) {
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
  const group = (key: (o: StoredOrder) => string) =>
    Object.entries(
      orders.reduce<Record<string, number>>((a, o) => {
        const k = key(o);
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, {}),
    );
  return (
    <section className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-bold">
        {t(analytics ? "تحليلات الطلبات المحفوظة" : "إدارة الطلبات المحفوظة")}
      </h2>
      {error && (
        <p role="alert" className="text-red-700">
          {t(error)}
        </p>
      )}
      <Button variant="outline" onClick={() => void load()}>
        {t("تحديث الطلبات")}
      </Button>
      {!loaded && !error && <p role="status">{t("جارٍ تحميل الطلبات…")}</p>}{" "}
      {loaded && analytics ? (
        <>
          <p>
            {t("الطلبات المقدمة:")} {t(orders.length)} {t("· المؤكدة:")}{" "}
            {t(" ")} {t(orders.filter((o) => o.status === "confirmed").length)}{" "}
            {t("· المسلّمة:")} {t(" ")}{" "}
            {t(orders.filter((o) => o.status === "fulfilled").length)}
          </p>
          <p>
            {t("قيمة الطلبات المقدمة:")} {t(" ")}{" "}
            {t(
              formatDzd(
                orders.reduce(
                  (n, o) => n + o.quote.methods[o.customer.method].totalMinor!,
                  0,
                ) / 100,
              ),
            )}
          </p>
          <p className="text-xs text-slate-500">
            {t("قيمة الطلبات ليست إيرادًا محصلًا أو إثبات دفع.")}
          </p>
          {[
            { title: "حسب الولاية", rows: group((o) => o.customer.wilayaCode) },
            {
              title: "حسب طريقة التوصيل",
              rows: group((o) =>
                o.customer.method === "home" ? "المنزل" : "المكتب",
              ),
            },
            { title: "حسب المنتج", rows: group((o) => o.productName) },
            { title: "حسب الحالة", rows: group((o) => labels[o.status]) },
          ].map((g) => (
            <div key={g.title}>
              <h3 className="font-bold">{t(g.title)}</h3>
              {g.rows.map(([k, v]) => (
                <p key={k}>
                  {t(k)}: {t(v)}
                </p>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="order-search">{t("بحث الطلبات")}</label>
              <input
                id="order-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="order-filter">{t("حالة الطلب")}</label>
              <select
                id="order-filter"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">{t("الكل")}</option>
                {Object.entries(labels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="order-date">{t("تاريخ الطلب (UTC)")}</label>
              <input
                id="order-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <Button asChild variant="outline">
            <a href="/api/orders?format=csv">{t("تصدير جميع الطلبات CSV")}</a>
          </Button>
          {loaded && !visible.length && <p>{t("لا توجد طلبات مطابقة.")}</p>}{" "}
          {visible.map((o) => (
            <article
              key={o.id}
              className="space-y-3 rounded-xl border border-slate-200 p-4"
            >
              <p className="break-all font-bold">
                {t(o.customer.name)} · {t(o.id)}
              </p>
              <p>
                {t(
                  formatDzd(
                    o.quote.methods[o.customer.method].totalMinor! / 100,
                  ),
                )}{" "}
                {t(" ")}· {t(labels[o.status])}
              </p>
              <label>
                {t("تحديث حالة الطلب")}
                <select
                  aria-label={`${t("الحالة")} ${o.id}`}
                  value={o.status}
                  onChange={(e) =>
                    void change(o.id, e.target.value as OrderStatus)
                  }
                >
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(v)}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                onClick={() => setDetails(details === o.id ? null : o.id)}
              >
                {t("تفاصيل الطلب")}
              </Button>
              {details === o.id && (
                <div className="space-y-2 text-sm">
                  <p>
                    {t(o.customer.phone)} ·{" "}
                    {t(o.customer.address || "مكتب عام")}
                  </p>
                  <p>
                    {t(o.productName)} · {t(o.variantName)} {t("· الكمية")}{" "}
                    {t(" ")} {t(o.customer.quantity)}
                  </p>
                  <p>
                    {t("الولاية")} {t(o.customer.wilayaCode)} {t("· البلدية")}{" "}
                    {t(" ")} {t(o.customer.communeId)}
                  </p>
                  <p>
                    {t("المنتجات")} {t(formatDzd(o.quote.subtotalMinor / 100))}{" "}
                    {t("· الخصم")} {t(" ")}{" "}
                    {t(formatDzd(o.quote.discountMinor / 100))} {t("· الشحن")}{" "}
                    {t(" ")}{" "}
                    {t(
                      formatDzd(
                        o.quote.methods[o.customer.method].amountMinor! / 100,
                      ),
                    )}
                  </p>
                  <p>{t(o.createdAt)}</p>
                </div>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
