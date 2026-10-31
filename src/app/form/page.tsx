"use client";
import { useLanguage } from "@/components/language-provider";
import { CustomerPreview } from "@/components/customer-preview";
export default function FormPage() {
  const { t } = useLanguage();
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="mb-4 text-center text-sm leading-7 text-emerald-800">
        {t("دي زد ليد فورم برو · منتج تجريبي · التأكيد يحفظ طلبًا محليًا")}
      </p>
      <CustomerPreview />
    </main>
  );
}
