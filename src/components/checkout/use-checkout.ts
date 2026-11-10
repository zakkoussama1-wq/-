"use client";
import { useCheckoutUpdates } from "./live-updates";
import { storefrontUrl } from "@/modules/checkout/storefront-url";
import { useEffect, useState } from "react";
import {
  catalogSchema,
  checkoutQuoteSchema,
  type CheckoutCatalog,
  type CheckoutQuote,
  type PricingInput,
} from "@/modules/checkout/schema";
export function useCheckoutCatalog(refresh: number) {
  const updates = useCheckoutUpdates();
  const [retry, setRetry] = useState(0);
  const key = `${refresh}:${retry}:${updates}`;
  const [result, setResult] = useState<{
    key: string;
    catalog: CheckoutCatalog | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(storefrontUrl("/api/checkout/catalog"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401)
            throw new RangeError(
              "يلزم تسجيل الدخول بحساب DZ Lead Form Pro المرتبط بالمتجر لعرض النموذج.",
            );
          if (response.status === 403)
            throw new RangeError(
              "جلسة الدخول لا تسمح بتحميل بيانات هذا المتجر. استخدم حساب التاجر المرتبط.",
            );
          if (response.status === 409)
            throw new RangeError(
              "الحساب غير مرتبط بمتجر Shopify موثّق. راجع صفحة التكاملات.",
            );
          if (response.status === 404)
            throw new RangeError("المنتج أو الخيار المحدد غير متاح.");
          throw new Error();
        }
        const catalog = catalogSchema.parse(await response.json());
        if (!controller.signal.aborted) setResult({ key, catalog, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            key,
            catalog:
              error instanceof RangeError ? null : (previous?.catalog ?? null),
            error:
              error instanceof RangeError
                ? error.message
                : "تعذر تحميل المنتج وإعدادات الخصم. أعد المحاولة.",
          }));
      });
    return () => controller.abort();
  }, [key]);
  return {
    catalog: result?.catalog ?? null,
    error: result?.key === key ? result.error : "",
    loading: result?.key !== key,
    retry: () => setRetry((n) => n + 1),
  };
}
export function useCheckoutQuote(input: PricingInput | null, refresh: number) {
  const updates = useCheckoutUpdates();
  const [retry, setRetry] = useState(0);
  const requestJson = input ? JSON.stringify(input) : "";
  const key = `${refresh}:${retry}:${updates}:${requestJson}`;
  const locationKey = input
    ? JSON.stringify([input.mode, input.wilayaCode, input.communeId])
    : "";
  const [result, setResult] = useState<{
    key: string;
    locationKey: string;
    quote: CheckoutQuote | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!requestJson) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(storefrontUrl("/api/checkout/quote"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestJson,
          signal: controller.signal,
        });
        const raw = await response.json();
        if (!response.ok)
          throw new Error(
            typeof raw.error === "string" ? raw.error : "تعذر حساب الطلب.",
          );
        const quote = checkoutQuoteSchema.parse(raw);
        if (!controller.signal.aborted)
          setResult({ key, locationKey, quote, error: "" });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            key,
            locationKey,
            quote: null,
            error:
              error instanceof Error && /[\u0600-\u06ff]/.test(error.message)
                ? error.message
                : "تعذر حساب الطلب. أعد المحاولة.",
          });
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestJson, key, locationKey]);
  return {
    quote: result?.locationKey === locationKey ? result.quote : null,
    ready: !!requestJson && result?.key === key && !!result.quote,
    error: result?.key === key ? result.error : "",
    loading: !!requestJson && result?.key !== key,
    retry: () => setRetry((n) => n + 1),
  };
}
