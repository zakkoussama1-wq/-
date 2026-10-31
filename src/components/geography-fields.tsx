"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useReducer, useState } from "react";
import { Button } from "./ui/button";
import {
  administrativeModeSchema,
  geographyResponseSchema,
  type LocationOption,
} from "@/modules/geography/schema";
import {
  geographySelectionReducer,
  initialGeographySelection,
  type GeographySelection,
  type GeographyAction,
} from "@/modules/geography/selection";
function useLocations(
  kind: "wilayas" | "communes",
  mode: string,
  wilayaCode: string,
  query: string,
  retry: number,
) {
  const key = JSON.stringify([kind, mode, wilayaCode, query, retry]);
  const [result, setResult] = useState<{
    key: string;
    items: LocationOption[];
    error: string;
  } | null>(null);
  const enabled = kind === "wilayas" || Boolean(wilayaCode);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit revision/retry triggers must refresh remote settings.
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ mode, q: query });
        if (kind === "communes") params.set("wilayaCode", wilayaCode);
        const response = await fetch(`/api/geography/${kind}?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("تعذر تحميل القائمة. أعد المحاولة.");
        const data = geographyResponseSchema.parse(await response.json());
        if (!controller.signal.aborted)
          setResult({ key, items: data.items, error: "" });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            key,
            items: [],
            error:
              error instanceof Error &&
              error.message === "تعذر تحميل القائمة. أعد المحاولة."
                ? error.message
                : "تعذر قراءة البيانات الجغرافية. أعد المحاولة.",
          });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, key, kind, mode, wilayaCode, query, retry]);
  return {
    items: result?.key === key ? result.items : [],
    error: result?.key === key ? result.error : "",
    loading: enabled && result?.key !== key,
  };
}
export function GeographyFields({
  value,
  onChange,
  errors = {},
}: {
  value?: GeographySelection;
  onChange?: (value: GeographySelection) => void;
  errors?: {
    wilayaCode?: string;
    communeId?: string;
  };
} = {}) {
  const { t } = useLanguage();
  const [internal, internalDispatch] = useReducer(
    geographySelectionReducer,
    initialGeographySelection,
  );
  const selection = value ?? internal;
  function dispatch(action: GeographyAction) {
    const next = geographySelectionReducer(selection, action);
    if (value === undefined) internalDispatch(action);
    onChange?.(next);
  }
  const [wilayaQuery, setWilayaQuery] = useState("");
  const [communeQuery, setCommuneQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const wilayas = useLocations(
    "wilayas",
    selection.mode,
    "",
    wilayaQuery,
    retry,
  );
  const communes = useLocations(
    "communes",
    selection.mode,
    selection.wilayaCode,
    communeQuery,
    retry,
  );
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 text-sm font-bold">
        {t("الولاية والبلدية")}
      </legend>
      <div>
        <label htmlFor="administrative-mode">{t("التقسيم الإداري")}</label>
        <select
          id="administrative-mode"
          value={selection.mode}
          onChange={(e) => {
            dispatch({
              type: "mode",
              value: administrativeModeSchema.parse(e.target.value),
            });
            setWilayaQuery("");
            setCommuneQuery("");
          }}
        >
          <option value="legacy58">{t("٥٨ ولاية · الافتراضي")}</option>
          <option value="updated69">
            {t("٦٩ ولاية · مرجع ثانوي قيد المطابقة الرسمية")}
          </option>
        </select>
      </div>
      {selection.mode === "updated69" && (
        <p
          role="note"
          className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-950"
        >
          {t(
            "خريطة ٦٩ ولاية مبنية على قوائم قانون منقولة في مرجع مفتوح. المطابقة المباشرة مع ملف الجريدة الرسمية لا تزال معلّقة؛ لا تستخدمها لتنفيذ طلبات فعلية قبل إتمام المراجعة.",
          )}
        </p>
      )}
      <div>
        <label htmlFor="wilaya-search">
          {t("البحث عن ولاية بالعربية أو الفرنسية")}
        </label>
        <input
          id="wilaya-search"
          type="search"
          maxLength={100}
          value={wilayaQuery}
          placeholder={t("مثال: المسيلة أو M’Sila")}
          onChange={(e) => setWilayaQuery(e.target.value)}
        />
        <label htmlFor="wilaya" className="mt-3">
          {t("الولاية")}
        </label>
        <select
          id="wilaya"
          aria-invalid={!!errors.wilayaCode}
          aria-describedby={errors.wilayaCode ? "wilaya-error" : undefined}
          value={selection.wilayaCode}
          disabled={wilayas.loading || !!wilayas.error}
          onChange={(e) => {
            dispatch({ type: "wilaya", value: e.target.value });
            setCommuneQuery("");
          }}
        >
          <option value="">
            {t(wilayas.loading ? "جارٍ تحميل الولايات…" : "اختر الولاية")}
          </option>
          {selection.wilayaCode &&
            !wilayas.items.some((w) => w.code === selection.wilayaCode) && (
              <option value={selection.wilayaCode}>
                {t(selection.wilayaCode)}{" "}
                {t("· الولاية المختارة خارج نتائج البحث")}
              </option>
            )}{" "}
          {wilayas.items.map((w) => (
            <option key={w.id} value={w.code}>
              {t(w.code)} · {t(w.nameAr)} — {t(w.nameLatin)}
            </option>
          ))}
        </select>
        {errors.wilayaCode && (
          <p id="wilaya-error" role="alert" className="field-error">
            {t(errors.wilayaCode)}
          </p>
        )}{" "}
        {!wilayas.loading && !wilayas.error && wilayas.items.length === 0 && (
          <p role="status" className="mt-2 text-xs text-slate-600">
            {t("لا توجد ولاية مطابقة للبحث.")}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="commune-search">
          {t("البحث عن بلدية بالعربية أو الفرنسية")}
        </label>
        <input
          id="commune-search"
          type="search"
          maxLength={100}
          value={communeQuery}
          disabled={!selection.wilayaCode}
          placeholder={t("ابحث ضمن الولاية المختارة")}
          onChange={(e) => setCommuneQuery(e.target.value)}
        />
        <label htmlFor="commune" className="mt-3">
          {t("البلدية")}
        </label>
        <select
          id="commune"
          aria-invalid={!!errors.communeId}
          aria-describedby={errors.communeId ? "commune-error" : undefined}
          value={selection.communeId}
          disabled={
            !selection.wilayaCode || communes.loading || !!communes.error
          }
          onChange={(e) => dispatch({ type: "commune", value: e.target.value })}
        >
          <option value="">
            {t(
              !selection.wilayaCode
                ? "اختر الولاية أولًا"
                : communes.loading
                  ? "جارٍ تحميل البلديات…"
                  : "اختر البلدية",
            )}
          </option>
          {selection.communeId &&
            !communes.items.some((c) => c.id === selection.communeId) && (
              <option value={selection.communeId}>
                {t("البلدية المختارة خارج نتائج البحث")}
              </option>
            )}{" "}
          {communes.items.map((c) => (
            <option key={c.id} value={c.id}>
              {t(c.nameAr)} — {t(c.nameLatin)}
            </option>
          ))}
        </select>
        {errors.communeId && (
          <p id="commune-error" role="alert" className="field-error">
            {t(errors.communeId)}
          </p>
        )}{" "}
        {selection.wilayaCode &&
          !communes.loading &&
          !communes.error &&
          communes.items.length === 0 && (
            <p role="status" className="mt-2 text-xs text-slate-600">
              {t("لا توجد بلدية مطابقة ضمن هذه الولاية.")}
            </p>
          )}
      </div>
      {(wilayas.error || communes.error) && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          <p>{t(wilayas.error || communes.error)}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => setRetry((r) => r + 1)}
          >
            {t("إعادة تحميل المواقع")}
          </Button>
        </div>
      )}
      <p className="text-xs leading-6 text-slate-500">
        {t(
          "١٥٤١ بلدية محفوظة محليًا. تظهر بلديات الولاية المحددة فقط؛ يُمسح اختيار البلدية عند تغيير الولاية أو النظام. لا يُحفظ اختيار العميل كطلب.",
        )}
      </p>
    </fieldset>
  );
}
