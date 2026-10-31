"use client";
import { useLanguage } from "@/components/language-provider";
import { notifyCheckoutChanged } from "./checkout/live-updates";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpLeft,
  BarChart3,
  Boxes,
  Check,
  ChevronLeft,
  CircleHelp,
  ClipboardList,
  Eye,
  LayoutDashboard,
  Menu,
  Palette,
  Puzzle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Truck,
  MapPin,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductsDashboard } from "@/components/products/dashboard";
import { IntegrationsDashboard } from "@/components/checkout/integrations-dashboard";
import { FormBuilder } from "@/components/checkout/form-builder";
import { OrdersDashboard } from "@/components/orders/dashboard";
import { DiscountSettings } from "@/components/checkout/discount-settings";
import { ShippingDashboard } from "@/components/shipping/dashboard";
import { GeographySummary } from "@/components/geography-summary";
import { CustomerPreview } from "@/components/customer-preview";
const sections = [
  { title: "نظرة عامة", icon: LayoutDashboard },
  { title: "الطلبات", icon: ClipboardList },
  { title: "المنتجات", icon: Boxes },
  { title: "منشئ النموذج", icon: Palette },
  { title: "أسعار الشحن", icon: Truck },
  { title: "الولايات والبلديات", icon: MapPin },
  { title: "التحليلات", icon: BarChart3 },
  { title: "التكاملات", icon: Puzzle },
  { title: "الإعدادات", icon: Settings },
];
export function Workspace() {
  const { t } = useLanguage();
  const router = useRouter();
  const [localDemo, setLocalDemo] = useState(false);
  const [store, setStore] = useState("");
  const [storeName, setStoreName] = useState("");
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setLocalDemo(d.localDemo === true);
        setStore(d.merchantId ?? "");
        setStoreName(d.merchantName ?? "");
      })
      .catch(() => {});
  }, []);
  const [checkoutRefresh, setCheckoutRefresh] = useState(0);
  const [section, setSection] = useState("نظرة عامة");
  const [menu, setMenu] = useState(false);
  const [viewport, setViewport] = useState("desktop");
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4"
      >
        {t("انتقل إلى المحتوى")}
      </a>
      {menu && (
        <button
          type="button"
          aria-label={t("إغلاق القائمة")}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        aria-label={t("القائمة الرئيسية")}
        className={`${menu ? "flex" : "hidden"} fixed inset-y-0 right-0 z-40 w-64 flex-col border-l border-slate-200 bg-white p-5 lg:flex`}
      >
        <div className="flex items-center gap-3 py-3">
          <span className="rounded-xl bg-emerald-700 p-2.5 text-white">
            <ShoppingBag size={23} />
          </span>
          <div>
            <b dir="ltr" className="block text-base tracking-tight">
              DZ Lead Form <span className="text-emerald-700">Pro</span>
            </b>
            <span className="text-xs text-slate-500">
              {t("تجارة أقرب. طلبات أسهل.")}
            </span>
          </div>
          <button
            type="button"
            className="mr-auto lg:hidden"
            aria-label={t("إغلاق القائمة")}
            onClick={() => setMenu(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="my-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 font-bold text-emerald-800">
              {t("م")}
            </span>
            <div>
              <p className="text-sm font-bold">
                {t(storeName || "مساحة متجرك")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t("لوحة إدارة التاجر")}
              </p>
            </div>
          </div>
        </div>
        <p className="mb-3 px-3 text-xs text-slate-400">{t("مساحة العمل")}</p>
        <nav className="space-y-1">
          {sections.map(({ title, icon: Icon }) => (
            <button
              type="button"
              key={title}
              aria-current={section === title ? "page" : undefined}
              onClick={() => {
                setSection(title);
                setMenu(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${section === title ? "bg-emerald-50 font-bold text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon size={18} />
              {t(title)}{" "}
              {section === title && (
                <span className="mr-auto h-1.5 w-1.5 rounded-full bg-emerald-600" />
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <div className="rounded-xl bg-slate-50 p-4">
            <CircleHelp size={20} className="mb-2 text-emerald-700" />
            <p className="text-sm font-bold">{t("نبنيها خطوة بخطوة")}</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              {t(
                "راجع أسعار الشحن والمخزون قبل قبول الطلبات، وتابع التأكيد والتسليم من لوحة الطلبات.",
              )}
            </p>
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">
            {t("صُمّم للتجارة في الجزائر 🇩🇿")}
          </p>
        </div>
      </aside>
      <div className="lg:mr-64">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-9">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={t("فتح القائمة")}
              className="lg:hidden"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="text-sm text-slate-500">{t("مساحة العمل")}</span>
            <ChevronLeft size={14} className="text-slate-400" />
            <span className="text-sm font-semibold">{t(section)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {t("بيئة تطوير محلية")}
            </span>
            {!localDemo && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "logout" }),
                  });
                  router.push("/login");
                  router.refresh();
                }}
              >
                {t("تسجيل الخروج")}
              </Button>
            )}
            <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm font-bold">
              {t("م")}
            </span>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1500px] p-5 md:p-9">
          {store && (
            <p className="mb-4 break-all text-sm text-emerald-800">
              {t("رابط نموذج متجرك:")} {t(" ")}
              <a href={`/form?store=${store}`}>{t(`/form?store=${store}`)}</a>
            </p>
          )}
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-emerald-700">
                {t("بداية رحلتك نحو تجارة أفضل")}
              </p>
              <h1 className="text-2xl font-bold md:text-3xl">
                {t(
                  section === "نظرة عامة"
                    ? "مرحبًا بك في مساحة متجرك"
                    : section,
                )}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {t("كل ما تحتاجه لتجربة طلب سلسة، من مكان واحد.")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                document
                  .getElementById("preview")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <Eye size={16} />
              {t("معاينة نموذج الطلب")}
              <ArrowUpLeft size={15} />
            </Button>
          </div>
          <div
            role="note"
            className="mb-7 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
          >
            <ShieldCheck size={20} className="mt-0.5 shrink-0" />
            <p>
              <strong>{t("إدارة الدفع عند الاستلام")}</strong>
              <span className="block text-xs text-amber-900">
                {t(
                  "أضف منتجاتك وأسعار الشحن قبل مشاركة النموذج. تُحفظ الطلبات عند تأكيدها، وتحتاج تأكيد الاستلام والتسليم من لوحة الطلبات.",
                )}
              </span>
            </p>
          </div>
          {section === "نظرة عامة" ? (
            <OrdersDashboard analytics />
          ) : section === "المنتجات" ? (
            <ProductsDashboard
              onSaved={() => {
                setCheckoutRefresh((n) => n + 1);
                notifyCheckoutChanged();
              }}
            />
          ) : section === "الطلبات" ? (
            <OrdersDashboard />
          ) : section === "التحليلات" ? (
            <OrdersDashboard analytics />
          ) : section === "أسعار الشحن" ? (
            <ShippingDashboard
              onSaved={() => {
                setCheckoutRefresh((n) => n + 1);
                notifyCheckoutChanged();
              }}
            />
          ) : section === "التكاملات" ? (
            <IntegrationsDashboard />
          ) : section === "منشئ النموذج" ? (
            <FormBuilder
              onSaved={() => {
                setCheckoutRefresh((n) => n + 1);
                notifyCheckoutChanged();
              }}
            />
          ) : section === "الإعدادات" ? (
            <DiscountSettings
              onSaved={() => {
                setCheckoutRefresh((n) => n + 1);
                notifyCheckoutChanged();
              }}
            />
          ) : section === "الولايات والبلديات" ? (
            <GeographySummary />
          ) : (
            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-bold">
                {t(section)} {t("· قيد التطوير")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {t(
                  "هذه واجهة تنقل؛ وظائف هذا القسم في مراحل لاحقة. وظائف هذا القسم لم تُنفذ بعد. لا توجد بيانات محفوظة أو إجراءات تجارية مفعّلة.",
                )}
              </p>
            </section>
          )}
          <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_290px]">
            <section
              id="preview"
              className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <h2 className="font-bold">
                    {t("نموذج طلبك، كما يراه العميل")}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("تجربة عربية بسيطة ومناسبة للهاتف")}
                  </p>
                </div>
                <fieldset
                  aria-label={t("حجم المعاينة")}
                  className="flex rounded-lg bg-slate-100 p-1"
                >
                  {[
                    { id: "desktop", name: "حاسوب" },
                    { id: "mobile", name: "هاتف" },
                  ].map((v) => (
                    <button
                      type="button"
                      key={v.id}
                      aria-pressed={viewport === v.id}
                      onClick={() => setViewport(v.id)}
                      className={`rounded-md px-3 py-2 text-xs ${viewport === v.id ? "bg-white shadow-sm" : "text-slate-500"}`}
                    >
                      {t(v.name)}
                    </button>
                  ))}
                </fieldset>
              </div>
              <div className="bg-[#f4f7f6] p-4 md:p-7">
                <div
                  className={`mx-auto transition-[max-width] ${viewport === "mobile" ? "max-w-[375px]" : "max-w-[560px]"}`}
                >
                  <CustomerPreview refreshKey={checkoutRefresh} />
                </div>
              </div>
            </section>
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <span className="mb-4 inline-flex rounded-xl bg-emerald-50 p-3 text-emerald-700">
                  <Palette size={22} />
                </span>
                <h2 className="text-lg font-bold">{t("تجربة تحمل هويتك")}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {t("نموذج واضح، تفاصيل منظمة، وتصميم يضع راحة عميلك أولًا.")}
                </p>
                <div className="my-5 space-y-4">
                  {[
                    "واجهة عربية من اليمين إلى اليسار",
                    "تصميم متجاوب لكل الشاشات",
                    "عرض الأسعار بالدينار الجزائري",
                  ].map((text) => (
                    <p key={text} className="flex items-center gap-2 text-xs">
                      <Check size={15} className="text-emerald-600" />
                      {t(text)}
                    </p>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSection("منشئ النموذج")}
                >
                  {t("استكشاف منشئ النموذج")}
                  <ChevronLeft size={15} />
                </Button>
              </section>
              <section className="rounded-2xl bg-[#123e34] p-5 text-white">
                <p className="text-xs text-emerald-200">{t("خريطة التطوير")}</p>
                <h2 className="mt-3 text-lg font-bold">
                  {t("الأساس أولًا، ثم النمو")}
                </h2>
                <p className="mt-3 text-sm leading-7 text-emerald-50/80">
                  {t(
                    "تابع الطلب من الاستلام إلى التأكيد والتسليم. تقديم طلب دفع عند الاستلام لا يعني تحصيل قيمته.",
                  )}
                </p>
              </section>
            </div>
          </div>
          <footer className="mt-8 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
            <span>{t("دي زد ليد فورم برو · معاينة تطويرية")}</span>
            <span>{t("الدفع عند الاستلام، بتجربة أبسط")}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
