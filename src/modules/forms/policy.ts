import { z } from "zod";
import type { PricingInput } from "../checkout/schema";
import { checkoutSchemaForSettings } from "../checkout/schema";
import type { FormSettings } from "./settings";
export function formValidationSchema(settings: FormSettings) {
  return z
    .object({
      customer: checkoutSchemaForSettings(settings.contact),
      quoteToken: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
}
export function assertFormPricing(settings: FormSettings, input: PricingInput) {
  if (!settings.elements.quantity && input.quantity !== 1)
    throw new RangeError("الكمية ثابتة في هذا النموذج.");
  if (
    !settings.elements.geography &&
    (input.mode !== settings.administrativeMode ||
      input.wilayaCode !== settings.fixedWilaya ||
      input.communeId !== settings.fixedCommune)
  )
    throw new RangeError("منطقة التوصيل ثابتة في هذا النموذج.");
  if (
    !settings.elements.productSelector &&
    settings.featuredProductId &&
    input.productId !== settings.featuredProductId
  )
    throw new RangeError("المنتج غير مخصص لهذا النموذج.");
  if (
    !settings.elements.variant &&
    !settings.elements.productSelector &&
    settings.featuredVariantId &&
    input.variantId !== settings.featuredVariantId
  )
    throw new RangeError("الخيار غير مخصص لهذا النموذج.");
}
