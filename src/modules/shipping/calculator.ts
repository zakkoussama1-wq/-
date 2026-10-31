import type { ShippingRule, ShippingState } from "./schema";
import type { ShippingQuote, DeliveryMethod } from "../contracts";
export type EffectiveQuote = ShippingQuote & {
  reason: string;
  eta: string;
};
/** Authoritative rule precedence. Explicit unavailability or disabled method blocks fallback. */
export function calculateShipping(
  state: ShippingState,
  wilayaCode: string,
  communeId: string,
  method: DeliveryMethod,
): EffectiveQuote {
  if (method === "office" && !state.genericOffice)
    return unavailable(
      "التوصيل إلى المكتب غير مفعّل؛ يجب إعداد وضع المكتب العام صراحةً.",
    );
  const candidates = [
    { scope: "commune", target: communeId },
    { scope: "wilaya", target: wilayaCode },
    { scope: "default", target: "*" },
  ] as const;
  for (const target of candidates) {
    const entry = state.entries.find(
      (e) => e.scope === target.scope && e.target === target.target,
    );
    if (!entry) continue;
    const rule: ShippingRule = entry.rule;
    const option = rule[method];
    if (!rule.available) return unavailable("التوصيل غير متاح لهذه المنطقة.");
    if (!option.enabled)
      return unavailable("طريقة التوصيل معطّلة لهذه المنطقة.");
    if (option.price === null)
      return unavailable("لم يُضبط سعر طريقة التوصيل.");
    return {
      available: true,
      amount: option.price,
      source: target.scope,
      reason: "",
      eta: rule.eta,
    };
  }
  return unavailable("لم يُضبط سعر شحن لهذه المنطقة أو سعر افتراضي.");
}
function unavailable(reason: string): EffectiveQuote {
  return {
    available: false,
    amount: null,
    source: "unavailable",
    reason,
    eta: "",
  };
}
