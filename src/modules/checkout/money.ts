import type { Discount } from "./schema";
export function amounts(
  unitMinor: number,
  quantity: number,
  discount: Discount,
) {
  if (
    !Number.isSafeInteger(unitMinor) ||
    unitMinor < 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 10
  )
    throw new RangeError("سعر أو كمية غير صالحة.");
  const subtotalMinor = unitMinor * quantity;
  const requested =
    discount.type === "none"
      ? 0
      : discount.type === "fixed"
        ? discount.value
        : Math.round((subtotalMinor * discount.value) / 10000);
  const discountMinor = Math.min(subtotalMinor, Math.max(0, requested));
  return {
    subtotalMinor,
    discountMinor,
    netMinor: subtotalMinor - discountMinor,
  };
}
export function toMinor(dzd: number) {
  if (
    !Number.isFinite(dzd) ||
    dzd < 0 ||
    Math.abs(dzd * 100 - Math.round(dzd * 100)) > 1e-5
  )
    throw new RangeError("مبلغ شحن غير صالح.");
  return Math.round(dzd * 100);
}
