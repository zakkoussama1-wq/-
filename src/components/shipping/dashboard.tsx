"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  Download,
  MapPin,
  Pencil,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Skeleton, Surface, Toast } from "../ui/surface";
import { RuleEditor } from "./rule-editor";
import { QuoteTester } from "./quote-tester";
import {
  emptyRule,
  ruleSchema,
  shippingStateSchema,
  type ShippingState,
  type ShippingRule,
  type RuleTarget,
  type RuleEntry,
} from "@/modules/shipping/schema";
import {
  administrativeModeSchema,
  geographyResponseSchema,
  type LocationOption,
} from "@/modules/geography/schema";
import type { AdministrativeMode } from "@/modules/contracts";
import { normalizeSearch } from "@/modules/geography/normalize.mjs";
import { calculateShipping } from "@/modules/shipping/calculator";
import { sameRule, wilayaRule } from "./table-model";

export function ShippingDashboard({ onSaved }: { onSaved?: () => void } = {}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AdministrativeMode>("legacy58");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <section className="shipping-page">
      <div className="shipping-mode-bar">
        <div>
          <h2>{t("إدارة أسعار الشحن")}</h2>
          <p>{t("أسعار مستقلة لكل نظام. استثناءات البلديات لها الأولوية.")}</p>
        </div>
        <div>
          <label htmlFor="shipping-mode">{t("نظام مناطق الشحن")}</label>
          <select
            id="shipping-mode"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              if (
                !pending ||
                window.confirm(
                  t("ستفقد تعديلات الجدول غير المحفوظة. هل تريد المتابعة؟"),
                )
              )
                setMode(administrativeModeSchema.parse(e.target.value));
            }}
          >
            <option value="legacy58">{t("٥٨ ولاية")}</option>
            <option value="updated69">
              {t("٦٩ ولاية · مراجعة رسمية معلّقة")}
            </option>
          </select>
        </div>
      </div>
      {mode === "updated69" && (
        <p className="shipping-caution">
          {t(
            "خريطة ٦٩ ولاية مبنية على مرجع ثانوي، والمطابقة الرسمية المباشرة معلّقة. أسعار هذا النظام مستقلة عن نظام ٥٨ ولا تُنقل تلقائيًا.",
          )}
        </p>
      )}
      <ShippingManager
        key={mode}
        mode={mode}
        onSaved={onSaved}
        onBusyChange={setBusy}
        onPendingChange={setPending}
      />
    </section>
  );
}
function ShippingManager({
  mode,
  onSaved,
  onBusyChange,
  onPendingChange,
}: {
  mode: AdministrativeMode;
  onSaved?: () => void;
  onBusyChange: (value: boolean) => void;
  onPendingChange: (value: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const [state, setState] = useState<ShippingState | null>(null);
  const [wilayas, setWilayas] = useState<LocationOption[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<"code" | "name">("code");
  const [ascending, setAscending] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Record<string, ShippingRule>>({});
  const pendingCount = Object.keys(pending).length;
  const [editor, setEditor] = useState<"rule" | "bulk" | null>(null);
  const [target, setTarget] = useState<RuleTarget>({
    scope: "default",
    target: "*",
  });
  const [draft, setDraft] = useState<ShippingRule>(emptyRule);
  const [editorError, setEditorError] = useState("");
  const [communeWilaya, setCommuneWilaya] = useState("");
  const [communes, setCommunes] = useState<LocationOption[]>([]);
  const [communesLoading, setCommunesLoading] = useState(false);
  const communeRequest = useRef<AbortController | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState("");
  function message(value: string) {
    const row =
      /^صف CSV رقم (\d+) (غير صالح أو مكرر\. تحقق من المعرف والأسعار وحالات التفعيل\.)$/.exec(
        value,
      );
    if (row) return `${t("صف CSV رقم")} ${row[1]} ${t(row[2])}`;
    return value
      .split(" · ")
      .map((part) => t(part))
      .join(" · ");
  }
  const name = (item: LocationOption) =>
    language === "ar" ? item.nameAr : item.nameLatin;
  useEffect(() => {
    onPendingChange(pendingCount > 0);
  }, [pendingCount, onPendingChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (!pendingCount) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingCount]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry explicitly reloads the current remote revision.
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      fetch(`/api/shipping?mode=${mode}`, { signal: abort.signal }),
      fetch(`/api/geography/wilayas?mode=${mode}`, { signal: abort.signal }),
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw new Error();
        const s = shippingStateSchema.parse(await a.json());
        const g = geographyResponseSchema.parse(await b.json());
        if (!abort.signal.aborted) {
          setState(s);
          setWilayas(g.items);
          setPending({});
          setSelected([]);
          setPage(1);
          setError("");
        }
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError("تعذر تحميل أسعار الشحن. أعد المحاولة.");
      });
    return () => {
      abort.abort();
      communeRequest.current?.abort();
    };
  }, [mode, retry]);
  async function mutate(change: object): Promise<boolean> {
    if (!state || inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, revision: state.revision, ...change }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ أسعار الشحن.");
      setState(shippingStateSchema.parse(data));
      setNotice("تم حفظ إعدادات الشحن.");
      onSaved?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ أسعار الشحن.");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function edit(next: RuleTarget, kind: "rule" | "bulk" = "rule") {
    setError("");
    setTarget(next);
    setDraft(
      state?.entries.find(
        (e) => e.scope === next.scope && e.target === next.target,
      )?.rule ??
        (next.scope === "wilaya" && state
          ? wilayaRule(state, next.target)
          : emptyRule),
    );
    setEditorError("");
    setEditor(kind);
  }
  async function chooseCommuneWilaya(code: string): Promise<boolean> {
    communeRequest.current?.abort();
    const controller = new AbortController();
    communeRequest.current = controller;
    setCommuneWilaya(code);
    setCommunes([]);
    setTarget({ scope: "commune", target: "" });
    setDraft(emptyRule);
    setEditorError("");
    if (!code) {
      setCommunesLoading(false);
      return false;
    }
    setCommunesLoading(true);
    try {
      const response = await fetch(
        `/api/geography/communes?mode=${mode}&wilayaCode=${code}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error();
      const data = geographyResponseSchema.parse(await response.json());
      if (controller.signal.aborted) return false;
      setCommunes(data.items);
      return true;
    } catch {
      if (!controller.signal.aborted)
        setEditorError("تعذر تحميل بلديات التجاوز.");
      return false;
    } finally {
      if (!controller.signal.aborted) setCommunesLoading(false);
    }
  }
  function closeEditor() {
    if (!busy) {
      communeRequest.current?.abort();
      setCommunesLoading(false);
      setEditor(null);
    }
  }
  async function saveEditor() {
    setEditorError("");
    const parsed = ruleSchema.safeParse(draft);
    if (!parsed.success) {
      setEditorError(
        parsed.error.issues.map((issue) => issue.message).join(" · "),
      );
      return;
    }
    const targets: RuleTarget[] =
      editor === "bulk"
        ? selected.map((code) => ({ scope: "wilaya", target: code }))
        : [target];
    if (!targets.length || targets.some((item) => !item.target)) {
      setEditorError("اختر منطقة واحدة على الأقل.");
      return;
    }
    if (
      await mutate({
        action: "save",
        entries: targets.map((item) => ({ ...item, rule: parsed.data })),
      })
    )
      closeEditor();
  }
  async function reset(targets: RuleTarget[]) {
    if (
      targets.length &&
      window.confirm(
        t("هل تريد حذف القواعد المحددة والرجوع إلى السعر الأقل أولوية إن وجد؟"),
      ) &&
      (await mutate({ action: "reset", targets }))
    )
      closeEditor();
  }
  function changeRow(code: string, next: ShippingRule) {
    if (!state) return;
    setPending((previous) => {
      const updated = { ...previous };
      if (sameRule(next, wilayaRule(state, code))) delete updated[code];
      else updated[code] = next;
      return updated;
    });
  }
  async function saveTable() {
    const entries: RuleEntry[] = [];
    for (const [code, rule] of Object.entries(pending)) {
      const parsed = ruleSchema.safeParse(rule);
      if (!parsed.success) {
        setError(
          `${code} · ${parsed.error.issues.map((issue) => issue.message).join(" · ")}`,
        );
        return;
      }
      entries.push({ scope: "wilaya", target: code, rule: parsed.data });
    }
    if (entries.length && (await mutate({ action: "save", entries })))
      setPending({});
  }
  function reload() {
    if (
      pendingCount &&
      !window.confirm(t("ستفقد تعديلات الجدول غير المحفوظة. هل تريد المتابعة؟"))
    )
      return;
    setError("");
    setState(null);
    setRetry((n) => n + 1);
  }
  if (!state)
    return (
      <Surface className="shipping-loading" aria-busy={!error}>
        {error ? (
          <>
            <p role="alert">{message(error)}</p>
            <Button size="sm" onClick={reload}>
              {t("إعادة تحميل الشحن")}
            </Button>
          </>
        ) : (
          <>
            <p role="status">{t("جارٍ تحميل أسعار الشحن…")}</p>
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-10 w-full mt-3" />
            ))}
          </>
        )}
      </Surface>
    );
  const visible = wilayas
    .filter((w) =>
      normalizeSearch(`${w.code} ${w.nameAr} ${w.nameLatin}`).includes(
        normalizeSearch(search),
      ),
    )
    .filter(
      (w) =>
        filter === "all" ||
        (filter === "configured"
          ? state.entries.some(
              (e) => e.scope === "wilaya" && e.target === w.code,
            )
          : filter === "available"
            ? calculateShipping(state, w.code!, "", "home").available
            : filter === "office"
              ? calculateShipping(state, w.code!, "", "office").available
              : !calculateShipping(state, w.code!, "", "home").available),
    )
    .sort(
      (a, b) =>
        (ascending ? 1 : -1) *
        (sort === "code"
          ? Number(a.code) - Number(b.code)
          : name(a).localeCompare(name(b), language)),
    );
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = visible.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const allPageSelected =
    paged.length > 0 && paged.every((w) => selected.includes(w.code!));
  const bulkTargets: RuleTarget[] = selected.map((code) => ({
    scope: "wilaya",
    target: code,
  }));
  const summary = [
    ["الولايات", wilayas.length],
    [
      "المنزل متاح",
      wilayas.filter(
        (w) => calculateShipping(state, w.code!, "", "home").available,
      ).length,
    ],
    [
      "المكتب متاح",
      wilayas.filter(
        (w) => calculateShipping(state, w.code!, "", "office").available,
      ).length,
    ],
    [
      "تجاوزات البلديات",
      state.entries.filter((e) => e.scope === "commune").length,
    ],
  ] as const;
  const locked = busy || pendingCount > 0;
  function togglePage(checked: boolean) {
    setSelected((previous) =>
      checked
        ? [...new Set([...previous, ...paged.map((w) => w.code!)])]
        : previous.filter((code) => !paged.some((w) => w.code === code)),
    );
  }
  function changeSort(column: "name" | "code") {
    if (sort === column) setAscending(!ascending);
    else {
      setSort(column);
      setAscending(true);
    }
    setPage(1);
  }
  return (
    <div aria-busy={busy}>
      <div className="shipping-summary">
        {summary.map(([label, count]) => (
          <div key={label}>
            <span>{t(label)}</span>
            <b>{new Intl.NumberFormat(language).format(count)}</b>
          </div>
        ))}
      </div>
      {error && !editor && !csvOpen && (
        <div role="alert" className="shipping-error">
          <p>{message(error)}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={reload}>
            {t("إعادة تحميل الشحن")}
          </Button>
        </div>
      )}
      <Surface className="shipping-settings">
        <div>
          <h3>{t("التوصيل إلى المكتب")}</h3>
          <p>
            {t(
              "يسمح المكتب العام باختيار التوصيل إلى المكتب دون قائمة مكاتب ناقل.",
            )}
          </p>
        </div>
        <label>
          <input
            type="checkbox"
            className="!w-4"
            checked={state.genericOffice}
            disabled={locked}
            onChange={(e) =>
              void mutate({
                action: "settings",
                genericOffice: e.target.checked,
              })
            }
          />
          {t("السماح بتوصيل المكتب العام دون قائمة مكاتب")}
        </label>
      </Surface>
      <Surface className="shipping-table-panel">
        <div className="shipping-panel-heading">
          <div>
            <h3>{t("أسعار الولايات الفعلية")}</h3>
            <p>
              {t(
                "عدّل السعر أو الحالة، ثم احفظ التعديلات. لا تتغير استثناءات البلديات.",
              )}
            </p>
          </div>
          <div className="shipping-actions">
            <Button
              variant="outline"
              size="sm"
              disabled={locked}
              onClick={() => {
                setCsvFile(null);
                setCsvError("");
                setCsvOpen(true);
              }}
            >
              <Upload size={14} />
              {t("استيراد CSV")}
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/shipping/csv?mode=${mode}`}>
                <Download size={14} />
                {t("تصدير أسعار CSV")}
              </a>
            </Button>
          </div>
        </div>
        <div className="shipping-table-tools">
          <div className="shipping-search">
            <Search size={15} />
            <label htmlFor="shipping-search" className="sr-only">
              {t("بحث الولايات")}
            </label>
            <input
              id="shipping-search"
              type="search"
              placeholder={t("اسم الولاية أو رمزها")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <label className="sr-only" htmlFor="shipping-filter">
            {t("تصفية الأسعار")}
          </label>
          <select
            id="shipping-filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("كل الولايات")}</option>
            <option value="configured">{t("قواعد ولاية مضبوطة")}</option>
            <option value="available">{t("المنزل متاح")}</option>
            <option value="office">{t("المكتب متاح")}</option>
            <option value="unavailable">{t("المنزل غير متاح")}</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={locked}
            onClick={() => edit({ scope: "default", target: "*" })}
          >
            {t("إعداد السعر الافتراضي")}
          </Button>
        </div>
        {pendingCount > 0 && (
          <div className="shipping-pending" role="status">
            <span>
              {t("تعديلات غير محفوظة")} <b>({pendingCount})</b>
            </span>
            <div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void saveTable()}
              >
                {t("حفظ التعديلات")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setPending({})}
              >
                {t("إلغاء التعديلات")}
              </Button>
            </div>
          </div>
        )}
        <div className="shipping-selection">
          <span>
            {t("المحدد:")} <b>{selected.length}</b>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !visible.length}
            onClick={() =>
              setSelected((previous) => [
                ...new Set([...previous, ...visible.map((w) => w.code!)]),
              ])
            }
          >
            {t("تحديد كل نتائج البحث")}
          </Button>
          {selected.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setSelected([])}
              >
                {t("إلغاء التحديد")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={locked}
                onClick={() => {
                  edit({ scope: "wilaya", target: selected[0] }, "bulk");
                }}
              >
                {t("تعديل جماعي")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={locked}
                onClick={() =>
                  void mutate({
                    action: "save",
                    entries: selected.map(
                      (code) =>
                        ({
                          scope: "wilaya",
                          target: code,
                          rule: {
                            ...wilayaRule(state, code),
                            available: true,
                            home: { enabled: true, price: 0 },
                          },
                        }) satisfies RuleEntry,
                    ),
                  })
                }
              >
                {t("منزل مجاني للمحدد")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={locked}
                onClick={() => void reset(bulkTargets)}
              >
                {t("إعادة ضبط المحدد")}
              </Button>
            </>
          )}
        </div>
        <p className="shipping-scroll-hint">
          {t("مرّر الجدول أفقيًا لعرض جميع الأعمدة.")}
        </p>
        <section
          className="ds-table-scroll"
          aria-label={t("جدول أسعار الشحن")}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Enables keyboard scrolling of the editable table on narrow screens.
          tabIndex={0}
        >
          <table className="ds-table shipping-table">
            <caption className="sr-only">
              {t("أسعار الشحن بالدينار للمنزل والمكتب")}
            </caption>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label={t("تحديد الولايات الظاهرة")}
                    checked={allPageSelected}
                    ref={(node) => {
                      if (node)
                        node.indeterminate =
                          !allPageSelected &&
                          paged.some((w) => selected.includes(w.code!));
                    }}
                    disabled={busy || !paged.length}
                    onChange={(e) => togglePage(e.target.checked)}
                  />
                </th>
                <th
                  aria-sort={
                    sort === "code"
                      ? ascending
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button type="button" onClick={() => changeSort("code")}>
                    {t("الرمز")}
                    <ArrowDownUp size={12} />
                  </button>
                </th>
                <th
                  aria-sort={
                    sort === "name"
                      ? ascending
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button type="button" onClick={() => changeSort("name")}>
                    {t("الولاية")}
                    <ArrowDownUp size={12} />
                  </button>
                </th>
                <th>{t("سعر المنزل بالدينار")}</th>
                <th>{t("سعر المكتب بالدينار")}</th>
                <th>{t("حالة المنزل")}</th>
                <th>{t("حالة المكتب")}</th>
                <th>{t("الإجراءات")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((w) => {
                const rule = pending[w.code!] ?? wilayaRule(state, w.code!);
                const custom = state.entries.some(
                  (e) => e.scope === "wilaya" && e.target === w.code,
                );
                return (
                  <tr
                    key={w.id}
                    data-testid={`shipping-row-${w.code}`}
                    className={pending[w.code!] ? "shipping-row-pending" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${t("تحديد")} ${name(w)}`}
                        checked={selected.includes(w.code!)}
                        disabled={busy}
                        onChange={(e) =>
                          setSelected((previous) =>
                            e.target.checked
                              ? [...new Set([...previous, w.code!])]
                              : previous.filter((code) => code !== w.code),
                          )
                        }
                      />
                    </td>
                    <td>
                      <bdi>{w.code}</bdi>
                    </td>
                    <td>
                      <b>{name(w)}</b>
                      <span>
                        {t(custom ? "قاعدة ولاية خاصة" : "السعر الافتراضي")}
                      </span>
                    </td>
                    {(["home", "office"] as const).map((method) => (
                      <td key={method}>
                        <input
                          type="number"
                          min="0"
                          max="10000000"
                          step="0.01"
                          inputMode="decimal"
                          aria-label={`${t(method === "home" ? "سعر المنزل بالدينار" : "سعر المكتب بالدينار")} · ${name(w)}`}
                          value={rule[method].price ?? ""}
                          placeholder="—"
                          disabled={busy}
                          onChange={(e) =>
                            changeRow(w.code!, {
                              ...rule,
                              [method]: {
                                ...rule[method],
                                price:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              },
                            })
                          }
                        />
                      </td>
                    ))}
                    {(["home", "office"] as const).map((method) => {
                      const available =
                        rule.available &&
                        rule[method].enabled &&
                        rule[method].price !== null &&
                        (method === "home" || state.genericOffice);
                      return (
                        <td key={method}>
                          <label
                            className={`shipping-method ${available ? "is-available" : ""}`}
                            title={t(
                              !rule.available
                                ? "المنطقة غير متاحة؛ عدّل القاعدة لتفعيلها."
                                : method === "office" && !state.genericOffice
                                  ? "فعّل المكتب العام من إعدادات الشحن."
                                  : "التغييرات تحتاج إلى حفظ",
                            )}
                          >
                            <input
                              role="switch"
                              aria-checked={rule[method].enabled}
                              type="checkbox"
                              checked={rule[method].enabled}
                              disabled={busy || !rule.available}
                              aria-label={`${t(method === "home" ? "تفعيل المنزل" : "تفعيل المكتب")} · ${name(w)}`}
                              onChange={(e) =>
                                changeRow(w.code!, {
                                  ...rule,
                                  [method]: {
                                    ...rule[method],
                                    enabled: e.target.checked,
                                  },
                                })
                              }
                            />
                            <span>{t(available ? "متاح" : "غير متاح")}</span>
                          </label>
                        </td>
                      );
                    })}
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={locked}
                        onClick={() =>
                          edit({ scope: "wilaya", target: w.code! })
                        }
                        aria-label={`${t("تعديل")} ${name(w)}`}
                      >
                        <Pencil size={13} />
                        {t("تعديل")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        {!visible.length && (
          <div className="shipping-empty" role="status">
            <h4>{t("لا توجد ولايات تطابق البحث والتصفية.")}</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilter("all");
                setPage(1);
              }}
            >
              {t("مسح التصفية")}
            </Button>
          </div>
        )}
        <footer className="shipping-pagination">
          <span>
            {t("النتائج:")}{" "}
            <bdi dir="ltr">
              {visible.length ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, visible.length)} /{" "}
              {visible.length}
            </bdi>
          </span>
          <div>
            <label htmlFor="shipping-page-size">{t("صفوف لكل صفحة")}</label>
            <select
              id="shipping-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              <option value={100}>{t("الكل")}</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              {t("السابق")}
            </Button>
            <bdi dir="ltr">
              {currentPage} / {pageCount}
            </bdi>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              {t("التالي")}
            </Button>
          </div>
        </footer>
      </Surface>
      <Surface className="shipping-overrides">
        <div className="shipping-panel-heading">
          <div>
            <h3>{t("تجاوزات البلديات المحفوظة")}</h3>
            <p>
              {t(
                "تسبق أسعار الولاية والافتراضي، ولا تتغير بتعديل جدول الولايات.",
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={locked}
            onClick={() => {
              setCommuneWilaya("");
              setCommunes([]);
              edit({ scope: "commune", target: "" });
            }}
          >
            <MapPin size={14} />
            {t("إضافة تجاوز بلدية")}
          </Button>
        </div>
        {state.entries.some((e) => e.scope === "commune") ? (
          <div className="shipping-override-list">
            {state.entries
              .filter((e) => e.scope === "commune")
              .map((entry) => (
                <Button
                  key={entry.target}
                  variant="outline"
                  size="sm"
                  disabled={locked}
                  onClick={async () => {
                    edit({ scope: "commune", target: "" });
                    if (
                      await chooseCommuneWilaya(
                        state.communeParents?.[entry.target] ?? "",
                      )
                    ) {
                      setTarget(entry);
                      setDraft(entry.rule);
                    }
                  }}
                >
                  {t("تعديل")}{" "}
                  {state.communeNames?.[entry.target] ?? entry.target}
                </Button>
              ))}
          </div>
        ) : (
          <p className="shipping-muted">
            {t("لا توجد تجاوزات بلديات محفوظة.")}
          </p>
        )}
      </Surface>
      <Surface className="shipping-tester">
        <details>
          <summary>{t("اختبار السعر الفعلي من الخادم")}</summary>
          <QuoteTester key={state.revision} mode={mode} wilayas={wilayas} />
        </details>
      </Surface>
      {editor && (
        <Dialog
          title={t(
            editor === "bulk" ? "تعديل الولايات المحددة" : "تعديل قاعدة الشحن",
          )}
          onClose={closeEditor}
          busy={busy}
        >
          <div className="ds-dialog-body">
            <fieldset disabled={busy} className="shipping-editor">
              <div className="shipping-caution">
                {t(
                  editor === "bulk"
                    ? "سيُطبّق كامل هذه القاعدة على الولايات المحددة فقط. تبقى تجاوزات البلديات كما هي."
                    : "السعر صفر يعني توصيلًا مجانيًا. الحفظ يطبّق القاعدة في النظام المختار فقط.",
                )}
                {editor === "bulk" && <b> ({selected.length})</b>}
              </div>
              {editor === "rule" && (
                <>
                  <div>
                    <label htmlFor="rule-scope">{t("نطاق القاعدة")}</label>
                    <select
                      id="rule-scope"
                      value={target.scope}
                      onChange={(e) =>
                        edit({
                          scope: e.target.value as RuleTarget["scope"],
                          target: e.target.value === "default" ? "*" : "",
                        })
                      }
                    >
                      <option value="default">{t("السعر الافتراضي")}</option>
                      <option value="wilaya">{t("ولاية")}</option>
                      <option value="commune">{t("تجاوز بلدية")}</option>
                    </select>
                  </div>
                  {target.scope === "wilaya" && (
                    <div>
                      <label htmlFor="rule-wilaya">{t("ولاية القاعدة")}</label>
                      <select
                        id="rule-wilaya"
                        value={target.target}
                        onChange={(e) =>
                          edit({ scope: "wilaya", target: e.target.value })
                        }
                      >
                        <option value="">{t("اختر الولاية")}</option>
                        {wilayas.map((w) => (
                          <option key={w.id} value={w.code}>
                            {w.code} · {name(w)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {target.scope === "commune" && (
                    <div className="shipping-commune-fields">
                      <div>
                        <label htmlFor="override-wilaya">
                          {t("ولاية تجاوز البلدية")}
                        </label>
                        <select
                          id="override-wilaya"
                          value={communeWilaya}
                          onChange={(e) =>
                            void chooseCommuneWilaya(e.target.value)
                          }
                        >
                          <option value="">{t("اختر الولاية")}</option>
                          {wilayas.map((w) => (
                            <option key={w.id} value={w.code}>
                              {name(w)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="override-commune">
                          {t("بلدية التجاوز")}
                        </label>
                        <select
                          id="override-commune"
                          value={target.target}
                          disabled={communesLoading || !communes.length}
                          onChange={(e) => {
                            const next = {
                              scope: "commune" as const,
                              target: e.target.value,
                            };
                            setTarget(next);
                            setDraft(
                              state.entries.find(
                                (entry) =>
                                  entry.scope === "commune" &&
                                  entry.target === next.target,
                              )?.rule ?? emptyRule,
                            );
                          }}
                        >
                          <option value="">
                            {t(
                              communesLoading
                                ? "جارٍ تحميل البلديات…"
                                : "اختر البلدية",
                            )}
                          </option>
                          {communes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {name(c)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
              <RuleEditor
                rule={draft}
                onChange={(rule) => {
                  setDraft(rule);
                  setEditorError("");
                }}
              />
            </fieldset>
            {(editorError || error) && (
              <p role="alert" className="shipping-dialog-error">
                {message(editorError || error)}
              </p>
            )}
          </div>
          <footer className="ds-dialog-footer">
            <Button
              size="sm"
              disabled={
                busy || communesLoading || (editor === "rule" && !target.target)
              }
              onClick={() => void saveEditor()}
            >
              {t(
                editor === "bulk"
                  ? "تطبيق القاعدة على الولايات المحددة ("
                  : "حفظ القاعدة",
              )}
              {editor === "bulk" ? `${selected.length})` : ""}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={closeEditor}
            >
              {t("إلغاء")}
            </Button>
            {editor === "rule" && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busy ||
                  !target.target ||
                  !state.entries.some(
                    (entry) =>
                      entry.scope === target.scope &&
                      entry.target === target.target,
                  )
                }
                onClick={() => void reset([target])}
              >
                {t("حذف القاعدة الحالية")}
              </Button>
            )}
          </footer>
        </Dialog>
      )}
      {csvOpen && (
        <Dialog
          title={t("استيراد وتصدير الأسعار")}
          busy={busy}
          onClose={() => setCsvOpen(false)}
        >
          <div className="ds-dialog-body">
            <p className="shipping-muted">
              {t(
                "استخدم ملف التصدير قالبًا. تُرفض الصفوف المكررة أو غير الصالحة دون تغيير أسعارك.",
              )}
            </p>
            <label className="shipping-file-label" htmlFor="shipping-csv">
              {t("استيراد CSV (يحدّث القواعد الموجودة في الملف فقط)")}
            </label>
            <input
              id="shipping-csv"
              className="sr-only"
              tabIndex={-1}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                setCsvFile(e.target.files?.[0] ?? null);
                setCsvError("");
                setError("");
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => document.getElementById("shipping-csv")?.click()}
            >
              <Upload size={14} />
              {t("اختيار ملف CSV")}
            </Button>
            {csvFile && (
              <p className="shipping-muted">
                {csvFile.name} · {Math.ceil(csvFile.size / 1024)} KB
              </p>
            )}
            {(csvError || error) && (
              <p className="shipping-dialog-error" role="alert">
                {message(csvError || error)}
              </p>
            )}
          </div>
          <footer className="ds-dialog-footer">
            <Button
              size="sm"
              disabled={busy || !csvFile}
              onClick={async () => {
                if (!csvFile) return;
                if (csvFile.size > 1000000) {
                  setCsvError("ملف CSV أكبر من الحجم المسموح.");
                  return;
                }
                try {
                  if (
                    await mutate({
                      action: "import",
                      csv: await csvFile.text(),
                    })
                  )
                    setCsvOpen(false);
                } catch {
                  setCsvError("تعذر قراءة الملف.");
                }
              }}
            >
              {t("استيراد وحفظ")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setCsvOpen(false)}
            >
              {t("إلغاء")}
            </Button>
          </footer>
        </Dialog>
      )}
      {notice && (
        <Toast closeLabel={t("إغلاق الإشعار")} onClose={() => setNotice("")}>
          {t(notice)}
        </Toast>
      )}
    </div>
  );
}
