"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpLeft,
  BarChart3,
  Boxes,
  ClipboardList,
  ExternalLink,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Puzzle,
  Settings,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { useLanguage } from "./language-provider";
import { notifyCheckoutChanged } from "./checkout/live-updates";
import { ProductsDashboard } from "./products/dashboard";
import { IntegrationsDashboard } from "./checkout/integrations-dashboard";
import { FormBuilder } from "./checkout/form-builder";
import { OrdersDashboard } from "./orders/dashboard";
import { DiscountSettings } from "./checkout/discount-settings";
import { ShippingDashboard } from "./shipping/dashboard";
import { GeographySummary } from "./geography-summary";
import { CustomerPreview } from "./customer-preview";
import { Button } from "./ui/button";
const sections = [
  {
    title: "نظرة عامة",
    icon: LayoutDashboard,
    description: "ملخص أداء متجرك وأحدث الطلبات في مكان واحد.",
  },
  {
    title: "الطلبات",
    icon: ClipboardList,
    description: "راجع الطلبات وتابع تأكيدها وتجهيزها وتسليمها.",
  },
  {
    title: "المنتجات",
    icon: Boxes,
    description: "أدر منتجاتك وأسعارها وخياراتها ومخزونها.",
  },
  {
    title: "منشئ النموذج",
    icon: Palette,
    description: "صمّم نموذج طلب يناسب متجرك وعميلك.",
  },
  {
    title: "أسعار الشحن",
    icon: Truck,
    description: "أسعار منظمة لكل ولاية وبلدية، للمنزل والمكتب.",
  },
  {
    title: "التحليلات",
    icon: BarChart3,
    description: "أرقام واضحة تساعدك على متابعة نشاط متجرك.",
  },
  {
    title: "التكاملات",
    icon: Puzzle,
    description: "إعدادات الخدمات المتاحة لمتجرك.",
  },
  {
    title: "الإعدادات",
    icon: Settings,
    description: "خصومات المتجر والإعدادات الإضافية.",
  },
];
export function Workspace() {
  const { t } = useLanguage();
  const previewRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [localDemo, setLocalDemo] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [store, setStore] = useState("");
  const [storeName, setStoreName] = useState("");
  const [section, setSection] = useState("نظرة عامة");
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState(false);
  const [viewport, setViewport] = useState("mobile");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setLocalDemo(d.localDemo === true);
        setStore(d.merchantId ?? "");
        setStoreName(d.merchantName ?? "");
      })
      .catch(() => {})
      .finally(() => setInteractive(true));
  }, []);
  useEffect(() => {
    if (!preview && !menu) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreview(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [preview, menu]);
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement as HTMLElement | null;
    const selector =
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]';
    previewRef.current?.querySelector<HTMLElement>(selector)?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(
        previewRef.current?.querySelectorAll<HTMLElement>(selector) ?? [],
      );
      const first = items[0],
        last = items[items.length - 1];
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [preview]);
  const saved = () => {
    setRefresh((n) => n + 1);
    notifyCheckoutChanged();
  };
  const current = sections.find((s) => s.title === section)!;
  const formLink = store ? `/form?store=${store}` : "/form";
  return (
    <div className="merchant-app min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[80] focus:bg-white focus:p-3"
      >
        {t("انتقل إلى المحتوى")}
      </a>
      {menu && (
        <button
          type="button"
          aria-label={t("إغلاق القائمة")}
          className="fixed inset-0 top-14 z-30 bg-slate-900/35 backdrop-blur-sm lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        aria-label={t("القائمة الرئيسية")}
        className={`app-sidebar ${menu ? "is-open" : ""}`}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b5e4ca] text-[#12352c]">
            <ShoppingBag size={20} />
          </span>
          <div className="min-w-0">
            <b dir="ltr" className="block text-sm tracking-tight text-white">
              DZ Lead Form <span className="text-[#b5e4ca]">Pro</span>
            </b>
            <span className="text-[11px] text-slate-400">
              {t("لوحة إدارة التاجر")}
            </span>
          </div>
          <button
            type="button"
            className="ms-auto text-white lg:hidden"
            aria-label={t("إغلاق القائمة")}
            onClick={() => setMenu(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-3 my-4 flex items-center gap-2.5 rounded-xl bg-white/5 p-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sm font-bold text-white">
            {(storeName || "DZ").slice(0, 1)}
          </span>
          <p className="min-w-0 truncate text-xs font-semibold text-slate-200">
            {t(storeName || "مساحة متجرك")}
          </p>
        </div>
        <nav className="space-y-1 px-3">
          {sections.map(({ title, icon: Icon }) => (
            <button
              type="button"
              key={title}
              aria-current={section === title ? "page" : undefined}
              onClick={() => {
                setSection(title);
                setMenu(false);
              }}
              disabled={!interactive}
              className={`sidebar-item ${section === title ? "active" : ""}`}
            >
              <Icon size={18} />
              <span>{t(title)}</span>
              {section === title && (
                <span className="ms-auto h-1.5 w-1.5 rounded-full bg-[#b5e4ca]" />
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <a
            href={formLink}
            className="flex items-center justify-between rounded-lg px-2 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            <span>{t("فتح نموذج الطلب")}</span>
            <ExternalLink size={14} />
          </a>
          {!localDemo && (
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-2 px-2 py-2 text-xs text-slate-400"
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
              <LogOut size={14} />
              {t("تسجيل الخروج")}
            </button>
          )}
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!interactive}
              aria-label={t("فتح القائمة")}
              className="rounded-lg border border-slate-200 p-2 lg:hidden"
              onClick={() => setMenu(true)}
            >
              <Menu size={19} />
            </button>
            <span className="text-xs text-slate-400">DZ /</span>
            <span className="text-sm font-semibold">{t(section)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">
              {t(storeName || "مساحة متجرك")}
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
              {(storeName || "DZ").slice(0, 1)}
            </span>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1320px] p-4 md:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#202223]">
                {t(section)}
              </h1>
              <p className="mt-2 max-w-xl text-xs leading-6 text-slate-500">
                {t(current.description)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!interactive}
                onClick={() => setPreview(true)}
              >
                <Eye size={15} />
                {t("معاينة نموذج الطلب")}
              </Button>
              {store && (
                <Button asChild size="sm">
                  <a href={formLink}>
                    {t("فتح النموذج")}
                    <ArrowUpLeft size={14} />
                  </a>
                </Button>
              )}
            </div>
          </div>
          {section === "نظرة عامة" && (
            <>
              <OrdersDashboard analytics />
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "إضافة منتج",
                    text: "أضف منتجاتك وصورها وأسعارها.",
                    target: "المنتجات",
                    icon: Boxes,
                  },
                  {
                    title: "تخصيص النموذج",
                    text: "اختر الحقول والألوان التي تناسب متجرك.",
                    target: "منشئ النموذج",
                    icon: Palette,
                  },
                  {
                    title: "ضبط أسعار التوصيل",
                    text: "حدد أسعار المنزل والمكتب لكل مناطقك.",
                    target: "أسعار الشحن",
                    icon: Truck,
                  },
                ].map(({ title, text, target, icon: Icon }) => (
                  <button
                    type="button"
                    key={target}
                    onClick={() => setSection(target)}
                    disabled={!interactive}
                    className="quick-action"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
                      <Icon size={20} />
                    </span>
                    <span className="text-start">
                      <b className="block text-sm">{t(title)}</b>
                      <span className="mt-1.5 block text-xs leading-5 text-slate-500">
                        {t(text)}
                      </span>
                    </span>
                    <ArrowUpLeft
                      size={16}
                      className="ms-auto shrink-0 text-slate-400"
                    />
                  </button>
                ))}
              </div>
            </>
          )}
          {section === "الطلبات" && <OrdersDashboard />}
          {section === "التحليلات" && <OrdersDashboard analytics />}
          {section === "المنتجات" && <ProductsDashboard onSaved={saved} />}
          {section === "منشئ النموذج" && <FormBuilder onSaved={saved} />}
          {section === "أسعار الشحن" && <ShippingDashboard onSaved={saved} />}
          {section === "التكاملات" && <IntegrationsDashboard />}
          {section === "الإعدادات" && (
            <>
              <DiscountSettings onSaved={saved} />
              <details className="rounded-xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold">
                  {t("مرجع الولايات والبلديات")}
                </summary>
                <p className="my-3 text-xs leading-6 text-slate-500">
                  {t(
                    "تستخدم هذه البيانات لربط عنوان العميل بسعر الشحن. لا تحتاج تعديلها لإدارة أسعار التوصيل.",
                  )}
                </p>
                <GeographySummary />
              </details>
            </>
          )}
        </main>
      </div>
      {preview && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-slate-900/40 backdrop-blur-sm"
          ref={previewRef}
          role="dialog"
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreview(false);
          }}
          aria-modal="true"
          aria-label={t("معاينة نموذج الطلب")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreview(false);
          }}
        >
          <div className="mx-auto my-4 flex max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#f1f3f3]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white p-3">
              <span className="text-sm font-semibold">
                {t("معاينة نموذج الطلب")}
              </span>
              <fieldset
                className="viewport-switch"
                aria-label={t("حجم المعاينة")}
              >
                {[
                  { id: "mobile", name: "هاتف" },
                  { id: "desktop", name: "حاسوب" },
                ].map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    aria-pressed={viewport === v.id}
                    onClick={() => setViewport(v.id)}
                  >
                    {t(v.name)}
                  </button>
                ))}
              </fieldset>
              <button
                type="button"
                aria-label={t("إغلاق المعاينة")}
                onClick={() => setPreview(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <div
                className={`mx-auto ${viewport === "mobile" ? "max-w-[360px]" : "max-w-[520px]"}`}
              >
                <CustomerPreview refreshKey={refresh} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
