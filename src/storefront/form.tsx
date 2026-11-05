import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  productSchema,
  pricingInputSchema,
  checkoutInputSchema,
  checkoutQuoteSchema,
  type CheckoutQuote,
} from "../modules/checkout/schema";
import { text, errorText, type Locale } from "./copy";
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
  design: z.object({
    title: z.string(),
    buttonColor: z.string(),
    background: z.string(),
    textColor: z.string(),
    deliveryMode: z.enum(["both", "home", "office"]),
    officePickupInstructions: z.string(),
  }),
});
export interface FormProps {
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
  const locale = props.locale,
    t = (key: string) => text(key, locale);
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
      response = await fetch(
        `${props.apiBase}/${operation}${q.size ? "?" + q : ""}`,
        {
          method: body ? "POST" : "GET",
          credentials: "same-origin",
          redirect: "error",
          cache: "no-store",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal,
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
        const data = bootstrapSchema.parse(raw);
        if (!controller.signal.aborted) {
          setBootstrap(data);
          setVariantId((current) =>
            data.product.variants.some((v) => v.id === current)
              ? current
              : current || data.product.variants[0].id,
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(t("network"));
      });
    return () => controller.abort();
  }, [props.productId, props.apiBase, reload]);
  useEffect(() => {
    if (props.variantId) setVariantId(props.variantId);
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
  const input = {
    productId: props.productId,
    variantId,
    quantity,
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
    const customer = checkoutInputSchema.safeParse({
      ...input,
      name,
      phone,
      address,
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
      <div className="card" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
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
      className="card"
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
      onSubmit={(event) => void validate(event)}
    >
      <div className="product">
        {image && (
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
          <strong>{bootstrap.product.name}</strong>
          <p className="price">
            {variant ? money(quote?.unitPriceMinor ?? variant.priceMinor) : "—"}
          </p>
        </div>
      </div>
      <h2>{props.title || bootstrap.design.title || t("title")}</h2>
      <p className="phase">{t("phase")}</p>
      {props.introText && <p>{props.introText}</p>}
      <fieldset disabled={busy}>
        <label>
          {t("variant")}
          <select
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              props.setVariant(e.target.value);
            }}
          >
            {bootstrap.product.variants.map((v) => (
              <option value={v.id} key={v.id} disabled={v.stock === 0}>
                {v.name}
                {v.stock === 0 ? " — " + t("stock") : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("quantity")}
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
              aria-label={t("quantity")}
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
        {!variant || (variant.stock !== null && variant.stock < quantity) ? (
          <p role="alert">{t("stock")}</p>
        ) : null}
        <label>
          {t("name")}
          <input
            autoComplete="name"
            required
            minLength={3}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("phone")}
          <input
            dir="ltr"
            type="tel"
            autoComplete="tel"
            required
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05… / 06… / 07…"
          />
        </label>
        <div className="locations">
          <label>
            {t("wilaya")}
            <select
              required
              aria-label={t("wilaya")}
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
            {t("commune")}
            <select
              required
              aria-label={t("commune")}
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
        <fieldset className="methods">
          <legend>{t("method")}</legend>
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
                {t(m)}
                <small>
                  {quote?.methods[m].available
                    ? money(quote.methods[m].amountMinor!)
                    : t("unavailable")}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        {method === "home" && (
          <label>
            {t("address")}
            <textarea
              autoComplete="street-address"
              required
              minLength={8}
              maxLength={250}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        )}
        {method === "office" && bootstrap.design.officePickupInstructions && (
          <p>{bootstrap.design.officePickupInstructions}</p>
        )}
        <dl className="summary">
          <div>
            <dt>{t("subtotal")}</dt>
            <dd>
              {variant
                ? money(quote?.subtotalMinor ?? variant.priceMinor * quantity)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>{t("discount")}</dt>
            <dd>{quote ? money(quote.discountMinor) : "—"}</dd>
          </div>
          <div>
            <dt>{t("shipping")}</dt>
            <dd>{selected?.available ? money(selected.amountMinor!) : "—"}</dd>
          </div>
          <div className="total">
            <dt>{t("total")}</dt>
            <dd aria-live="polite">
              {selected?.available ? money(selected.totalMinor!) : "—"}
            </dd>
          </div>
        </dl>
        <button
          className="submit"
          type="submit"
          disabled={!canValidate || busy}
        >
          {busy ? t("checking") : props.buttonText || t("check")}
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
      {props.footerText && <p>{props.footerText}</p>}
      <p className="privacy">{t("privacy")}</p>
    </form>
  );
}
