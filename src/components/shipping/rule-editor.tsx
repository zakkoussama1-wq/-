"use client";
import { useLanguage } from "@/components/language-provider";
import type { ShippingRule } from "@/modules/shipping/schema";
export function RuleEditor({
  rule,
  onChange,
}: {
  rule: ShippingRule;
  onChange: (rule: ShippingRule) => void;
}) {
  const { t } = useLanguage();
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 font-bold">{t("تفاصيل قاعدة الشحن")}</legend>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="!w-4"
          checked={rule.available}
          onChange={(e) => onChange({ ...rule, available: e.target.checked })}
        />
        {t("المنطقة متاحة للتوصيل")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { id: "home", name: "المنزل" },
            { id: "office", name: "المكتب" },
          ] as const
        ).map((method) => (
          <div key={method.id} className="rounded-lg bg-slate-50 p-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="!w-4"
                checked={rule[method.id].enabled}
                onChange={(e) =>
                  onChange({
                    ...rule,
                    [method.id]: {
                      ...rule[method.id],
                      enabled: e.target.checked,
                    },
                  })
                }
              />
              {t("تفعيل توصيل")} {t(method.name)}
            </label>
            <label htmlFor={`rate-${method.id}`}>
              {t("سعر")} {t(method.name)} {t("بالدينار")}
            </label>
            <input
              id={`rate-${method.id}`}
              type="number"
              min="0"
              max="10000000"
              step="0.01"
              inputMode="decimal"
              value={rule[method.id].price ?? ""}
              onChange={(e) =>
                onChange({
                  ...rule,
                  [method.id]: {
                    ...rule[method.id],
                    price:
                      e.target.value === "" ? null : Number(e.target.value),
                  },
                })
              }
            />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="shipping-eta">{t("المدة التقديرية (اختياري)")}</label>
        <input
          id="shipping-eta"
          maxLength={100}
          value={rule.eta}
          onChange={(e) => onChange({ ...rule, eta: e.target.value })}
        />
      </div>
      <p className="text-xs leading-6 text-slate-500">
        {t(
          "الصفر يعني توصيلًا مجانيًا. تعطيل المنطقة أو الطريقة يمنع التوصيل، ولا يستبدله السعر الافتراضي. تفعيل المكتب يتطلب أيضًا تمكين وضع المكتب العام.",
        )}
      </p>
    </fieldset>
  );
}
