"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  Monitor,
  Palette,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Smartphone,
  Truck,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import {
  formSettingsSchema,
  labelDefaults,
  defaultFormSettings,
  type FormSettings,
  type elementDefaults,
} from "@/modules/forms/settings";
import { CustomerPreview } from "../customer-preview";
import { useCheckoutCatalog } from "./use-checkout";
import type { LocationOption } from "@/modules/geography/schema";
import { Button } from "../ui/button";
const fieldNames = {
  variant: "خيار المنتج",
  name: "الاسم",
  phone: "الهاتف",
  geography: "الموقع",
  method: "طريقة التوصيل",
  address: "العنوان",
  quantity: "الكمية",
};
const elementNames: Record<keyof typeof elementDefaults, string> = {
  productSelector: "قائمة اختيار المنتج",
  variant: "قائمة خيارات المنتج",
  productImage: "صورة المنتج",
  productTitle: "اسم المنتج",
  productPrice: "سعر المنتج",
  title: "عنوان النموذج",
  subtitle: "وصف النموذج",
  badge: "شريط الدفع عند الاستلام",
  summary: "ملخص الأسعار",
  footer: "النص أسفل الزر",
  quantity: "اختيار الكمية",
  geography: "اختيار الولاية والبلدية",
  method: "اختيار طريقة التوصيل",
  locationSearch: "حقول البحث عن المناطق",
  administrativeMode: "اختيار التقسيم الإداري",
};
const palette = [
  { name: "أخضر", color: "#008060" },
  { name: "أحمر", color: "#dc2626" },
  { name: "أصفر", color: "#facc15" },
  { name: "أزرق", color: "#2563eb" },
  { name: "برتقالي", color: "#f97316" },
];
export function FormBuilder({ onSaved }: { onSaved: () => void }) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<FormSettings>(defaultFormSettings);
  const [saved, setSaved] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("content");
  const [viewport, setViewport] = useState("mobile");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const catalog = useCheckoutCatalog(0);
  const [wilayas, setWilayas] = useState<LocationOption[]>([]);
  const [communes, setCommunes] = useState<LocationOption[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/form-config", { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const value = formSettingsSchema.parse(await r.json());
        if (!abort.signal.aborted) {
          setSettings(value);
          setSaved(JSON.stringify(value));
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setError("تعذر تحميل الإعدادات.");
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/geography/wilayas?mode=${settings.administrativeMode}`, {
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!abort.signal.aborted) setWilayas(d.items);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError("تعذر تحميل القائمة. أعد المحاولة.");
      });
    return () => abort.abort();
  }, [settings.administrativeMode]);
  useEffect(() => {
    if (!settings.fixedWilaya) return;
    const abort = new AbortController();
    fetch(
      `/api/geography/communes?mode=${settings.administrativeMode}&wilayaCode=${settings.fixedWilaya}`,
      { signal: abort.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!abort.signal.aborted) setCommunes(d.items);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError("تعذر تحميل القائمة. أعد المحاولة.");
      });
    return () => abort.abort();
  }, [settings.administrativeMode, settings.fixedWilaya]);
  const update = <K extends keyof FormSettings>(
    key: K,
    value: FormSettings[K],
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setMessage("");
  };
  async function save() {
    setError("");
    setMessage("");
    const parsed = formSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setError(
        /[\u0600-\u06ff]/.test(parsed.error.issues[0].message)
          ? parsed.error.issues[0].message
          : "تحقق من إعدادات النموذج.",
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/form-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!r.ok) throw new Error();
      setSaved(JSON.stringify(parsed.data));
      setMessage(
        "تم حفظ تصميم النموذج. المعاينة أدناه تستخدم الإعدادات المحفوظة.",
      );
      onSaved();
    } catch {
      setError("تعذر حفظ التصميم.");
    } finally {
      setBusy(false);
    }
  }
  const tabs = [
    { id: "content", label: "المحتوى", icon: SlidersHorizontal },
    { id: "fields", label: "الحقول", icon: Eye },
    { id: "design", label: "التصميم", icon: Palette },
    { id: "delivery", label: "التوصيل", icon: Truck },
  ];
  const textInput = (
    key:
      | "title"
      | "subtitle"
      | "buttonText"
      | "badgeText"
      | "footerText"
      | "successMessage"
      | "nameLabel"
      | "phoneLabel"
      | "addressLabel"
      | "namePlaceholder"
      | "phonePlaceholder"
      | "addressPlaceholder",
    label: string,
  ) => (
    <label key={key} className="editor-label">
      {t(label)}
      <input
        value={settings[key]}
        maxLength={
          key === "subtitle" || key === "footerText"
            ? 250
            : key === "successMessage"
              ? 200
              : 60
        }
        onChange={(e) => update(key, e.target.value)}
      />
    </label>
  );
  return (
    <section className="form-studio" aria-label={t("منشئ النموذج")}>
      <div className="studio-toolbar">
        <div>
          <h2 className="text-base font-bold">{t("تخصيص نموذج الطلب")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("تحكم في المحتوى والحقول والألوان، وشاهد النتيجة فورًا.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] ${JSON.stringify(settings) === saved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          >
            {t(
              JSON.stringify(settings) === saved
                ? "محفوظ"
                : "تغييرات غير محفوظة",
            )}
          </span>
          <Button
            size="sm"
            disabled={!loaded || busy}
            onClick={() => void save()}
          >
            <Save size={15} />
            {t(busy ? "جارٍ الحفظ…" : "حفظ النموذج")}
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
        >
          {t(error)}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {t(message)}
        </p>
      )}
      <div className="studio-grid">
        <div className="studio-editor">
          <div
            role="tablist"
            aria-label={t("إعدادات النموذج")}
            className="studio-tabs"
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon size={15} />
                {t(label)}
              </button>
            ))}
          </div>
          <fieldset disabled={!loaded || busy} className="p-5">
            {tab === "content" && (
              <div className="space-y-5">
                <div>
                  <h3 className="editor-heading">{t("نصوص النموذج")}</h3>
                  <div className="space-y-4">
                    {textInput("title", "عنوان النموذج")}
                    {textInput("subtitle", "وصف النموذج")}
                    {textInput("buttonText", "نص زر التأكيد")}
                    {textInput("successMessage", "رسالة النجاح")}
                    {textInput("badgeText", "نص الشريط العلوي")}
                    {textInput("footerText", "النص أسفل الزر")}
                  </div>
                </div>
                <div>
                  <h3 className="editor-heading">{t("تسميات الحقول")}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {textInput("nameLabel", "تسمية الاسم")}
                    {textInput("namePlaceholder", "تلميح الاسم")}
                    {textInput("phoneLabel", "تسمية الهاتف")}
                    {textInput("phonePlaceholder", "تلميح الهاتف")}
                    {textInput("addressLabel", "تسمية العنوان")}
                    {textInput("addressPlaceholder", "تلميح العنوان")}
                  </div>
                </div>
                <details className="rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-xs font-semibold">
                    {t("نصوص القوائم وملخص الأسعار")}
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {Object.entries(labelDefaults).map(([key, label]) => (
                      <label className="editor-label" key={key}>
                        {t("تسمية")} {t(label)}
                        <input
                          aria-label={`${t("تسمية")} ${t(label)}`}
                          value={
                            settings.labels[key as keyof typeof labelDefaults]
                          }
                          maxLength={80}
                          onChange={(e) =>
                            update("labels", {
                              ...settings.labels,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </details>
                <label className="editor-label">
                  {t("المنتج المعروض")}
                  <select
                    aria-label={t("المنتج المعروض")}
                    value={settings.featuredProductId}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        featuredProductId: e.target.value,
                        featuredVariantId: "",
                      }))
                    }
                  >
                    <option value="">{t("أول منتج متاح")}</option>
                    {catalog.catalog?.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="editor-label">
                  {t("الخيار المعروض")}
                  <select
                    aria-label={t("الخيار المعروض")}
                    value={settings.featuredVariantId}
                    onChange={(e) =>
                      update("featuredVariantId", e.target.value)
                    }
                  >
                    <option value="">{t("الخيار الأساسي")}</option>
                    {(
                      catalog.catalog?.products.find(
                        (p) => p.id === settings.featuredProductId,
                      ) ?? catalog.catalog?.products[0]
                    )?.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {tab === "fields" && (
              <div className="space-y-6">
                <div>
                  <h3 className="editor-heading">
                    {t("إظهار وإخفاء الأجزاء")}
                  </h3>
                  <div className="space-y-1">
                    {Object.entries(elementNames).map(([key, label]) => (
                      <label key={key} className="toggle-row">
                        <span>{t(label)}</span>
                        <input
                          type="checkbox"
                          role="switch"
                          aria-checked={
                            settings.elements[
                              key as keyof typeof elementDefaults
                            ]
                          }
                          className="toggle-switch"
                          checked={
                            settings.elements[
                              key as keyof typeof elementDefaults
                            ]
                          }
                          onChange={(e) =>
                            update("elements", {
                              ...settings.elements,
                              [key]: e.target.checked,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="editor-heading">{t("بيانات العميل")}</h3>
                  {(["name", "phone", "address"] as const).map((key) => (
                    <label key={key} className="editor-label">
                      {t(fieldNames[key])}
                      <select
                        aria-label={t(fieldNames[key])}
                        value={settings.contact[key]}
                        onChange={(e) =>
                          update("contact", {
                            ...settings.contact,
                            [key]: e.target.value as
                              "required" | "optional" | "hidden",
                          })
                        }
                      >
                        <option value="required">{t("ظاهر وإلزامي")}</option>
                        <option value="optional">{t("ظاهر واختياري")}</option>
                        <option value="hidden">{t("مخفي")}</option>
                      </select>
                    </label>
                  ))}
                  {settings.contact.phone === "hidden" && (
                    <p className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800">
                      {t(
                        "إخفاء الهاتف يحفظ الطلب دون رقم اتصال. تأكد أن لديك وسيلة أخرى للتواصل.",
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="editor-heading">{t("ترتيب الحقول")}</h3>
                  <div className="space-y-2">
                    {settings.order.map((key, i) => (
                      <div
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                        key={key}
                      >
                        <span className="text-xs font-medium">
                          {t(fieldNames[key])}
                        </span>
                        <div className="flex gap-1">
                          {([-1, 1] as const).map((dir) => (
                            <button
                              key={dir}
                              type="button"
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-25"
                              aria-label={`${t(dir === -1 ? "للأعلى" : "للأسفل")} ${t(fieldNames[key])}`}
                              disabled={
                                i + dir < 0 || i + dir >= settings.order.length
                              }
                              onClick={() => {
                                const order = [...settings.order];
                                [order[i], order[i + dir]] = [
                                  order[i + dir],
                                  order[i],
                                ];
                                update("order", order);
                              }}
                            >
                              {dir === -1 ? (
                                <ArrowUp size={14} />
                              ) : (
                                <ArrowDown size={14} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tab === "design" && (
              <div className="space-y-6">
                <div>
                  <h3 className="editor-heading">{t("ألوان الأزرار")}</h3>
                  <div className="flex flex-wrap gap-3">
                    {palette.map((p) => (
                      <button
                        type="button"
                        key={p.color}
                        title={t(p.name)}
                        aria-label={t(p.name)}
                        aria-pressed={settings.buttonColor === p.color}
                        onClick={() => update("buttonColor", p.color)}
                        className="grid h-10 w-10 place-items-center rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-slate-500"
                        style={{ backgroundColor: p.color }}
                      >
                        {settings.buttonColor === p.color && (
                          <Check
                            size={18}
                            color={p.name === "أصفر" ? "#111827" : "white"}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {(
                      [
                        { key: "buttonColor", label: "لون الزر" },
                        { key: "background", label: "الخلفية" },
                        { key: "textColor", label: "لون النص" },
                      ] as const
                    ).map((c) => (
                      <label key={c.key} className="editor-label">
                        {t(c.label)}
                        <input
                          type="color"
                          value={settings[c.key]}
                          onChange={(e) => update(c.key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <label className="toggle-row">
                  <span>{t("تصميم مختصر")}</span>
                  <input
                    className="toggle-switch"
                    role="switch"
                    aria-checked={settings.compact}
                    type="checkbox"
                    checked={settings.compact}
                    onChange={(e) => update("compact", e.target.checked)}
                  />
                </label>
                <label className="editor-label">
                  {t("توزيع الحقول")}
                  <select
                    aria-label={t("توزيع الحقول")}
                    value={settings.columns}
                    onChange={(e) =>
                      update("columns", e.target.value as "one" | "two")
                    }
                  >
                    <option value="two">{t("عمودان للاسم والهاتف")}</option>
                    <option value="one">{t("عمود واحد")}</option>
                  </select>
                </label>
                <label className="editor-label">
                  {t("الحدود")}
                  <select
                    aria-label={t("الحدود")}
                    value={settings.border}
                    onChange={(e) =>
                      update("border", e.target.value as "soft" | "plain")
                    }
                  >
                    <option value="soft">{t("ناعمة")}</option>
                    <option value="plain">{t("بسيطة")}</option>
                  </select>
                </label>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSettings(defaultFormSettings);
                    setMessage("");
                  }}
                >
                  <RotateCcw size={14} />
                  {t("استعادة التصميم الافتراضي")}
                </Button>
              </div>
            )}
            {tab === "delivery" && (
              <div className="space-y-5">
                <label className="editor-label">
                  {t("طرق التوصيل في النموذج")}
                  <select
                    aria-label={t("طرق التوصيل في النموذج")}
                    value={settings.deliveryMode}
                    onChange={(e) =>
                      update(
                        "deliveryMode",
                        e.target.value as "both" | "home" | "office",
                      )
                    }
                  >
                    <option value="both">
                      {t("المنزل والمكتب — يختار العميل")}
                    </option>
                    <option value="home">{t("التوصيل إلى المنزل")}</option>
                    <option value="office">{t("التوصيل إلى المكتب")}</option>
                  </select>
                </label>
                <label className="editor-label">
                  {t("الاختيار الافتراضي")}
                  <select
                    aria-label={t("الاختيار الافتراضي")}
                    value={settings.defaultMethod}
                    onChange={(e) =>
                      update(
                        "defaultMethod",
                        e.target.value as "none" | "home" | "office",
                      )
                    }
                  >
                    <option value="none">
                      {t("دون تحديد — يختار العميل")}
                    </option>
                    <option value="home">{t("التوصيل إلى المنزل")}</option>
                    <option value="office">{t("التوصيل إلى المكتب")}</option>
                  </select>
                </label>
                <p className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                  {t(
                    "فعّل أسعار المنزل والمكتب من أسعار الشحن. لا يظهر خيار متاح للعميل دون سعر مفعّل لمنطقته.",
                  )}
                </p>
                <label className="editor-label">
                  {t("التقسيم الإداري")}
                  <select
                    aria-label={t("التقسيم الإداري")}
                    value={settings.administrativeMode}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        administrativeMode: e.target.value as
                          "legacy58" | "updated69",
                        fixedWilaya: "",
                        fixedCommune: "",
                      }))
                    }
                  >
                    <option value="legacy58">
                      {t("٥٨ ولاية · الافتراضي")}
                    </option>
                    <option value="updated69">
                      {t("٦٩ ولاية · مراجعة رسمية معلّقة")}
                    </option>
                  </select>
                </label>
                {!settings.elements.geography && (
                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <p className="text-xs leading-6 text-slate-500">
                      {t(
                        "حدد المنطقة الثابتة التي ستُستخدم لحساب الشحن عند إخفاء حقول المنطقة.",
                      )}
                    </p>
                    <label className="editor-label">
                      {t("الولاية الثابتة")}
                      <select
                        aria-label={t("الولاية الثابتة")}
                        value={settings.fixedWilaya}
                        onChange={(e) => {
                          setCommunes([]);
                          setSettings((s) => ({
                            ...s,
                            fixedWilaya: e.target.value,
                            fixedCommune: "",
                          }));
                        }}
                      >
                        <option value="">{t("اختر الولاية")}</option>
                        {wilayas.map((w) => (
                          <option key={w.id} value={w.code}>
                            {w.nameAr} — {w.nameLatin}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="editor-label">
                      {t("البلدية الثابتة")}
                      <select
                        aria-label={t("البلدية الثابتة")}
                        value={settings.fixedCommune}
                        disabled={!settings.fixedWilaya}
                        onChange={(e) => update("fixedCommune", e.target.value)}
                      >
                        <option value="">{t("اختر البلدية")}</option>
                        {communes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameAr} — {c.nameLatin}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </div>
        <div className="studio-preview">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              {t("معاينة مباشرة")}
            </span>
            <fieldset
              className="viewport-switch"
              aria-label={t("حجم المعاينة")}
            >
              {[
                { id: "mobile", name: "هاتف", icon: Smartphone },
                { id: "desktop", name: "حاسوب", icon: Monitor },
              ].map(({ id, name, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={viewport === id}
                  onClick={() => setViewport(id)}
                >
                  <Icon size={14} />
                  {t(name)}
                </button>
              ))}
            </fieldset>
          </div>
          <div
            className={`mx-auto w-full ${viewport === "mobile" ? "max-w-[360px]" : "max-w-[480px]"}`}
          >
            <CustomerPreview settings={settings} previewOnly />
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-500">
            {t("المعاينة لا تحفظ طلبًا. احفظ التصميم وافتح النموذج لتجربته.")}
          </p>
        </div>
      </div>
    </section>
  );
}
