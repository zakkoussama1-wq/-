"use client";
import { useLanguage } from "@/components/language-provider";
import audit from "../../data/geography/audit.json";
export function GeographySummary() {
  const { t, language } = useLanguage();
  return (
    <section className="geography-reference">
      <h2 className="settings-heading">{t("سجل البيانات الجغرافية")}</h2>
      <dl className="geography-counts">
        {[
          { label: "ولايات النظام الافتراضي", value: audit.legacyWilayas },
          { label: "ولايات النظام المحدّث", value: audit.updatedWilayas },
          { label: "البلديات في كل نظام", value: audit.communes },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-xs leading-6 text-slate-500">
              {t(item.label)}
            </dt>
            <dd className="mt-2 text-xl font-bold text-[var(--ds-accent)]">
              {new Intl.NumberFormat(
                { ar: "ar-DZ", fr: "fr-DZ", en: "en-DZ" }[language],
              ).format(item.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-7 text-slate-600">
        {t(
          "تُحمّل القوائم من قاعدة بيانات محلية. تم فحص الأعداد والمعرّفات وعلاقات الآباء، ومراجعة قوائم نقل ١٠٨ بلديات. المعرّفات الداخلية ثابتة بين النظامين وليست رموزًا رسمية للبلديات.",
        )}
      </p>
      <p
        role="note"
        className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-950"
      >
        {t(
          "المصدران مفتوحان بترخيص MIT. خريطة ٦٩ ولاية مصالَحة مع نص قانون منقول في المرجع الثاني، بعد رصد اختلافات في المصدر الأول. المطابقة المباشرة مع ملف الجريدة الرسمية معلّقة بسبب الوصول الشبكي. يمكن حفظ الطلبات الوهمية للتجربة المحلية.",
        )}
      </p>
    </section>
  );
}
