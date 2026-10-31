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
        if (!response.ok) throw new Error();
        const catalog = catalogSchema.parse(await response.json());
        if (!controller.signal.aborted) setResult({ key, catalog, error: "" });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            key,
            catalog: previous?.catalog ?? null,
            error: "تعذر تحميل المنتج وإعدادات الخصم. أعد المحاولة.",
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
              error instanceof Error
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
