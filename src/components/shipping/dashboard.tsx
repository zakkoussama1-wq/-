"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
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
import { formatDzd } from "@/lib/i18n";
export function ShippingDashboard({
  onSaved,
}: {
  onSaved?: () => void;
} = {}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AdministrativeMode>("legacy58");
  return (
    <section className="mb-8 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">{t("إدارة أسعار الشحن")}</h2>
        <p className="my-3 text-sm leading-7 text-slate-600">
          {t(
            "عدّل أسعار التوصيل بالدينار لكل الولايات أو ولاية أو بلدية محددة. أسعار وضع التجربة أمثلة وهمية قابلة للتعديل وليست أسعار ناقل.",
          )}
        </p>
        <label htmlFor="shipping-mode">{t("نظام مناطق الشحن")}</label>
        <select
          id="shipping-mode"
          value={mode}
          onChange={(e) =>
            setMode(administrativeModeSchema.parse(e.target.value))
          }
        >
          <option value="legacy58">{t("٥٨ ولاية")}</option>
          <option value="updated69">
            {t("٦٩ ولاية · مراجعة رسمية معلّقة")}
          </option>
        </select>
        {mode === "updated69" && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-950">
            {t(
              "خريطة ٦٩ ولاية مبنية على مرجع ثانوي، والمطابقة الرسمية المباشرة معلّقة. أسعار هذا النظام مستقلة عن نظام ٥٨ ولا تُنقل تلقائيًا.",
            )}
          </p>
        )}
      </div>
      <ShippingManager key={mode} mode={mode} onSaved={onSaved} />
    </section>
  );
}
function ShippingManager({
  mode,
  onSaved,
}: {
  mode: AdministrativeMode;
  onSaved?: () => void;
}) {
  const { t } = useLanguage();
  const [state, setState] = useState<ShippingState | null>(null);
  const [wilayas, setWilayas] = useState<LocationOption[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<RuleTarget>({
    scope: "default",
    target: "*",
  });
  const [draft, setDraft] = useState<ShippingRule>(emptyRule);
  const [communeWilaya, setCommuneWilaya] = useState("");
  const [communes, setCommunes] = useState<LocationOption[]>([]);
  const communeRequest = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit revision/retry triggers must refresh remote settings.
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
          setTarget({ scope: "default", target: "*" });
          setDraft(
            s.entries.find((e) => e.scope === "default")?.rule ?? emptyRule,
          );
          setSelected([]);
          setWilayas(g.items);
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
  async function mutate(change: object) {
    if (!state) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, revision: state.revision, ...change }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "تعذر حفظ أسعار الشحن.");
      setState(shippingStateSchema.parse(data));
      setNotice("تم حفظ إعدادات الشحن.");
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ أسعار الشحن.");
    } finally {
      setBusy(false);
    }
  }
  function edit(next: RuleTarget) {
    setTarget(next);
    setDraft(
      state?.entries.find(
        (e) => e.scope === next.scope && e.target === next.target,
      )?.rule ?? emptyRule,
    );
    setNotice("");
  }
  async function save(targets: RuleTarget[]) {
    const parsed = ruleSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    if (!targets.length || targets.some((t) => !t.target)) {
      setError("اختر منطقة واحدة على الأقل.");
      return;
    }
    await mutate({
      action: "save",
      entries: targets.map((t) => ({ ...t, rule: parsed.data })),
    });
  }
  async function reset(targets: RuleTarget[]) {
    if (
      targets.length &&
      window.confirm(
        t("هل تريد حذف القواعد المحددة والرجوع إلى السعر الأقل أولوية إن وجد؟"),
      )
    )
      await mutate({ action: "reset", targets });
  }
  async function chooseCommuneWilaya(code: string): Promise<boolean> {
    communeRequest.current?.abort();
    const controller = new AbortController();
    communeRequest.current = controller;
    setCommuneWilaya(code);
    setCommunes([]);
    edit({ scope: "commune", target: "" });
    if (!code) return false;
    try {
      const r = await fetch(
        `/api/geography/communes?mode=${mode}&wilayaCode=${code}`,
        { signal: controller.signal },
      );
      if (!r.ok) throw new Error();
      const data = geographyResponseSchema.parse(await r.json());
      if (controller.signal.aborted) return false;
      setCommunes(data.items);
      return true;
    } catch {
      if (!controller.signal.aborted) setError("تعذر تحميل بلديات التجاوز.");
      return false;
    }
  }
  const bulkTargets: RuleTarget[] = selected.map((code) => ({
    scope: "wilaya",
    target: code,
  }));
  if (!state)
    return (
      <section className="rounded-xl bg-white p-5" aria-busy={!error}>
        {error ? (
          <>
            <p role="alert">{t(error)}</p>
            <Button className="mt-3" onClick={() => setRetry((n) => n + 1)}>
              {t("إعادة تحميل الشحن")}
            </Button>
          </>
        ) : (
          <p role="status">{t("جارٍ تحميل أسعار الشحن…")}</p>
        )}
      </section>
    );
  const visible = wilayas
    .filter((w) =>
      normalizeSearch(`${w.code} ${w.nameAr} ${w.nameLatin}`).includes(
        normalizeSearch(search),
      ),
    )
    .filter((w) =>
      filter === "all" || filter === "configured"
        ? filter !== "configured" ||
          state.entries.some((e) => e.scope === "wilaya" && e.target === w.code)
        : filter === "available"
          ? calculateShipping(state, w.code!, "", "home").available
          : !calculateShipping(state, w.code!, "", "home").available,
    );
  return (
    <div className="space-y-5" aria-busy={busy}>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{t(error)}</p>
          <Button
            variant="outline"
            className="mt-2"
            disabled={busy}
            onClick={() => {
              setRetry((n) => n + 1);
              setNotice("");
            }}
          >
            {t("إعادة تحميل الشحن")}
          </Button>
        </div>
      )}{" "}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {t(notice)}
        </p>
      )}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">{t("المكتب والتبادل عبر CSV")}</h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="!w-4"
            checked={state.genericOffice}
            disabled={busy}
            onChange={(e) =>
              void mutate({
                action: "settings",
                genericOffice: e.target.checked,
              })
            }
          />
          {t("السماح بتوصيل المكتب العام دون قائمة مكاتب")}
        </label>
        <p className="text-xs leading-6 text-slate-500">
          {t(
            "لا توجد مكاتب استلام مسماة أو عناوين مختلقة. يظل المكتب معطّلًا حتى تفعّل هذا الإعداد وتحدد سعرًا مفعّلًا.",
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <a href={`/api/shipping/csv?mode=${mode}`}>
              {t("تصدير أسعار CSV")}
            </a>
          </Button>
          <div className="min-w-0 max-w-full">
            <label htmlFor="shipping-csv">
              {t("استيراد CSV (يحدّث القواعد الموجودة في الملف فقط)")}
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => document.getElementById("shipping-csv")?.click()}
            >
              {t("اختيار ملف CSV")}
            </Button>
            <input
              id="shipping-csv"
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1000000) {
                  setError("ملف CSV أكبر من الحجم المسموح.");
                  return;
                }
                try {
                  await mutate({ action: "import", csv: await file.text() });
                } catch {
                  setError("تعذر قراءة الملف.");
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <p className="text-xs leading-6 text-slate-500">
          {t(
            "التصدير يشمل القواعد المضبوطة فقط. لا يستورد الملف تفعيل المكتب العام. تُرفض العملية كاملة عند وجود صف خاطئ أو مكرر.",
          )}
        </p>
      </section>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">{t("تعديل سعر أو تطبيق جماعي")}</h3>
        <div>
          <label htmlFor="rule-scope">{t("نطاق القاعدة")}</label>
          <select
            id="rule-scope"
            value={target.scope}
            disabled={busy}
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
                  {t(w.code)} · {t(w.nameAr)}
                </option>
              ))}
            </select>
          </div>
        )}{" "}
        {target.scope === "commune" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="override-wilaya">
                {t("ولاية تجاوز البلدية")}
              </label>
              <select
                id="override-wilaya"
                value={communeWilaya}
                onChange={(e) => void chooseCommuneWilaya(e.target.value)}
              >
                <option value="">{t("اختر الولاية")}</option>
                {wilayas.map((w) => (
                  <option key={w.id} value={w.code}>
                    {t(w.nameAr)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="override-commune">{t("بلدية التجاوز")}</label>
              <select
                id="override-commune"
                value={target.target}
                disabled={!communes.length}
                onChange={(e) =>
                  edit({ scope: "commune", target: e.target.value })
                }
              >
                <option value="">{t("اختر البلدية")}</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(c.nameAr)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <RuleEditor rule={draft} onChange={setDraft} />
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !target.target}
            onClick={() => void save([target])}
          >
            {t("حفظ القاعدة")}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !selected.length}
            onClick={() => void save(bulkTargets)}
          >
            {t("تطبيق القاعدة على الولايات المحددة (")}
            {selected.length})
          </Button>
          <Button
            variant="outline"
            disabled={busy || !target.target}
            onClick={() => void reset([target])}
          >
            {t("حذف القاعدة الحالية")}
          </Button>
        </div>
        {state.entries.some((e) => e.scope === "commune") && (
          <div>
            <h4 className="mb-2 text-sm font-bold">
              {t("تجاوزات البلديات المحفوظة")}
            </h4>
            <div className="flex flex-wrap gap-2">
              {state.entries
                .filter((e) => e.scope === "commune")
                .map((e) => (
                  <Button
                    key={e.target}
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (
                        await chooseCommuneWilaya(
                          state.communeParents?.[e.target] ?? "",
                        )
                      )
                        edit(e);
                    }}
                  >
                    {t("تعديل")}{" "}
                    {t(state.communeNames?.[e.target] ?? "البلدية المختارة")}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </section>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">{t("أسعار الولايات الفعلية")}</h3>
        <p className="text-xs leading-6 text-slate-500">
          {t(
            "المعروض هو سعر الولاية أو الافتراضي. تجاوز البلدية يسبق هذا السعر عند الحساب. تُحفظ القواعد في النظام المختار فقط.",
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="shipping-search">{t("بحث الولايات")}</label>
            <input
              id="shipping-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="shipping-filter">{t("تصفية الأسعار")}</label>
            <select
              id="shipping-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t("كل الولايات")}</option>
              <option value="configured">{t("قواعد ولاية مضبوطة")}</option>
              <option value="available">{t("المنزل متاح")}</option>
              <option value="unavailable">{t("المنزل غير متاح")}</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="!w-4"
            checked={
              visible.length > 0 &&
              visible.every((w) => selected.includes(w.code!))
            }
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...new Set([...selected, ...visible.map((w) => w.code!)])]
                  : selected.filter((c) => !visible.some((w) => w.code === c)),
              )
            }
          />
          {t("تحديد الولايات الظاهرة")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || !selected.length}
            onClick={() =>
              void mutate({
                action: "save",
                entries: selected.map((code) => {
                  const rule =
                    state.entries.find(
                      (e) => e.scope === "wilaya" && e.target === code,
                    )?.rule ??
                    state.entries.find((e) => e.scope === "default")?.rule ??
                    emptyRule;
                  return {
                    scope: "wilaya",
                    target: code,
                    rule: {
                      ...rule,
                      available: true,
                      home: { enabled: true, price: 0 },
                    },
                  } satisfies RuleEntry;
                }),
              })
            }
          >
            {t("منزل مجاني للمحدد")}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !selected.length}
            onClick={() => void reset(bulkTargets)}
          >
            {t("إعادة ضبط المحدد")}
          </Button>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map((w) => {
            const home = calculateShipping(state, w.code!, "", "home");
            const office = calculateShipping(state, w.code!, "", "office");
            return (
              <article
                key={w.id}
                className="rounded-xl border border-slate-200 p-4"
                data-testid={`shipping-row-${w.code}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="!mb-0 flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="!w-4"
                      aria-label={`${t("تحديد")} ${w.nameAr}`}
                      checked={selected.includes(w.code!)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, w.code!]
                            : selected.filter((c) => c !== w.code),
                        )
                      }
                    />
                    {t(w.code)} · {t(w.nameAr)}
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => edit({ scope: "wilaya", target: w.code! })}
                  >
                    {t("تعديل")} {t(w.nameAr)}
                  </Button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">{t("المنزل")}</dt>
                    <dd className="mt-2 font-bold">
                      {t(home.available ? formatDzd(home.amount!) : "غير متاح")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{t("المكتب")}</dt>
                    <dd className="mt-2 font-bold">
                      {t(
                        office.available
                          ? formatDzd(office.amount!)
                          : "غير متاح",
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">
                  {t(
                    state.entries.some(
                      (e) => e.scope === "wilaya" && e.target === w.code,
                    )
                      ? "قاعدة ولاية خاصة"
                      : "يرث الافتراضي إن وُجد",
                  )}
                </p>
              </article>
            );
          })}
        </div>
        {!visible.length && (
          <p role="status">{t("لا توجد ولايات تطابق البحث والتصفية.")}</p>
        )}
      </section>
      <QuoteTester key={state.revision} mode={mode} wilayas={wilayas} />
    </div>
  );
}
