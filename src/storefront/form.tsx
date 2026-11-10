import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  productSchema,
  pricingInputSchema,
  checkoutSchemaForSettings,
  checkoutQuoteSchema,
  type CheckoutQuote,
} from "../modules/checkout/schema";
import { text, errorText, type Locale } from "./copy";
import {
  formSettingsSchema,
  defaultFormSettings,
  labelDefaults,
  buttonForeground,
  type FormSettings,
} from "../modules/forms/settings";
const location = z.object({
  id: z.string(),
  code: z.string().optional(),
  nameAr: z.string(),
  nameLatin: z.string(),
});
const bootstrapSchema = z.object({
  phase: z.literal(2),
  submission: z.literal("validate_only"),
  context: z.string().max(2048),
  product: productSchema.refine((p) => !p.demo),
  wilayas: z.array(location),
  genericOffice: z.boolean(),
  design: formSettingsSchema,
});
export interface FormProps {
  transport?: typeof fetch;
  designOverride?: FormSettings;
  settingsSource?: "dashboard" | "block";
  productId: string;
  variantId: string;
  quantity: number;
  locale: Locale;
  apiBase: string;
  title: string;
  buttonText: string;
  introText: string;
  footerText: string;
  setVariant: (id: string) => void;
  setQuantity: (n: number) => void;
}
class WidgetError extends Error {}
export function EmbeddedForm(props: FormProps) {
  const [bootstrap, setBootstrap] = useState<z.infer<
      typeof bootstrapSchema
    > | null>(null),
    [reload, setReload] = useState(0),
    [error, setError] = useState(""),
    [wilaya, setWilaya] = useState(""),
    [commune, setCommune] = useState(""),
    [communes, setCommunes] = useState<z.infer<typeof location>[]>([]),
    [variantId, setVariantId] = useState(props.variantId),
    [quantity, setQuantity] = useState(props.quantity),
    [method, setMethod] = useState<"home" | "office">("home"),
    [cachedQuote, setQuote] = useState<CheckoutQuote | null>(null),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [address, setAddress] = useState(""),
    [busy, setBusy] = useState(false),
    [validated, setValidated] = useState(false),
    [quoteRetry, setQuoteRetry] = useState(0);
  const active = useRef<AbortController | null>(null);
  const design =
    props.designOverride ?? bootstrap?.design ?? defaultFormSettings;
  const locale = design.locale === "auto" ? props.locale : design.locale;
  const t = (key: string) => text(key, locale);
  const custom = (value: string, fallback: string, key: string) =>
    value === fallback ? t(key) : value;
  const label = (key: keyof typeof labelDefaults) =>
    custom(design.labels[key], labelDefaults[key], key);
  const position = (key: (typeof design.order)[number]) => ({
    order: design.order.indexOf(key),
  });
  const fields = design.elements;
  const cardStyle = {
    "--dz-accent": design.buttonColor,
    "--dz-background": design.background,
    "--dz-ink": design.textColor,
    "--dz-button-ink": buttonForeground(design.buttonColor),
    "--dz-font-size": design.fontSize + "px",
    "--dz-font":
      design.fontFamily === "serif"
        ? "Georgia, serif"
        : design.fontFamily === "theme"
          ? "var(--font-body--family, var(--font-body-family, system-ui, sans-serif))"
          : "system-ui, sans-serif",
  } as React.CSSProperties;
  if (props.settingsSource === "block") {
    delete cardStyle["--dz-accent" as keyof React.CSSProperties];
    delete cardStyle["--dz-background" as keyof React.CSSProperties];
    delete cardStyle["--dz-ink" as keyof React.CSSProperties];
    delete cardStyle["--dz-button-ink" as keyof React.CSSProperties];
  }
  const money = (minor: number) =>
    new Intl.NumberFormat(
      locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-DZ",
      { style: "currency", currency: "DZD", maximumFractionDigits: 2 },
    ).format(minor / 100);
  async function call(
    operation: string,
    body?: unknown,
    signal?: AbortSignal,
    params?: Record<string, string>,
  ) {
    const q = new URLSearchParams(params);
    let response: Response;
    let data: unknown;
    try {
      response = await (props.transport ?? fetch)(
        `${props.apiBase}/${operation}${q.size ? "?" + q : ""}`,
        {
          method: body ? "POST" : "GET",
          credentials: "same-origin",
          redirect: "error",
          cache: "no-store",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        },
      );
      data = await response.json();
    } catch {
      throw new WidgetError(t("network"));
    }
    if (!response.ok)
      throw new WidgetError(
        errorText(
          typeof data === "object" && data !== null && "code" in data
            ? data.code
            : undefined,
          locale,
        ),
      );
    return data;
  }
  // Product context is replaced only by the hosting block, never a global app/router state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: All transport/context dependencies are explicit below.
  useEffect(() => {
    const controller = new AbortController();
    setBootstrap(null);
    setQuote(null);
    setError("");
    void call("bootstrap", undefined, controller.signal, {
      product: props.productId,
      origin: window.location.origin,
    })
      .then((raw) => {
        const parsed = bootstrapSchema.safeParse(raw);
        if (!parsed.success)
          throw new WidgetError(t("network") + " [FORM_RESPONSE_INVALID]");
        const data = parsed.data;
        if (!controller.signal.aborted) {
          setBootstrap(data);
          setMethod(
            data.design.defaultMethod === "none"
              ? data.design.deliveryMode === "office"
                ? "office"
                : "home"
              : data.design.defaultMethod,
          );
          setVariantId((current) =>
            data.product.variants.some((v) => v.id === current)
              ? current
              : current || data.product.variants[0].id,
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof WidgetError ? error.message : t("network"));
      });
    return () => controller.abort();
  }, [props.productId, props.apiBase, reload]);
  useEffect(() => {
    setVariantId(props.variantId);
  }, [props.variantId]);
  useEffect(() => setQuantity(props.quantity), [props.quantity]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new transport context invalidates the location list.
  useEffect(() => {
    setCommunes([]);
    if (!wilaya) return;
    const c = new AbortController();
    void call("communes", undefined, c.signal, { wilaya })
      .then((raw) => {
        if (!c.signal.aborted)
          setCommunes(z.object({ items: z.array(location) }).parse(raw).items);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(t("network"));
      });
    return () => c.abort();
  }, [wilaya, props.apiBase, bootstrap?.context]);
  useEffect(() => {
    if (!fields.geography) {
      setWilaya(design.fixedWilaya);
      setCommune(design.fixedCommune);
    }
    if (!fields.quantity) setQuantity(1);
    if (!fields.method && design.deliveryMode !== "both")
      setMethod(design.deliveryMode);
    if (design.contact.name === "hidden") setName("");
    if (design.contact.phone === "hidden") setPhone("");
    if (design.contact.address === "hidden") setAddress("");
  }, [
    fields.geography,
    fields.quantity,
    fields.method,
    design.fixedWilaya,
    design.fixedCommune,
    design.deliveryMode,
    design.contact.name,
    design.contact.phone,
    design.contact.address,
  ]);
  const input = {
    productId: props.productId,
    variantId,
    quantity: fields.quantity ? quantity : 1,
    mode: "legacy58" as const,
    wilayaCode: wilaya,
    communeId: commune,
  };
  const inputKey = JSON.stringify(input);
  const quote =
    cachedQuote &&
    Object.keys(input).every(
      (k) =>
        input[k as keyof typeof input] ===
        cachedQuote.input[k as keyof typeof input],
    )
      ? cachedQuote
      : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: inputKey contains every authoritative pricing input.
  useEffect(() => {
    setQuote(null);
    setValidated(false);
    if (!bootstrap || !pricingInputSchema.safeParse(input).success) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      void call("quote", { context: bootstrap.context, input }, c.signal)
        .then((raw) => {
          const next = checkoutQuoteSchema.parse(raw);
          if (
            Object.keys(input).some(
              (k) =>
                input[k as keyof typeof input] !==
                next.input[k as keyof typeof input],
            )
          )
            throw new Error();
          if (!c.signal.aborted) {
            setQuote(next);
            setError((current) => (current === t("changed") ? current : ""));
          }
        })
        .catch((e) => {
          if (!c.signal.aborted)
            setError(e instanceof WidgetError ? e.message : t("network"));
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [inputKey, bootstrap?.context, quoteRetry, props.apiBase]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Editing contact or delivery fields invalidates the prior validation receipt.
  useEffect(() => {
    setValidated(false);
  }, [name, phone, address, method]);
  useEffect(() => () => active.current?.abort(), []);
  const variant = bootstrap?.product.variants.find((v) => v.id === variantId),
    selected = quote?.methods[method];
  const canValidate =
    !!variant &&
    !!quote &&
    selected?.available === true &&
    (variant.stock === null || variant.stock >= quantity);
  async function validate(event: React.FormEvent) {
    event.preventDefault();
    if (active.current || !bootstrap || !quote || !canValidate) return;
    const customer = checkoutSchemaForSettings(design.contact).safeParse({
      ...input,
      name: design.contact.name === "hidden" ? "" : name,
      phone: design.contact.phone === "hidden" ? "" : phone,
      address: design.contact.address === "hidden" ? "" : address,
      method,
    });
    if (!customer.success) {
      setError(t("invalid"));
      return;
    }
    const c = new AbortController();
    active.current = c;
    setBusy(true);
    setError("");
    setValidated(false);
    try {
      const result = await call(
        "validate",
        {
          context: bootstrap.context,
          customer: customer.data,
          quoteToken: quote.quoteToken,
        },
        c.signal,
      );
      if (
        typeof result !== "object" ||
        result === null ||
        !("validated" in result) ||
        result.validated !== true ||
        !("persisted" in result) ||
        result.persisted !== false ||
        !("shopifyOrderCreated" in result) ||
        result.shopifyOrderCreated !== false
      )
        throw new Error(t("network"));
      if (!c.signal.aborted) setValidated(true);
    } catch (e) {
      if (!c.signal.aborted) {
        setError(e instanceof WidgetError ? e.message : t("network"));
        setQuoteRetry((n) => n + 1);
      }
    } finally {
      active.current = null;
      if (!c.signal.aborted) setBusy(false);
    }
  }
  if (!bootstrap)
    return (
      <div
        className="card"
        data-dz-api-state={error ? "API_FAILED" : "API_LOADING"}
        style={cardStyle}
        dir={locale === "ar" ? "rtl" : "ltr"}
        lang={locale}
      >
        <p role={error ? "alert" : "status"}>{error || t("loading")}</p>
        {error && (
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            {t("retry")}
          </button>
        )}
      </div>
    );
  const image = variant?.imageUrl || bootstrap.product.imageUrl;
  return (
    <form
      data-dz-api-state="READY"
      className={`card ${design.compact ? "compact" : ""} ${design.border === "plain" ? "plain" : ""}`}
      style={cardStyle}
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
      onSubmit={(event) => void validate(event)}
    >
      <div className="product">
        {fields.productImage && image && (
          // biome-ignore lint/performance/noImgElement: This bundle runs on Shopify, outside the Next.js image runtime.
          <img
            src={image}
            alt={bootstrap.product.name}
            width="60"
            height="60"
            loading="lazy"
          />
        )}
        <div>
          {fields.productTitle && <strong>{bootstrap.product.name}</strong>}
          {fields.productPrice && (
            <p className="price">
              {variant
                ? money(quote?.unitPriceMinor ?? variant.priceMinor)
                : "—"}
            </p>
          )}
        </div>
      </div>
      {fields.title && (
        <h2>
          {props.settingsSource === "block" && props.title
            ? props.title
            : custom(design.title, defaultFormSettings.title, "title")}
        </h2>
      )}
      <p className="phase">{t("phase")}</p>
      {fields.subtitle && (
        <p>
          {props.settingsSource === "block" && props.introText
            ? props.introText
            : design.subtitle}
        </p>
      )}
      {fields.badge && <p className="badge">{design.badgeText}</p>}
      <fieldset className="fields" disabled={busy}>
        {fields.variant && (
          <label style={position("variant")}>
            {label("variant")}
            <select
              aria-label={label("variant")}
              value={variantId}
              onChange={(e) => {
                setVariantId(e.target.value);
                props.setVariant(e.target.value);
              }}
            >
              <option value="" disabled>
                {t("choose")}
              </option>
              {bootstrap.product.variants.map((v) => (
                <option value={v.id} key={v.id} disabled={v.stock === 0}>
                  {v.name}
                  {v.stock === 0 ? " — " + t("stock") : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {fields.quantity && (
          <label style={position("quantity")}>
            {label("quantity")}
            <div className="quantity">
              <button
                type="button"
                aria-label={t("minus")}
                disabled={quantity <= 1}
                onClick={() => {
                  setQuantity((n) => n - 1);
                  props.setQuantity(quantity - 1);
                }}
              >
                −
              </button>
              <input
                aria-label={label("quantity")}
                type="number"
                min="1"
                max="10"
                required
                value={quantity}
                onChange={(e) => {
                  const n = Math.max(
                    1,
                    Math.min(10, Number(e.target.value) || 1),
                  );
                  setQuantity(n);
                  props.setQuantity(n);
                }}
              />
              <button
                type="button"
                aria-label={t("plus")}
                disabled={quantity >= Math.min(10, variant?.stock ?? 10)}
                onClick={() => {
                  setQuantity((n) => n + 1);
                  props.setQuantity(quantity + 1);
                }}
              >
                +
              </button>
            </div>
          </label>
        )}
        {!variant || (variant.stock !== null && variant.stock < quantity) ? (
          <p role="alert" style={{ order: 80 }}>
            {t("stock")}
          </p>
        ) : null}
        {design.contact.name !== "hidden" && (
          <label style={position("name")}>
            {custom(design.nameLabel, defaultFormSettings.nameLabel, "name")}
            <input
              autoComplete="name"
              placeholder={design.namePlaceholder}
              required={design.contact.name === "required"}
              minLength={3}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {design.contact.phone !== "hidden" && (
          <label style={position("phone")}>
            {custom(design.phoneLabel, defaultFormSettings.phoneLabel, "phone")}
            <input
              dir="ltr"
              type="tel"
              autoComplete="tel"
              required={design.contact.phone === "required"}
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={design.phonePlaceholder}
            />
          </label>
        )}
        {fields.geography && (
          <div
            className={`locations ${design.columns === "one" ? "one" : ""}`}
            style={position("geography")}
          >
            <label>
              {label("wilaya")}
              <select
                required
                aria-label={label("wilaya")}
                value={wilaya}
                onChange={(e) => {
                  setWilaya(e.target.value);
                  setCommune("");
                }}
              >
                <option value="">{t("choose")}</option>
                {bootstrap.wilayas.map((w) => (
                  <option key={w.id} value={w.code}>
                    {w.code} — {locale === "ar" ? w.nameAr : w.nameLatin}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {label("commune")}
              <select
                required
                aria-label={label("commune")}
                value={commune}
                disabled={!communes.length}
                onChange={(e) => setCommune(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === "ar" ? c.nameAr : c.nameLatin}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {fields.method && (
          <fieldset className="methods" style={position("method")}>
            <legend>{label("method")}</legend>
            {(["home", "office"] as const).map((m) => (
              <label key={m} className="method">
                <input
                  type="radio"
                  name="delivery"
                  value={m}
                  checked={method === m}
                  disabled={!quote?.methods[m].available}
                  onChange={() => setMethod(m)}
                />
                <span>
                  {label(m)}
                  <small>
                    {quote?.methods[m].available
                      ? money(quote.methods[m].amountMinor!)
                      : t("unavailable")}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {method === "home" && design.contact.address !== "hidden" && (
          <label style={position("address")}>
            {custom(
              design.addressLabel,
              defaultFormSettings.addressLabel,
              "address",
            )}
            <textarea
              autoComplete="street-address"
              placeholder={design.addressPlaceholder}
              required={design.contact.address === "required"}
              minLength={8}
              maxLength={250}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        )}
        {method === "office" && bootstrap.design.officePickupInstructions && (
          <p style={position("address")}>{design.officePickupInstructions}</p>
        )}
        {fields.summary && (
          <dl className="summary" style={{ order: 90 }}>
            <div>
              <dt>{label("subtotal")}</dt>
              <dd>
                {variant
                  ? money(quote?.subtotalMinor ?? variant.priceMinor * quantity)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{label("discount")}</dt>
              <dd>{quote ? money(quote.discountMinor) : "—"}</dd>
            </div>
            <div>
              <dt>{label("shipping")}</dt>
              <dd>
                {selected?.available ? money(selected.amountMinor!) : "—"}
              </dd>
            </div>
            <div className="total">
              <dt>{label("total")}</dt>
              <dd aria-live="polite">
                {selected?.available ? money(selected.totalMinor!) : "—"}
              </dd>
            </div>
          </dl>
        )}
        <button
          className="submit"
          style={{ order: 100 }}
          type="submit"
          disabled={!canValidate || busy}
        >
          {busy
            ? t("checking")
            : (props.settingsSource === "block" && props.buttonText) ||
              custom(
                design.buttonText,
                defaultFormSettings.buttonText,
                "check",
              )}
        </button>
      </fieldset>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            {t("retry")}
          </button>
        </div>
      )}
      {validated && (
        <p role="status" className="success">
          {t("valid")}
        </p>
      )}
      {fields.footer && (
        <p>
          {props.settingsSource === "block" && props.footerText
            ? props.footerText
            : design.footerText}
        </p>
      )}
      <p className="privacy">{t("privacy")}</p>
    </form>
  );
}
