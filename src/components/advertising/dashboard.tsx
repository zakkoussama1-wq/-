"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Play, RotateCcw } from "lucide-react";
import { useLanguage } from "../language-provider";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Surface, Skeleton } from "../ui/surface";
import { TablePagination } from "../ui/table-pagination";
import { notifyCheckoutChanged } from "../checkout/live-updates";
import type {
  EventType,
  SimulationSettings,
  SimulationEvent,
} from "@/modules/advertising/schema";
const labels: Record<EventType, string> = {
  page_view: "زيارة الصفحة",
  product_view: "عرض المنتج",
  checkout_started: "بدء الطلب",
  order_submitted: "طلب COD محفوظ — Lead",
  order_confirmed: "طلب مؤكد",
  order_delivered: "طلب مسلّم",
  purchase: "شراء حسب التعريف التجريبي",
};
type Data = {
  settings: SimulationSettings;
  events: SimulationEvent[];
  mode: "simulation";
};
export function AdvertisingDashboard() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<SimulationSettings | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<SimulationEvent | null>(null);
  const [eventType, setEventType] = useState<EventType>("order_submitted");
  const [fail, setFail] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/advertising");
      if (!r.ok) throw new Error();
      const next = await r.json();
      setData(next);
      setDraft(next.settings);
    } catch {
      setError("تعذر تحميل سجل المحاكاة.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(body: unknown) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/advertising", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      setData(next);
      setDraft(next.settings);
      setMessage("تم تحديث المحاكاة المحلية.");
      notifyCheckoutChanged();
    } catch (e) {
      setError(
        e instanceof Error && /[\u0600-\u06ff]/.test(e.message)
          ? e.message
          : "تعذر تنفيذ اختبار المحاكاة.",
      );
    } finally {
      setBusy(false);
    }
  }
  const events = (data?.events ?? []).filter(
    (e) => !filter || e.platform === filter,
  );
  const effectivePage = Math.min(
    page,
    Math.max(1, Math.ceil(events.length / size)),
  );
  return (
    <section className="data-page simulation-page">
      <Surface className="settings-panel">
        <div className="settings-panel-header">
          <h2 className="settings-heading">
            {t("محاكاة الإعلانات والتحويلات")}
          </h2>
          <span className="ds-status status-confirmed">
            {t("محاكاة محلية فقط")}
          </span>
          <Button variant="outline" disabled={busy} onClick={() => void load()}>
            <RefreshCw size={14} />
            {t("تحديث السجل")}
          </Button>
        </div>
        <p className="data-muted">
          {t(
            "لا توجد اتصالات بمنصات الإعلانات أو مفاتيح مطلوبة. الحمولات والسجلات هنا تجريبية وليست تأكيد تسليم من المزوّد.",
          )}
        </p>
        {error && (
          <p role="alert" className="data-error">
            {t(error)}
          </p>
        )}
        {!data && !error && (
          <div role="status" aria-label={t("جارٍ تحميل سجل المحاكاة…")}>
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {draft && (
          <>
            <label className="simulation-check">
              <input
                type="checkbox"
                checked={draft.enabled}
                disabled={busy}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              {t("تفعيل المحاكاة المحلية")}
            </label>
            <label className="simulation-check">
              <input
                type="checkbox"
                checked={draft.purchaseOnFulfilled}
                disabled={busy}
                onChange={(e) =>
                  setDraft({ ...draft, purchaseOnFulfilled: e.target.checked })
                }
              />
              {t("محاكاة Purchase عند نقل الطلب إلى تم التسليم")}
            </label>
            <p className="data-muted">
              {t(
                "الافتراضي: حفظ COD يولد Lead، والتأكيد والتسليم حدثان منفصلان. تفعيل Purchase هنا تعريف تجريبي للتسليم، وليس إثبات تحصيل أموال.",
              )}
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                void action({ action: "settings", settings: draft })
              }
            >
              {t("حفظ إعدادات المحاكاة")}
            </Button>
          </>
        )}
        {message && <p role="status">{t(message)}</p>}
      </Surface>
      {data && (
        <>
          <Surface className="settings-panel">
            <h2 className="settings-heading">
              {t("اختبار الحمولة ومنع التكرار")}
            </h2>
            <p className="data-muted">
              {t(
                "هذا الاختبار لا ينشئ طلبًا. قناتا Meta وTikTok تشتركان في event_id واحد، وتحسب المحاكاة حدثًا واحدًا لكل منصة.",
              )}
            </p>
            <div className="settings-actions">
              <label>
                {t("نوع الحدث")}
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                >
                  {Object.entries(labels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="simulation-check">
                <input
                  type="checkbox"
                  checked={fail}
                  onChange={(e) => setFail(e.target.checked)}
                />
                {t("محاكاة فشل المحاولة الأولى")}
              </label>
              <Button
                disabled={busy || !data.settings.enabled}
                onClick={() =>
                  void action({
                    action: "simulate",
                    runId: crypto.randomUUID(),
                    eventType,
                    fail,
                  })
                }
              >
                <Play size={14} />
                {t("إنشاء حدث تجريبي")}
              </Button>
            </div>
          </Surface>
          <Surface>
            <div className="settings-panel-header p-4">
              <h2 className="settings-heading">{t("سجل الأحداث التجريبية")}</h2>
              <label>
                {t("المنصة")}
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("الكل")}</option>
                  <option value="meta">Meta</option>
                  <option value="tiktok">TikTok</option>
                  <option value="google">Google Ads</option>
                </select>
              </label>
            </div>
            <p className="data-muted px-4 pb-4">
              {t(
                "يعرض السجل آخر 200 صف. لا يحتوي على أسماء العملاء أو أرقامهم أو عناوينهم؛ تظهر أسماء معرّفات النقر فقط دون قيمها.",
              )}
            </p>
            <section
              className="ds-table-scroll"
              aria-label={t("سجل الأحداث التجريبية")}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll this data table.
              tabIndex={0}
            >
              <table className="ds-table data-table">
                <thead>
                  <tr>
                    {[
                      "الحدث",
                      "المنصة",
                      "القناة",
                      "الحالة",
                      "المحاولات",
                      "رقم الطلب",
                      "الوقت",
                      "الإجراءات",
                    ].map((key) => (
                      <th key={key}>{t(key)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events
                    .slice((effectivePage - 1) * size, effectivePage * size)
                    .map((event) => (
                      <tr
                        data-event-id={event.eventId}
                        key={`${event.eventId}:${event.platform}:${event.channel}`}
                      >
                        <td>{t(labels[event.eventType])}</td>
                        <td>
                          {event.platform === "google"
                            ? "Google Ads"
                            : event.platform === "meta"
                              ? "Meta"
                              : "TikTok"}
                        </td>
                        <td>
                          {t(
                            event.channel === "browser" ? "المتصفح" : "الخادم",
                          )}
                        </td>
                        <td>
                          <span
                            className={`ds-status ${event.status === "failed" ? "status-submitted" : event.status === "deduplicated" ? "status-cancelled" : "status-fulfilled"}`}
                          >
                            {t(
                              event.status === "failed"
                                ? "فشل تجريبي"
                                : event.status === "deduplicated"
                                  ? "مكرر — لم يُحسب ثانية"
                                  : "تمت المحاكاة",
                            )}
                          </span>
                        </td>
                        <td>{event.attempts}</td>
                        <td>
                          <bdi>{event.orderId?.slice(0, 8) ?? "—"}</bdi>
                        </td>
                        <td>
                          {new Date(event.createdAt).toLocaleString(
                            { ar: "ar-DZ", fr: "fr-DZ", en: "en-DZ" }[language],
                          )}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelected(event)}
                          >
                            {t("عرض الحمولة")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !data.settings.enabled}
                            onClick={() =>
                              void action({
                                action: "retry",
                                eventId: event.eventId,
                              })
                            }
                          >
                            <RotateCcw size={13} />
                            {t("إعادة محاولة نفس الحدث")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
            {!events.length && (
              <p className="data-empty">
                {t(
                  "لا توجد أحداث محاكاة بعد. فعّلها واختبر حدثًا أو أرسل طلبًا بعد الموافقة.",
                )}
              </p>
            )}
            <TablePagination
              page={effectivePage}
              size={size}
              total={events.length}
              onPage={setPage}
              onSize={(n) => {
                setSize(n);
                setPage(1);
              }}
            />
          </Surface>
        </>
      )}
      {selected && (
        <Dialog
          title={t("حمولة محاكاة — لم تُرسل خارجيًا")}
          onClose={() => setSelected(null)}
        >
          <div className="ds-dialog-body">
            <p className="data-muted">
              {t("هذه معاينة محلية. providerConfirmed=false دائمًا.")}
            </p>
            <pre className="simulation-payload" dir="ltr">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
          </div>
        </Dialog>
      )}
    </section>
  );
}
