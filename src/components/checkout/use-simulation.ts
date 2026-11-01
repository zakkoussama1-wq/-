"use client";
import { useEffect, useRef, useState } from "react";
import { storefrontUrl } from "@/modules/checkout/storefront-url";
import type { SimulationConsent } from "@/modules/advertising/schema";
import { useCheckoutUpdates } from "./live-updates";
export function useSimulation(
  productId: string | undefined,
  variantId: string | undefined,
  quantity: number,
  previewOnly: boolean,
) {
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const visit = useRef("");
  const sent = useRef(new Set<string>());
  const updates = useCheckoutUpdates();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Cross-tab settings changes must re-read simulation availability.
  useEffect(() => {
    if (previewOnly) return;
    const abort = new AbortController();
    fetch(storefrontUrl("/api/simulation/config"), { signal: abort.signal })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        setEnabled(data?.enabled === true);
        if (!data?.enabled) setConsent(false);
      })
      .catch(() => setEnabled(false));
    return () => abort.abort();
  }, [previewOnly, updates]);
  function metadata(): SimulationConsent | undefined {
    if (!consent || !enabled || previewOnly) return;
    if (!visit.current) visit.current = crypto.randomUUID();
    const query = new URLSearchParams(window.location.search);
    const attribution: Record<string, string> = {};
    for (const key of ["fbclid", "ttclid", "gclid", "gbraid", "wbraid"]) {
      const value = query.get(key);
      if (value && /^[A-Za-z0-9._-]{1,256}$/.test(value))
        attribution[key] = value;
    }
    return { consent: true, visitId: visit.current, attribution };
  }
  function emit(eventType: "page_view" | "product_view" | "checkout_started") {
    const data = metadata();
    if (!data || !productId) return;
    const key = `${productId}:${eventType}`;
    if (sent.current.has(key)) return;
    sent.current.add(key);
    void fetch(storefrontUrl("/api/simulation/events"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: true,
        visitId: data.visitId,
        eventType,
        productId,
        variantId,
        quantity,
      }),
    }).catch(() => {
      sent.current.delete(key);
    });
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Product views are recorded once per visit, not on quantity edits.
  useEffect(() => {
    if (consent && enabled) {
      emit("page_view");
      emit("product_view");
    }
  }, [consent, enabled, productId]);
  return {
    enabled: enabled && !previewOnly,
    consent,
    setConsent,
    metadata,
    checkoutStarted: () => emit("checkout_started"),
  };
}
