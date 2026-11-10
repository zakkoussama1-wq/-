import { formSettingsSchema, type FormSettings } from "../forms/settings";
import { pricingInputSchema } from "../checkout/schema";
import { z } from "zod";
/** Bind the page product without replacing the merchant's field policy/order. */
export function storefrontSettings(settings: FormSettings, product: string) {
  return formSettingsSchema.parse({
    ...settings,
    featuredProductId: product,
    featuredVariantId: "",
  });
}
// Shape validation before loading the current merchant policy. Requirements and
// normalization are validated later with checkoutSchemaForSettings on the server.
export const storefrontCustomerSchema = pricingInputSchema
  .extend({
    name: z.string().max(100),
    phone: z.string().max(40),
    address: z.string().max(250),
    method: z.enum(["home", "office"]),
  })
  .strict();
