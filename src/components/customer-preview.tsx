"use client";
import { useLanguage } from "@/components/language-provider";
import { storefrontUrl } from "@/modules/checkout/storefront-url";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, ShieldCheck, Truck, Package, Check } from "lucide-react";
import { useCheckoutUpdates } from "./checkout/live-updates";
import { OrderedFields } from "./checkout/ordered-fields";
import { GeographyFields } from "./geography-fields";
import { Button } from "./ui/button";
import { useCheckoutCatalog, useCheckoutQuote } from "./checkout/use-checkout";
import {
  checkoutSchemaForSettings,
  pricingInputSchema,
  type CheckoutValues,
  type ValidatedCheckout,
  type CheckoutCatalog,
} from "@/modules/checkout/schema";
import { amounts } from "@/modules/checkout/money";
import {
  formSettingsSchema,
  buttonForeground,
  type FormSettings,
} from "@/modules/forms/settings";
import { formatDzd } from "@/lib/i18n";
export function CustomerPreview({
  refreshKey = 0,
  settings,
  previewOnly = false,
}: {
  refreshKey?: number;
  settings?: FormSettings;
  previewOnly?: boolean;
}) {
  const { t } = useLanguage();
  const updates = useCheckoutUpdates();
  const catalog = useCheckoutCatalog(refreshKey);
  const [savedDesign, setDesign] = useState<FormSettings | null>(null);
  const [designError, setDesignError] = useState(false);
  const [designRetry, setDesignRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Saved revisions and cross-tab notifications must reload form settings.
  useEffect(() => {
    if (settings) return;
    const abort = new AbortController();
    fetch(storefrontUrl("/api/form-config"), { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const next = formSettingsSchema.parse(await r.json());
        if (!abort.signal.aborted) {
          setDesign(next);
          setDesignError(false);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setDesignError(true);
      });
    return () => abort.abort();
  }, [refreshKey, updates, settings, designRetry]);
  const design = settings ?? savedDesign;
  return (
    <div
      data-testid="lead-form"
      style={
        design
          ? {
              borderRadius: design.border === "plain" ? 8 : 16,
              boxShadow: design.border === "plain" ? "none" : undefined,
            }
          : undefined
      }
      className="lead-form overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
    >
      {(catalog.error || designError) && (
        <div
          role="alert"
          className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          <p>{t(catalog.error || "تعذر تحميل الإعدادات.")}</p>
          <Button
            variant="outline"
            onClick={() => {
              catalog.retry();
              setDesignRetry((value) => value + 1);
            }}
          >
            {t("إعادة تحميل المنتج")}
          </Button>
        </div>
      )}
      {!catalog.catalog || !design ? (
        <p role="status" className="p-5">
          {t("جارٍ تحميل المنتج…")}
        </p>
      ) : (
        <CheckoutForm
          catalog={catalog.catalog}
          catalogBlocked={catalog.loading || !!catalog.error || designError}
          refreshKey={refreshKey}
          design={design}
          previewOnly={previewOnly}
        />
      )}
    </div>
  );
}
function CheckoutForm({
  catalog,
  catalogBlocked,
  refreshKey,
  design,
  previewOnly,
}: {
  catalog: CheckoutCatalog;
  catalogBlocked: boolean;
  refreshKey: number;
  design: FormSettings;
  previewOnly: boolean;
}) {
  const { t } = useLanguage();
  const [deliveryChosen, setDeliveryChosen] = useState(false);
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
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues, unknown, ValidatedCheckout>({
    resolver: zodResolver(checkoutSchemaForSettings(design.contact)),
    defaultValues: {
      productId: first?.id ?? "",
      variantId: first?.variants[0]?.id ?? "",
      quantity: 1,
      name: "",
      phone: "",
      mode: design.administrativeMode,
      wilayaCode: design.elements.geography ? "" : design.fixedWilaya,
      communeId: design.elements.geography ? "" : design.fixedCommune,
      method: "home",
      address: "",
    },
  });
  useEffect(() => {
    const method =
      design.deliveryMode === "both"
        ? design.defaultMethod
        : design.deliveryMode;
    if (method !== "none") {
      setValue("method", method);
      setDeliveryChosen(true);
    } else setDeliveryChosen(false);
  }, [design.deliveryMode, design.defaultMethod, setValue]);
  useEffect(() => {
    for (const key of ["name", "phone", "address"] as const)
      if (design.contact[key] === "hidden") setValue(key, "");
  }, [design.contact, setValue]);
  useEffect(() => {
    if (!design.elements.quantity) setValue("quantity", 1);
  }, [design.elements.quantity, setValue]);
  useEffect(() => {
    setValue("mode", design.administrativeMode);
    setValue("wilayaCode", design.elements.geography ? "" : design.fixedWilaya);
    setValue("communeId", design.elements.geography ? "" : design.fixedCommune);
  }, [
    design.elements.geography,
    design.administrativeMode,
    design.fixedWilaya,
    design.fixedCommune,
    setValue,
  ]);
  useEffect(() => {
    const featured =
      catalog.products.find((p) => p.id === design.featuredProductId) ||
      catalog.products.find((p) => p.id === getValues("productId")) ||
      catalog.products[0];
    if (!featured) return;
    const variant =
      featured.variants.find(
        (v) => v.id === (design.featuredVariantId || getValues("variantId")),
      ) ?? featured.variants[0];
    setValue("productId", featured.id);
    setValue("variantId", variant.id);
  }, [
    design.featuredProductId,
    design.featuredVariantId,
    catalog.products,
    setValue,
    getValues,
  ]);
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
  const selected = deliveryChosen
    ? pricing.quote?.methods[values.method]
    : undefined;
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
    deliveryChosen &&
    pricing.ready &&
    !!selected?.available &&
    !catalogBlocked &&
    !!variant;
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
  if (
    !product ||
    !variant ||
    !figures ||
    (design.featuredProductId &&
      !catalog.products.some((p) => p.id === design.featuredProductId))
  )
    return (
      <p role="alert" className="p-5 text-red-700">
        {t("المنتج أو الخيار المختار غير متاح. أعد تحميل الصفحة.")}
      </p>
    );
  const elements = design.elements;
  const contactField = (key: "name" | "phone" | "address") => {
    if (
      design.contact[key] === "hidden" ||
      (key === "address" && (!deliveryChosen || values.method !== "home"))
    )
      return null;
    const label = design[`${key}Label`];
    const placeholder = design[`${key}Placeholder`];
    const id = key === "name" ? "customer-name" : key;
    return (
      <div
        key={key}
        className={
          key === "address"
            ? "col-span-2"
            : `contact-cell ${(key === "name" && design.contact.phone === "hidden") || (key === "phone" && design.contact.name === "hidden") ? "col-span-2" : ""}`
        }
        style={position(key)}
      >
        <label htmlFor={id}>
          {t(label)}
          {design.contact[key] === "required" && (
            <span className="ms-1 text-red-500">*</span>
          )}
        </label>
        <input
          id={id}
          type={key === "phone" ? "tel" : "text"}
          dir={key === "phone" ? "ltr" : undefined}
          autoComplete={
            key === "name"
              ? "name"
              : key === "phone"
                ? "tel-national"
                : "street-address"
          }
          inputMode={key === "phone" ? "tel" : undefined}
          maxLength={key === "address" ? 250 : key === "phone" ? 40 : 100}
          placeholder={t(placeholder)}
          aria-required={design.contact[key] === "required"}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
          {...register(key)}
        />
        {errors[key] && (
          <p id={`${key}-error`} role="alert" className="field-error">
            {t(errors[key]?.message)}
          </p>
        )}
      </div>
    );
  };
  return (
    <div
      className={`lead-body ${design.compact ? "is-compact" : ""}`}
      style={
        {
          background: design.background,
          color: design.textColor,
          "--lead-accent": design.buttonColor,
        } as React.CSSProperties
      }
    >
      {elements.badge && (
        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium text-emerald-700">
          <ShieldCheck size={14} />
          {t(design.badgeText)}
        </div>
      )}
      {(elements.productImage ||
        elements.productTitle ||
        elements.productPrice) && (
        <div className="lead-product mb-4 flex items-center gap-3">
          {elements.productImage &&
            (product.imageUrl ? (
              <Image
                unoptimized
                src={product.imageUrl}
                alt={t(product.name)}
                width={72}
                height={72}
                referrerPolicy="no-referrer"
                className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover"
              />
            ) : product.demo ? (
              <div
                role="img"
                aria-label={t("رسم توضيحي لحقيبة تجريبية")}
                className="bag-art relative grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl"
              >
                <div
                  className="bag !scale-[.43]"
                  style={
                    variant.id === "black"
                      ? { backgroundColor: "#303938" }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-xl bg-slate-100 text-xs text-slate-500">
                {t("لا توجد صورة")}
              </div>
            ))}
          <div className="min-w-0 flex-1">
            {elements.productTitle && (
              <>
                <h3 className="text-sm font-bold">
                  {t(product.name)}
                  {product.demo && (
                    <span className="ms-2 rounded bg-slate-100 px-1 text-[9px] font-normal text-slate-500">
                      DEMO
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{t(variant.name)}</p>
              </>
            )}
            {elements.productPrice && (
              <p
                data-testid="unit-price"
                className="mt-1.5 text-base font-bold"
                style={{
                  color:
                    buttonForeground(design.buttonColor) === "#ffffff"
                      ? design.buttonColor
                      : design.textColor,
                }}
              >
                {formatDzd(shownUnitMinor! / 100)}
              </p>
            )}
          </div>
        </div>
      )}
      {elements.title && (
        <h3 className="mb-3 text-base font-bold">{t(design.title)}</h3>
      )}
      {elements.subtitle && (
        <p className="mb-4 text-xs leading-5 text-slate-500">
          {t(design.subtitle)}
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          if (previewOnly) {
            event.preventDefault();
            return;
          }
          void handleSubmit(confirm)(event);
        }}
        className="space-y-3"
        aria-busy={isSubmitting}
      >
        {elements.productSelector && (
          <div>
            <label htmlFor="checkout-product">{t(design.labels.product)}</label>
            <select
              id="checkout-product"
              value={values.productId}
              disabled={isSubmitting}
              onChange={(e) => {
                const next = catalog.products.find(
                  (p) => p.id === e.target.value,
                )!;
                setValue("productId", next.id);
                setValue("variantId", next.variants[0].id);
              }}
            >
              {catalog.products
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.name)}
                  </option>
                ))}
            </select>
          </div>
        )}
        <OrderedFields
          disabled={isSubmitting}
          compact={design.compact}
          columns={design.columns}
        >
          {elements.variant && (
            <div className="col-span-2" style={position("variant")}>
              <label htmlFor="product-variant">
                {t(design.labels.variant)}
              </label>
              <select id="product-variant" {...register("variantId")}>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {t(v.name)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {contactField("name")}
          {contactField("phone")}
          {elements.geography && (
            <div className="col-span-2" style={position("geography")}>
              <GeographyFields
                compact
                labels={{
                  wilaya: design.labels.wilaya,
                  commune: design.labels.commune,
                }}
                showSearch={elements.locationSearch}
                showAdministrativeMode={elements.administrativeMode}
                showInfo={false}
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
          )}
          {elements.method && (
            <fieldset className="col-span-2" style={position("method")}>
              <legend className="mb-2 text-xs font-semibold">
                {t(design.labels.method)}
                <span className="ms-1 text-red-500">*</span>
              </legend>
              <div
                className={`grid gap-2 ${design.deliveryMode === "both" ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {(
                  [
                    { id: "home", title: design.labels.home, icon: Truck },
                    {
                      id: "office",
                      title: design.labels.office,
                      icon: Package,
                    },
                  ] as const
                )
                  .filter(
                    (m) =>
                      design.deliveryMode === "both" ||
                      design.deliveryMode === m.id,
                  )
                  .map(({ id, icon: Icon }) => {
                    const option = pricing.quote?.methods[id];
                    return (
                      <label
                        key={id}
                        className={`delivery-option ${deliveryChosen && values.method === id ? "selected" : ""} ${!option?.available ? "unavailable" : ""}`}
                      >
                        <input
                          type="radio"
                          name="delivery-method"
                          value={id}
                          disabled={!option?.available || catalogBlocked}
                          checked={deliveryChosen && values.method === id}
                          onChange={() => {
                            setValue("method", id, { shouldDirty: true });
                            setDeliveryChosen(true);
                            if (id === "office") setValue("address", "");
                          }}
                        />
                        <Icon size={17} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold">
                            {t(design.labels[id])}
                          </span>
                          <span className="mt-1 block text-[11px] opacity-75">
                            {option?.available
                              ? formatDzd(option.amountMinor! / 100)
                              : t(
                                  values.communeId
                                    ? "غير متاح"
                                    : "اختر الولاية والبلدية",
                                )}
                          </span>
                        </span>
                      </label>
                    );
                  })}
              </div>
              {!deliveryChosen && values.communeId && (
                <p className="mt-2 text-xs text-slate-500">
                  {t("اختر طريقة التوصيل المناسبة لك.")}
                </p>
              )}
              {pricing.quote &&
                (["home", "office"] as const)
                  .filter(
                    (id) =>
                      (design.deliveryMode === "both" ||
                        design.deliveryMode === id) &&
                      !pricing.quote!.methods[id].available,
                  )
                  .map((id) => (
                    <p key={id} className="mt-1 text-[11px] text-slate-500">
                      {t(id === "home" ? "المنزل:" : "المكتب:")}{" "}
                      {t(pricing.quote!.methods[id].reason)}
                    </p>
                  ))}
            </fieldset>
          )}
          {contactField("address")}
          {elements.quantity && (
            <div
              className="col-span-2 flex items-center justify-between"
              style={position("quantity")}
            >
              <label htmlFor="quantity" className="!mb-0">
                {t(design.labels.quantity)}
              </label>
              <div className="quantity-control">
                <button
                  type="button"
                  aria-label={t("تقليل الكمية")}
                  disabled={values.quantity <= 1}
                  onClick={() => setValue("quantity", values.quantity - 1)}
                >
                  <Minus size={14} />
                </button>
                <input id="quantity" readOnly value={values.quantity} />
                <button
                  type="button"
                  aria-label={t("زيادة الكمية")}
                  disabled={values.quantity >= 10}
                  onClick={() => setValue("quantity", values.quantity + 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </OrderedFields>
        {elements.summary && (
          <div aria-live="polite" className="lead-summary">
            <div>
              <span>{t(design.labels.subtotal)}</span>
              <span data-testid="subtotal">
                {formatDzd(figures.subtotalMinor / 100)}
              </span>
            </div>
            <div className={figures.discountMinor ? "" : "sr-only"}>
              <span>{t(design.labels.discount)}</span>
              <span data-testid="discount">
                {formatDzd(figures.discountMinor / 100)}
              </span>
            </div>
            <div>
              <span>{t(design.labels.shipping)}</span>
              <span data-testid="delivery-price">
                {selected?.available
                  ? formatDzd(selected.amountMinor! / 100)
                  : t("اختر طريقة التوصيل")}
              </span>
            </div>
            <div className="lead-total">
              <strong>{t(design.labels.total)}</strong>
              <strong data-testid="final-total">
                {total !== null ? formatDzd(total / 100) : "—"}
              </strong>
            </div>
            {selected?.eta && (
              <p className="text-[11px] text-slate-500">
                {t("المدة التقديرية:")} {t(selected.eta)}
              </p>
            )}
            {pricing.loading && (
              <p role="status" className="text-[11px] text-slate-500">
                {t("جارٍ تحديث السعر من الخادم…")}
              </p>
            )}
          </div>
        )}
        {pricing.error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
          >
            <p>{t(pricing.error)}</p>
            <Button type="button" variant="outline" onClick={pricing.retry}>
              {t("إعادة حساب السعر")}
            </Button>
          </div>
        )}
        <Button
          type="submit"
          style={{
            backgroundColor: design.buttonColor,
            color: buttonForeground(design.buttonColor),
          }}
          className="lead-submit w-full"
          disabled={previewOnly || isSubmitting || !canSubmit || !!success}
        >
          <Check size={17} />
          {t(isSubmitting ? "جارٍ التحقق على الخادم…" : design.buttonText)}
          {!elements.summary && total !== null && (
            <span> · {formatDzd(total / 100)}</span>
          )}
        </Button>
        {submitError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {t(submitError)}
          </p>
        )}
        {success && (
          <p
            role="status"
            data-testid="checkout-success"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {t(design.successMessage)}
          </p>
        )}
        {elements.footer && (
          <p className="text-center text-[11px] leading-5 text-slate-500">
            {t(design.footerText)}
          </p>
        )}
      </form>
    </div>
  );
}
