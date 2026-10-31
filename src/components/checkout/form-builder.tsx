"use client";
import { useLanguage } from "@/components/language-provider";
import { useEffect, useState } from "react";
import {
  formSettingsSchema,
  defaultFormSettings,
  type FormSettings,
} from "@/modules/forms/settings";
import { Button } from "../ui/button";
const fields = {
  variant: "خيار المنتج",
  name: "الاسم",
  phone: "الهاتف",
  geography: "الموقع",
  method: "طريقة التوصيل",
  address: "العنوان",
  quantity: "الكمية",
};
export function FormBuilder({ onSaved }: { onSaved: () => void }) {
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<FormSettings>(defaultFormSettings);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/form-config", { signal: abort.signal })
      .then((r) => r.json())
      .then((d) => {
        if (abort.signal.aborted) return;
        setSettings(formSettingsSchema.parse(d));
        setLoaded(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setMessage("تعذر تحميل الإعدادات.");
      });
    return () => abort.abort();
  }, []);
  async function save(value: FormSettings) {
    setMessage("");
    try {
      const r = await fetch("/api/form-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!r.ok) throw new Error();
      setSettings(value);
      setMessage(
        "تم حفظ تصميم النموذج. المعاينة أدناه تستخدم الإعدادات المحفوظة.",
      );
      onSaved();
    } catch {
      setMessage("تعذر حفظ التصميم.");
    }
  }
  return (
    <section className="mb-8 space-y-4 rounded-xl bg-white p-5">
      <fieldset disabled={!loaded} className="space-y-4">
        <h2 className="text-xl font-bold">{t("تخصيص نموذج الطلب")}</h2>
        {(
          [
            "title",
            "successMessage",
            "nameLabel",
            "phoneLabel",
            "addressLabel",
            "namePlaceholder",
            "phonePlaceholder",
            "addressPlaceholder",
          ] as const
        ).map((key) => (
          <label key={key}>
            {t(
              {
                title: "عنوان النموذج",
                successMessage: "رسالة النجاح",
                nameLabel: "تسمية الاسم",
                phoneLabel: "تسمية الهاتف",
                addressLabel: "تسمية العنوان",
                namePlaceholder: "تلميح الاسم",
                phonePlaceholder: "تلميح الهاتف",
                addressPlaceholder: "تلميح العنوان",
              }[key],
            )}
            <input
              value={settings[key]}
              maxLength={key === "successMessage" ? 200 : 100}
              onChange={(e) =>
                setSettings({ ...settings, [key]: e.target.value })
              }
            />
          </label>
        ))}
        <label>
          {t("لون الزر")}
          <input
            type="color"
            value={settings.buttonColor}
            onChange={(e) =>
              setSettings({ ...settings, buttonColor: e.target.value })
            }
          />
        </label>
        <label>
          {t("الخلفية")}
          <input
            type="color"
            value={settings.background}
            onChange={(e) =>
              setSettings({ ...settings, background: e.target.value })
            }
          />
        </label>
        <label>
          {t("الحدود")}
          <select
            value={settings.border}
            onChange={(e) =>
              setSettings({
                ...settings,
                border: e.target.value as "soft" | "plain",
              })
            }
          >
            <option value="soft">{t("ناعمة")}</option>
            <option value="plain">{t("بسيطة")}</option>
          </select>
        </label>
        <h3>{t("ترتيب الحقول")}</h3>
        {settings.order.map((field, index) => (
          <div key={field} className="flex items-center gap-3">
            <span>{t(fields[field])}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={index === 0}
              onClick={() => {
                const order = [...settings.order];
                [order[index - 1], order[index]] = [
                  order[index],
                  order[index - 1],
                ];
                setSettings({ ...settings, order });
              }}
            >
              {t("للأعلى")}
            </Button>
          </div>
        ))}
        <p className="text-xs leading-6">
          {t(
            "حقول تنفيذ الطلب إلزامية ولا يمكن إخفاؤها. يختفي عنوان المنزل تلقائيًا عند اختيار المكتب.",
          )}
        </p>
        <Button onClick={() => void save(settings)}>{t("حفظ النموذج")}</Button>
        <Button
          variant="outline"
          onClick={() => void save(defaultFormSettings)}
        >
          {t("استعادة التصميم الافتراضي")}
        </Button>
        {message && <p role="status">{t(message)}</p>}
      </fieldset>
    </section>
  );
}
