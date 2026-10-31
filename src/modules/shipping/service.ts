import { calculateShipping } from "./calculator";
import { findCommune, getShippingState } from "./repository";
import { quoteSchema, type QuoteInput, type ShippingState } from "./schema";
/** All API and future order creation callers must use this server function. */
export async function quoteShipping(merchant: string, input: QuoteInput) {
  const data = quoteSchema.parse(input);
  findCommune(data.mode, data.wilayaCode, data.communeId);
  return await quoteShippingFromState(
    await getShippingState(merchant, data.mode),
    data,
  );
}
export function quoteShippingFromState(
  state: ShippingState,
  input: QuoteInput,
) {
  const data = quoteSchema.parse(input);
  if (state.mode !== data.mode)
    throw new RangeError("نظام أسعار الشحن غير مطابق.");
  findCommune(data.mode, data.wilayaCode, data.communeId);
  return calculateShipping(state, data.wilayaCode, data.communeId, data.method);
}
import type { ShippingService } from "../contracts";
export const shippingService: ShippingService = {
  async quote(merchantId, input) {
    return await quoteShipping(merchantId, input);
  },
};
