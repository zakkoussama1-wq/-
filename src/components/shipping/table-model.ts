import {
  emptyRule,
  type ShippingRule,
  type ShippingState,
} from "@/modules/shipping/schema";
export function wilayaRule(state: ShippingState, code: string): ShippingRule {
  return (
    state.entries.find((e) => e.scope === "wilaya" && e.target === code)
      ?.rule ??
    state.entries.find((e) => e.scope === "default")?.rule ??
    emptyRule
  );
}
export function sameRule(a: ShippingRule, b: ShippingRule) {
  return (
    a.available === b.available &&
    a.eta === b.eta &&
    a.home.enabled === b.home.enabled &&
    a.home.price === b.home.price &&
    a.office.enabled === b.office.enabled &&
    a.office.price === b.office.price
  );
}
