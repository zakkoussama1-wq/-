"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useLanguage, LanguageSwitcher } from "../language-provider";
import {
  defaultFormSettings,
  formSettingsSchema,
  type FormSettings,
} from "@/modules/forms/settings";
import { catalogSchema, type CheckoutProduct } from "@/modules/checkout/schema";
import { embeddedFetch } from "@/lib/merchant-fetch";
import { EmbeddedPreview } from "./preview";
import { ShippingDashboard } from "../shipping/dashboard";
const navigation = [
  ["builder", "منشئ النموذج"],
  ["design", "تصميم النموذج"],
  ["shipping", "رسوم الشحن"],
  ["integrations", "تكاملات API والتتبع"],
  ["settings", "الإعدادات"],
] as const;
const names = {
  variant: "المتغير",
  name: "الاسم",
  phone: "الهاتف",
  geography: "الولاية والبلدية",
  method: "طريقة التوصيل",
  address: "العنوان",
  quantity: "الكمية",
};
const elements = {
  productImage: "صورة المنتج",
  productTitle: "اسم المنتج",
  productPrice: "سعر المنتج",
  title: "عنوان النموذج",
  subtitle: "وصف النموذج",
  badge: "شارة COD",
  variant: "اختيار المتغير",
  quantity: "اختيار الكمية",
  geography: "اختيار المنطقة",
  method: "اختيار التوصيل",
  summary: "ملخص الأسعار",
  footer: "نص التذييل",
} as const;
async function read(path: string) {
  const response = await embeddedFetch("/api/embedded/" + path);
  if (!response.ok) throw new Error();
  return response.json();
}
export function EmbeddedDashboard({
  section,
  styleText,
}: {
  section: string;
  styleText: string;
}) {
  const { t, language } = useLanguage();
  const [settings, setSettings] = useState<FormSettings>(defaultFormSettings);
  const [baseline, setBaseline] = useState("");
  const [shop, setShop] = useState("");
  const [products, setProducts] = useState<CheckoutProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [revision, setRevision] = useState(0);
  const [contextQuery, setContextQuery] = useState("");
  const [scopes, setScopes] = useState<{
    readProductsGranted: boolean;
    writeOrdersGranted: boolean;
    offline: boolean;
  } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      allowed = new URLSearchParams();
    for (const key of ["host", "shop"]) {
      const value = params.get(key);
      if (value && value.length <= 1024) allowed.set(key, value);
    }
    setContextQuery(allowed.size ? "?" + allowed : "");
    const sessionExpired = () =>
      setError("انتهت جلسة Shopify. أعد فتح التطبيق من Apps، ثم أعد المحاولة.");
    window.addEventListener("dz:embedded-session-expired", sessionExpired);
    return () =>
      window.removeEventListener("dz:embedded-session-expired", sessionExpired);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload explicitly retries the authenticated initial reads.
  useEffect(() => {
    let active = true;
    setError("");
    void Promise.all([read("session"), read("form-config"), read("catalog")])
      .then(([session, design, catalog]) => {
        if (!active) return;
        const parsed = formSettingsSchema.parse(design),
          items = catalogSchema.parse(catalog).products;
        setShop(session.shop);
        setSettings(parsed);
        setBaseline(JSON.stringify(parsed));
        setProducts(items);
        setProductId((id) =>
          items.some((p) => p.id === id) ? id : (items[0]?.id ?? ""),
        );
      })
      .catch(() => {
        if (active)
          setError(
            "تعذر فتح إعدادات المتجر. افتح التطبيق من Shopify Admin وتحقق من جلسة App Bridge والاتصال.",
          );
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const dirty = !!baseline && JSON.stringify(settings) !== baseline;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = <K extends keyof FormSettings>(
    key: K,
    value: FormSettings[K],
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setMessage("");
  };
  const save = async () => {
    if (!baseline || busy) return;
    const parsed = formSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setError(
        "تحقق من الحقول: إخفاء المنطقة يتطلب ولاية وبلدية ثابتتين، وإخفاء التوصيل يتطلب طريقة واحدة.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await embeddedFetch("/api/embedded/form-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error();
      setSettings(parsed.data);
      setBaseline(JSON.stringify(parsed.data));
      setRevision((n) => n + 1);
      setMessage(
        "حُفظت إعدادات هذا المتجر. تظهر في النموذج عند تحميله من جديد.",
      );
    } catch {
      setError("تعذر حفظ الإعدادات. تحقق من جلسة Shopify وصحة الإعدادات.");
    } finally {
      setBusy(false);
    }
  };
  const textField = (
    key:
      | "title"
      | "subtitle"
      | "buttonText"
      | "footerText"
      | "badgeText"
      | "nameLabel"
      | "phoneLabel"
      | "addressLabel"
      | "namePlaceholder"
      | "phonePlaceholder"
      | "addressPlaceholder"
      | "officePickupInstructions",
    label: string,
  ) => (
    <label key={key}>
      {t(label)}
      <input
        value={settings[key] ?? ""}
        maxLength={
          key === "officePickupInstructions"
            ? 300
            : key.endsWith("Label")
              ? 60
              : key === "buttonText"
                ? 80
                : key === "title"
                  ? 100
                  : 250
        }
        onChange={(event) => update(key, event.target.value)}
      />
    </label>
  );
  const product = products.find((p) => p.id === productId);
  const editing = ["builder", "design", "settings"].includes(section);
  return (
    <div className="embedded-app" dir={language === "ar" ? "rtl" : "ltr"}>
      <ui-nav-menu>
        <a href={`/shopify${contextQuery}`} rel="home">
          DZ Lead Form Pro
        </a>
        {navigation.map(([id, title]) => (
          <a key={id} href={`/shopify/${id}${contextQuery}`}>
            {t(title)}
          </a>
        ))}
      </ui-nav-menu>
      <header className="embedded-header">
        <LanguageSwitcher />
        <div>
          <h1>{t(navigation.find(([id]) => id === section)?.[1] ?? "")}</h1>
          <p>{shop || t("جار التحقق من جلسة Shopify…")}</p>
        </div>
        {editing && (
          <button
            type="button"
            disabled={!baseline || busy || !dirty}
            onClick={() => void save()}
          >
            {t(busy ? "جار الحفظ…" : "حفظ الإعدادات")}
          </button>
        )}
      </header>
      <nav aria-label={t("أقسام تخصيص النموذج")} className="embedded-tabs">
        {navigation.map(([id, title]) => (
          <a
            key={id}
            href={`/shopify/${id}${contextQuery}`}
            aria-current={section === id ? "page" : undefined}
          >
            {t(title)}
          </a>
        ))}
      </nav>
      <p className="embedded-notice">
        {t(
          "معاينة وتخصيص فقط — لا إنشاء طلبات أو إرسالها إلى Shopify أو أحداث Purchase أو إشعارات.",
        )}
      </p>
      {error && (
        <div role="alert">
          {t(error)}
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            {t("إعادة المحاولة")}
          </button>
        </div>
      )}
      {message && <p role="status">{t(message)}</p>}
      {!!baseline && editing && (
        <div className="embedded-studio">
          <section className="embedded-panel">
            <fieldset disabled={busy}>
              {section === "builder" && (
                <>
                  <h2>{t("محتوى النموذج")}</h2>
                  {textField("title", "عنوان النموذج")}
                  {textField("subtitle", "وصف النموذج")}
                  {textField("buttonText", "نص زر التحقق")}
                  {textField("footerText", "نص التذييل")}
                  {textField("badgeText", "نص شارة COD")}
                  <h2>{t("الحقول والإلزامية")}</h2>
                  {(["name", "phone", "address"] as const).map((key) => (
                    <label key={key}>
                      {t(names[key])}
                      <select
                        aria-label={`إلزامية ${t(names[key])}`}
                        value={settings.contact[key]}
                        onChange={(e) =>
                          update("contact", {
                            ...settings.contact,
                            [key]: e.target.value as
                              "required" | "optional" | "hidden",
                          })
                        }
                      >
                        <option value="required">{t("إلزامي")}</option>
                        <option value="optional">{t("اختياري")}</option>
                        <option value="hidden">{t("مخفي")}</option>
                      </select>
                    </label>
                  ))}
                  {textField("nameLabel", "عنوان حقل الاسم")}
                  {textField("phoneLabel", "عنوان حقل الهاتف")}
                  {textField("addressLabel", "عنوان حقل العنوان")}
                  {textField("namePlaceholder", "مثال الاسم")}
                  {textField("phonePlaceholder", "مثال الهاتف")}
                  {textField("addressPlaceholder", "مثال العنوان")}
                  <h2>{t("إظهار عناصر النموذج")}</h2>
                  {Object.entries(elements).map(([key, title]) => (
                    <label className="embedded-check" key={key}>
                      <input
                        type="checkbox"
                        checked={
                          settings.elements[key as keyof typeof elements]
                        }
                        onChange={(e) =>
                          update("elements", {
                            ...settings.elements,
                            [key]: e.target.checked,
                          })
                        }
                      />
                      {t(title)}
                    </label>
                  ))}
                  <h2>{t("ترتيب الحقول")}</h2>
                  <ol className="embedded-order">
                    {settings.order.map((key, i) => (
                      <li key={key}>
                        <span>{t(names[key])}</span>
                        {[-1, 1].map((delta) => (
                          <button
                            key={delta}
                            type="button"
                            disabled={
                              i + delta < 0 ||
                              i + delta >= settings.order.length
                            }
                            aria-label={`${delta < 0 ? "رفع" : "خفض"} ${t(names[key])}`}
                            onClick={() => {
                              const order = [...settings.order];
                              [order[i], order[i + delta]] = [
                                order[i + delta],
                                order[i],
                              ];
                              update("order", order);
                            }}
                          >
                            {delta < 0 ? "↑" : "↓"}
                          </button>
                        ))}
                      </li>
                    ))}
                  </ol>
                  <h2>{t("التوصيل")}</h2>
                  <label>
                    {t("طرق التوصيل")}
                    <select
                      value={settings.deliveryMode}
                      onChange={(e) =>
                        update(
                          "deliveryMode",
                          e.target.value as FormSettings["deliveryMode"],
                        )
                      }
                    >
                      <option value="both">{t("المنزل والمكتب")}</option>
                      <option value="home">{t("المنزل فقط")}</option>
                      <option value="office">{t("المكتب فقط")}</option>
                    </select>
                  </label>
                  {!settings.elements.geography && (
                    <>
                      <label>
                        {t("رمز الولاية الثابت")}
                        <input
                          value={settings.fixedWilaya}
                          maxLength={2}
                          onChange={(e) =>
                            update("fixedWilaya", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        {t("معرف البلدية الثابت")}
                        <input
                          value={settings.fixedCommune}
                          placeholder="dz:commune:…"
                          onChange={(e) =>
                            update("fixedCommune", e.target.value)
                          }
                        />
                      </label>
                      <p>
                        {t(
                          "يُتحقق من تبعية البلدية للولاية على الخادم؛ لا تُستخدم منطقة افتراضية وهمية.",
                        )}
                      </p>
                    </>
                  )}
                  {textField(
                    "officePickupInstructions",
                    "تعليمات المكتب العام",
                  )}
                </>
              )}
              {(section === "design" || section === "settings") && (
                <>
                  <h2>{t("اللغة والخط والتصميم")}</h2>
                  <label>
                    {t("لغة النموذج")}
                    <select
                      value={settings.locale}
                      onChange={(e) =>
                        update(
                          "locale",
                          e.target.value as FormSettings["locale"],
                        )
                      }
                    >
                      <option value="auto">{t("لغة المتجر")}</option>
                      <option value="ar">{t("العربية")}</option>
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  <label>
                    {t("الخط")}
                    <select
                      value={settings.fontFamily}
                      onChange={(e) =>
                        update(
                          "fontFamily",
                          e.target.value as FormSettings["fontFamily"],
                        )
                      }
                    >
                      <option value="system">{t("خط النظام")}</option>
                      <option value="serif">Serif</option>
                      <option value="theme">{t("خط الثيم")}</option>
                    </select>
                  </label>
                  <label>
                    {t("حجم الخط")}
                    <input
                      type="number"
                      min="12"
                      max="20"
                      value={settings.fontSize}
                      onChange={(e) =>
                        update("fontSize", Number(e.target.value))
                      }
                    />
                  </label>
                  {(
                    [
                      ["buttonColor", "لون الزر"],
                      ["background", "لون الخلفية"],
                      ["textColor", "لون النص"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {t(label)}
                      <input
                        type="color"
                        value={settings[key]}
                        onChange={(e) => update(key, e.target.value)}
                      />
                    </label>
                  ))}
                  <label>
                    {t("أعمدة المنطقة")}
                    <select
                      value={settings.columns}
                      onChange={(e) =>
                        update("columns", e.target.value as "one" | "two")
                      }
                    >
                      <option value="one">{t("عمود")}</option>
                      <option value="two">{t("عمودان")}</option>
                    </select>
                  </label>
                  <label className="embedded-check">
                    <input
                      type="checkbox"
                      checked={settings.compact}
                      onChange={(e) => update("compact", e.target.checked)}
                    />
                    {t("تصميم مدمج")}
                  </label>
                  <label>
                    {t("حدود النموذج")}
                    <select
                      value={settings.border}
                      onChange={(e) =>
                        update("border", e.target.value as "soft" | "plain")
                      }
                    >
                      <option value="soft">{t("حدود ناعمة")}</option>
                      <option value="plain">{t("بلا حدود")}</option>
                    </select>
                  </label>
                  <h2>{t("نصوص الحقول وملخص الأسعار")}</h2>
                  {Object.entries(settings.labels).map(([key, value]) => (
                    <label key={key}>
                      {key}
                      <input
                        maxLength={80}
                        value={value}
                        onChange={(e) =>
                          update("labels", {
                            ...settings.labels,
                            [key]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </>
              )}
            </fieldset>
          </section>
          <aside className="embedded-panel">
            <h2>{t("معاينة واجهة الزبون")}</h2>
            <p>
              {t(
                "المنتج والسعر والمتغيرات من Shopify. احفظ تغيير سياسة الحقول أو التوصيل قبل اختبار الحساب.",
              )}
            </p>
            <label>
              {t("منتج المعاينة")}
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {product ? (
              <EmbeddedPreview
                key={product.id}
                product={product}
                settings={settings}
                styleText={styleText}
                revision={revision}
              />
            ) : (
              <p>
                {t(
                  "لا توجد منتجات Shopify متزامنة للمعاينة. لا يُستخدم منتج افتراضي.",
                )}
              </p>
            )}
          </aside>
        </div>
      )}
      {!!baseline && section === "shipping" && (
        <ShippingDashboard onSaved={() => setRevision((n) => n + 1)} />
      )}
      {!!baseline && section === "integrations" && (
        <section className="embedded-panel">
          <h2>{t("اتصال Shopify والصلاحيات")}</h2>
          <button
            disabled={busy}
            type="button"
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setScopes(
                  z
                    .object({
                      readProductsGranted: z.boolean(),
                      writeOrdersGranted: z.boolean(),
                      offline: z.boolean(),
                    })
                    .parse(await read("integrations")),
                );
              } catch {
                setError(
                  "تعذر فحص الصلاحيات. تحقق من صلاحية Offline Token والاتصال.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("فحص صلاحيات Shopify")}
          </button>
          {scopes && (
            <dl>
              <dt>read_products</dt>
              <dd>{t(scopes.readProductsGranted ? "ممنوحة" : "غير ممنوحة")}</dd>
              <dt>write_orders</dt>
              <dd>{t(scopes.writeOrdersGranted ? "ممنوحة" : "غير ممنوحة")}</dd>
              <dt>Offline</dt>
              <dd>{t(scopes.offline ? "مؤكد" : "غير مؤكد")}</dd>
            </dl>
          )}
          <h2>{t("API والتتبع")}</h2>
          <p>
            {t(
              "لا يتم تفعيل أي إرسال إنتاجي من هذه الصفحة. إعدادات التكاملات القديمة محفوظة، ولا يوجد زر Purchase أو إرسال طلبات أو تجديد تفويض تلقائي.",
            )}
          </p>
        </section>
      )}
    </div>
  );
}
