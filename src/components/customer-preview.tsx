"use client";
import { useLanguage } from "@/components/language-provider";
import { storefrontUrl } from "@/modules/checkout/storefront-url";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, ShieldCheck, Truck, Package, Check } from "lucide-react";
import { OrderedFields } from "./checkout/ordered-fields";
import { GeographyFields } from "./geography-fields";
import { Button } from "./ui/button";
import { useCheckoutCatalog, useCheckoutQuote } from "./checkout/use-checkout";
import {
  checkoutInputSchema,
  pricingInputSchema,
  type CheckoutValues,
  type ValidatedCheckout,
  type CheckoutCatalog,
} from "@/modules/checkout/schema";
import { amounts } from "@/modules/checkout/money";
import {
  defaultFormSettings,
  formSettingsSchema,
} from "@/modules/forms/settings";
import { formatDzd } from "@/lib/i18n";
export function CustomerPreview({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useLanguage();
  const catalog = useCheckoutCatalog(refreshKey);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-center gap-2 border-b border-slate-100 py-3 text-xs text-emerald-800">
        <ShieldCheck size={14} />
        {t("الدفع عند الاستلام · طلب محفوظ عند التأكيد")}
      </div>
      {catalog.error && (
        <div
          role="alert"
          className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          <p>{t(catalog.error)}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={catalog.retry}
          >
            {t("إعادة تحميل المنتج")}
          </Button>
        </div>
      )}{" "}
      {!catalog.catalog ? (
        catalog.loading && (
          <p role="status" className="p-5">
            {t("جارٍ تحميل المنتج…")}
          </p>
        )
      ) : (
        <CheckoutForm
          catalog={catalog.catalog}
          catalogBlocked={catalog.loading || !!catalog.error}
          refreshKey={refreshKey}
        />
      )}
    </div>
  );
}
function CheckoutForm({
  catalog,
  catalogBlocked,
  refreshKey,
}: {
  catalog: CheckoutCatalog;
  catalogBlocked: boolean;
  refreshKey: number;
}) {
  const { t } = useLanguage();
  const [design, setDesign] = useState(defaultFormSettings);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit revision/retry triggers must refresh remote settings.
  useEffect(() => {
    const abort = new AbortController();
    fetch(storefrontUrl("/api/form-config"), { signal: abort.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!abort.signal.aborted) setDesign(formSettingsSchema.parse(d));
      })
      .catch(() => {});
    return () => abort.abort();
  }, [refreshKey]);
  const position = (key: (typeof design.order)[number]) => ({
    order: design.order.indexOf(key),
  });
  const first = catalog.products[0];
  const [receipt, setReceipt] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const submitting = useRef(false);
  const attempt = useRef<{
    key: string;
    id: string;
  } | null>(null);
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues, unknown, ValidatedCheckout>({
    resolver: zodResolver(checkoutInputSchema),
    defaultValues: {
      productId: first?.id ?? "",
      variantId: first?.variants[0]?.id ?? "",
      quantity: 1,
      name: "",
      phone: "",
      mode: "legacy58",
      wilayaCode: "",
      communeId: "",
      method: "home",
      address: "",
    },
  });
  const values = useWatch({ control }) as CheckoutValues;
  const product = catalog.products.find((p) => p.id === values.productId);
  const variant = product?.variants.find((v) => v.id === values.variantId);
  const parsed = pricingInputSchema.safeParse({
    productId: values.productId,
    variantId: values.variantId,
    quantity: values.quantity,
    mode: values.mode,
    wilayaCode: values.wilayaCode,
    communeId: values.communeId,
  });
  const pricing = useCheckoutQuote(
    parsed.success ? parsed.data : null,
    refreshKey,
  );
  const provisional = variant
    ? amounts(variant.priceMinor, values.quantity, catalog.discount)
    : null;
  const figures =
    pricing.ready && pricing.quote
      ? {
          subtotalMinor: pricing.quote.subtotalMinor,
          discountMinor: pricing.quote.discountMinor,
          netMinor: pricing.quote.subtotalMinor - pricing.quote.discountMinor,
        }
      : provisional;
  const shownUnitMinor =
    pricing.ready && pricing.quote
      ? pricing.quote.unitPriceMinor
      : variant?.priceMinor;
  const selected = pricing.quote?.methods[values.method];
  const total =
    figures && selected?.available && selected.amountMinor !== null
      ? figures.netMinor + selected.amountMinor
      : null;
  const formKey = JSON.stringify([
    values,
    catalog.revision,
    refreshKey,
    pricing.quote?.quoteToken,
  ]);
  const success = receipt?.key === formKey ? receipt.message : "";
  const canSubmit =
    pricing.ready && !!selected?.available && !catalogBlocked && !!variant;
  async function confirm(customer: ValidatedCheckout) {
    if (submitting.current) return;
    setSubmitError("");
    setReceipt(null);
    if (!canSubmit || !pricing.quote) {
      setSubmitError("انتظر حساب السعر واختر طريقة توصيل متاحة.");
      return;
    }
    submitting.current = true;
    try {
      const payloadKey = JSON.stringify(customer);
      if (attempt.current?.key !== payloadKey)
        attempt.current = { key: payloadKey, id: crypto.randomUUID() };
      const response = await fetch(storefrontUrl("/api/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.current!.id,
        },
        body: JSON.stringify({
          customer,
          quoteToken: pricing.quote.quoteToken,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 || response.status === 422) pricing.retry();
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "تعذر التحقق من الطلب.",
        );
      }
      if (result.persisted !== true || typeof result.orderId !== "string")
        throw new Error("استجابة تحقق غير متوقعة.");
      setReceipt({ key: formKey, message: result.message });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "تعذر التحقق من الطلب. أعد المحاولة.",
      );
    } finally {
      submitting.current = false;
    }
  }
  if (!product || !variant || !figures)
    return (
      <p role="alert" className="p-5 text-red-700">
        {t("المنتج أو الخيار المختار غير متاح. أعد تحميل الصفحة.")}
      </p>
    );
  return (
    <div
      className="p-5 md:p-6"
      style={{
        background: design.background,
        border: design.border === "plain" ? "1px solid #cbd5e1" : undefined,
      }}
    >
      <div className="mb-6 flex items-center gap-5">
        {product.imageUrl ? (
          <Image
            unoptimized
            src={product.imageUrl}
            alt={t(product.name)}
            width={128}
            height={128}
            referrerPolicy="no-referrer"
            className="h-32 w-32 shrink-0 rounded-xl object-cover"
          />
        ) : product.demo ? (
          <div
            role="img"
            aria-label={t("رسم توضيحي لحقيبة تجريبية")}
            className="bag-art grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-xl"
          >
            <div
              className="bag scale-75"
              style={
                variant.id === "black"
                  ? { backgroundColor: "#303938" }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="grid h-32 w-32 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs text-slate-500">
            {t("لا توجد صورة")}
          </div>
        )}
        <div>
          {product.demo && (
            <span className="text-[10px] font-bold text-emerald-700">
              {t("منتج تجريبي · ليس مخزونًا تجاريًا")}
            </span>
          )}
          <h3 className="mt-2 text-lg font-bold">{t(product.name)}</h3>
          <p className="mt-2 text-xs text-slate-500">{t(variant.name)}</p>
          <p
            data-testid="unit-price"
            className="mt-3 text-lg font-bold text-emerald-800"
          >
            {t(formatDzd(shownUnitMinor! / 100))}
          </p>
        </div>
      </div>
      <h3 className="text-xl font-bold">{t(design.title)}</h3>
      <p className="mb-6 mt-2 text-xs leading-6 text-slate-500">
        {t("يُحفظ طلبك بعد التحقق من السعر وتوفر المنتج. الدفع عند الاستلام.")}
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(confirm)(event);
        }}
        className="space-y-5"
        aria-busy={isSubmitting}
      >
        <label htmlFor="checkout-product">{t("المنتج المطلوب")}</label>
        <select
          id="checkout-product"
          value={values.productId}
          disabled={isSubmitting}
          onChange={(e) => {
            const next = catalog.products.find((p) => p.id === e.target.value)!;
            setValue("productId", next.id);
            setValue("variantId", next.variants[0].id);
          }}
        >
          {catalog.products
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.name)} {t(p.demo ? " · تجريبي" : "")}
              </option>
            ))}
        </select>
        <OrderedFields disabled={isSubmitting}>
          <div style={position("variant")}>
            <label htmlFor="product-variant">{t("خيار المنتج")}</label>
            <select id="product-variant" {...register("variantId")}>
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {t(v.name)}
                </option>
              ))}
            </select>
          </div>
          <div style={position("name")}>
            <label htmlFor="customer-name">
              {t(design.nameLabel)} <span className="text-rose-600">*</span>
            </label>
            <input
              id="customer-name"
              autoComplete="name"
              maxLength={100}
              placeholder={t(design.namePlaceholder)}
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" role="alert" className="field-error">
                {t(errors.name.message)}
              </p>
            )}
          </div>
          <div style={position("phone")}>
            <label htmlFor="phone">
              {t(design.phoneLabel)} <span className="text-rose-600">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              dir="ltr"
              className="text-right"
              autoComplete="tel-national"
              inputMode="tel"
              maxLength={40}
              placeholder={t(design.phonePlaceholder)}
              aria-required="true"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              {...register("phone")}
            />
            {errors.phone && (
              <p id="phone-error" role="alert" className="field-error">
                {t(errors.phone.message)}
              </p>
            )}
          </div>
          <div style={position("geography")}>
            <GeographyFields
              value={{
                mode: values.mode,
                wilayaCode: values.wilayaCode,
                communeId: values.communeId,
              }}
              onChange={(next) => {
                setValue("mode", next.mode, { shouldDirty: true });
                setValue("wilayaCode", next.wilayaCode, {
                  shouldDirty: true,
                  shouldValidate: !!errors.wilayaCode,
                });
                setValue("communeId", next.communeId, {
                  shouldDirty: true,
                  shouldValidate: !!errors.communeId,
                });
              }}
              errors={{
                wilayaCode: errors.wilayaCode?.message,
                communeId: errors.communeId?.message,
              }}
            />
          </div>
          <fieldset style={position("method")}>
            <legend className="mb-2 text-sm font-semibold">
              {t("طريقة التوصيل")}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: "home", title: "التوصيل إلى المنزل", icon: Truck },
                  { id: "office", title: "التوصيل إلى المكتب", icon: Package },
                ] as const
              ).map(({ id, title, icon: Icon }) => {
                const option = pricing.quote?.methods[id];
                return (
                  <label
                    key={id}
                    className={`!mb-0 flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${values.method === id ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-200"} ${!option?.available ? "opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      className="!w-3 accent-emerald-700"
                      value={id}
                      disabled={!option?.available || catalogBlocked}
                      checked={values.method === id}
                      onChange={() => {
                        setValue("method", id, { shouldDirty: true });
                        if (id === "office") setValue("address", "");
                      }}
                    />
                    <Icon size={16} />
                    <span className="text-xs leading-6">
                      {t(title)}
                      <span className="block font-normal">
                        {t(
                          option?.available
                            ? formatDzd(option.amountMinor! / 100)
                            : "غير متاح",
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2 space-y-1 text-xs leading-6 text-slate-500">
              {pricing.quote && !pricing.quote.methods.home.available && (
                <p>
                  {t("المنزل:")} {t(pricing.quote.methods.home.reason)}
                </p>
              )}{" "}
              {pricing.quote && !pricing.quote.methods.office.available && (
                <p>
                  {t("المكتب:")} {t(pricing.quote.methods.office.reason)}
                </p>
              )}
            </div>
          </fieldset>
          {values.method === "home" ? (
            <div style={position("address")}>
              <label htmlFor="address">
                {t(design.addressLabel)}{" "}
                <span className="text-rose-600">*</span>
              </label>
              <input
                id="address"
                autoComplete="street-address"
                maxLength={250}
                placeholder={t(design.addressPlaceholder)}
                aria-required="true"
                aria-invalid={!!errors.address}
                aria-describedby={errors.address ? "address-error" : undefined}
                {...register("address")}
              />
              {errors.address && (
                <p id="address-error" role="alert" className="field-error">
                  {t(errors.address.message)}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
              {t(
                "التوصيل إلى المكتب العام مفعّل حسب إعدادات التاجر. لا توجد قائمة مكاتب استلام مسماة، ولا يُطلب عنوان منزل.",
              )}
            </p>
          )}
          <div
            className="flex items-center justify-between"
            style={position("quantity")}
          >
            <label htmlFor="quantity" className="!mb-0">
              {t("الكمية")}
            </label>
            <div className="flex items-center rounded-lg border border-slate-200">
              <button
                type="button"
                className="p-3 disabled:opacity-30"
                aria-label={t("تقليل الكمية")}
                disabled={values.quantity <= 1}
                onClick={() => setValue("quantity", values.quantity - 1)}
              >
                <Minus size={14} />
              </button>
              <input
                id="quantity"
                readOnly
                className="!w-10 !border-0 !p-0 text-center"
                value={values.quantity}
              />
              <button
                type="button"
                className="p-3 disabled:opacity-30"
                aria-label={t("زيادة الكمية")}
                disabled={values.quantity >= 10}
                onClick={() => setValue("quantity", values.quantity + 1)}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </OrderedFields>
        <div
          aria-live="polite"
          className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm"
        >
          <div className="flex justify-between text-slate-600">
            <span>{t("مجموع المنتجات")}</span>
            <span data-testid="subtotal">
              {t(formatDzd(figures.subtotalMinor / 100))}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>{t("خصم التاجر على المنتجات")}</span>
            <span data-testid="discount">
              {t(formatDzd(figures.discountMinor / 100))}
            </span>
          </div>
          <div className="flex justify-between gap-2 text-slate-500">
            <span>{t("التوصيل")}</span>
            <span data-testid="delivery-price" className="text-xs">
              {t(
                selected?.available
                  ? formatDzd(selected.amountMinor! / 100)
                  : values.communeId
                    ? "غير متاح"
                    : "اختر الولاية والبلدية",
              )}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 font-bold">
            <span>{t("الإجمالي النهائي")}</span>
            <span data-testid="final-total">
              {t(total !== null ? formatDzd(total / 100) : "غير متاح")}
            </span>
          </div>
          {selected?.eta && (
            <p className="text-xs text-slate-500">
              {t("المدة التقديرية:")} {t(selected.eta)}
            </p>
          )}{" "}
          {pricing.loading && (
            <p role="status" className="text-xs text-emerald-700">
              {t("جارٍ تحديث السعر من الخادم…")}
            </p>
          )}
        </div>
        {pricing.error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm leading-7 text-red-800"
          >
            <p>{t(pricing.error)}</p>
            <Button type="button" variant="outline" onClick={pricing.retry}>
              {t("إعادة حساب السعر")}
            </Button>
          </div>
        )}{" "}
        {!values.communeId && (
          <p className="text-xs leading-6 text-slate-500">
            {t("اختر الولاية والبلدية لحساب الشحن وإتاحة التأكيد.")}
          </p>
        )}
        <Button
          type="submit"
          style={{ backgroundColor: design.buttonColor }}
          className="w-full"
          disabled={isSubmitting || !canSubmit || !!success}
        >
          <Check size={17} />
          {t(isSubmitting ? "جارٍ التحقق على الخادم…" : "تأكيد الطلب وحفظه")}
        </Button>
        {submitError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800"
          >
            {t(submitError)}
          </p>
        )}{" "}
        {success && (
          <p
            role="status"
            data-testid="checkout-success"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900"
          >
            {t(design.successMessage)} {t(success)}
          </p>
        )}
        <p className="text-center text-[11px] leading-6 text-slate-500">
          {t(
            "لا تُحصَّل دفعة عند الإرسال. تُستخدم بياناتك لمعالجة الطلب والتوصيل.",
          )}
        </p>
      </form>
    </div>
  );
}
