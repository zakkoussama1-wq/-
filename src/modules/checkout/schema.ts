import { z } from "zod";
import { administrativeModeSchema } from "../geography/schema";
export const discountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none"), value: z.literal(0) }).strict(),
  z
    .object({
      type: z.literal("fixed"),
      value: z.number().int().min(0).max(1000000000),
    })
    .strict(),
  z
    .object({
      type: z.literal("percent"),
      value: z.number().int().min(0).max(10000),
    })
    .strict(),
]); // fixed in centimes, percent in basis points. Never browser-selected on checkout.
export type Discount = z.infer<typeof discountSchema>;
export const productImageSchema = z
  .string()
  .max(4096)
  .refine((s) => {
    if (/^\/media\/[a-f0-9]{64}\.webp$/.test(s)) return true;
    try {
      const url = new URL(s);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  });
export const productSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(200),
  demo: z.boolean(),
  active: z.boolean().default(true),
  sku: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  deleted: z.boolean().optional(),
  compareAtMinor: z.number().int().nonnegative().max(1000000000).optional(),
  imageUrl: productImageSchema.optional(),
  images: z
    .array(productImageSchema)
    .max(12)
    .refine((items) => new Set(items).size === items.length)
    .optional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        sku: z.string().trim().max(100).optional(),
        imageUrl: productImageSchema.optional(),
        priceMinor: z.number().int().nonnegative().max(1000000000),
        stock: z
          .number()
          .int()
          .nonnegative()
          .max(100000000)
          .nullable()
          .default(null),
      }),
    )
    .min(1)
    .max(100)
    .refine(
      (v) => new Set(v.map((x) => x.id)).size === v.length,
      "معرفات الخيارات مكررة",
    ),
});
export type CheckoutProduct = z.infer<typeof productSchema>;
export const catalogSchema = z.object({
  products: z.array(productSchema),
  discount: discountSchema,
  revision: z.number().int().nonnegative(),
});
export type CheckoutCatalog = z.infer<typeof catalogSchema>;
export const pricingInputSchema = z
  .object({
    productId: z.string().min(1).max(100),
    variantId: z.string().min(1).max(100),
    quantity: z
      .number()
      .int("الكمية يجب أن تكون عددًا صحيحًا")
      .min(1, "اختر كمية بين ١ و١٠")
      .max(10, "الحد الأقصى ١٠ قطع"),
    mode: administrativeModeSchema,
    wilayaCode: z.string().regex(/^\d{2}$/, "اختر الولاية"),
    communeId: z.string().regex(/^dz:commune:\d+$/, "اختر البلدية"),
  })
  .strict();
export type PricingInput = z.infer<typeof pricingInputSchema>;
export function normalizePhone(value: string) {
  let clean = value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[\s()-]/g, "");
  if (clean.startsWith("00213")) clean = "0" + clean.slice(5);
  else if (clean.startsWith("+213")) clean = "0" + clean.slice(4);
  return clean;
}
// biome-ignore lint/suspicious/noControlCharactersInRegex: This validation intentionally rejects control bytes.
const safeText = (value: string) => !/[<>\u0000-\u001f\u007f]/.test(value);
export const checkoutInputSchema = pricingInputSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(3, "أدخل الاسم الكامل (٣ أحرف على الأقل)")
      .max(100, "الاسم طويل جدًا")
      .refine(
        (v) => safeText(v) && /^[\p{L}\p{M} .'’-]+$/u.test(v),
        "أدخل اسمًا صحيحًا دون رموز أو وسوم",
      )
      .transform((v) => v.replace(/\s+/g, " ")),
    phone: z
      .string()
      .max(40, "رقم الهاتف طويل جدًا")
      .transform(normalizePhone)
      .refine(
        (v) => /^0[567][0-9]{8}$/.test(v),
        "أدخل رقم هاتف جزائري صحيحًا: ٠٥ أو ٠٦ أو ٠٧",
      ),
    method: z.enum(["home", "office"]),
    address: z
      .string()
      .trim()
      .max(250, "العنوان طويل جدًا")
      .refine(safeText, "العنوان يحتوي على رموز غير صالحة"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.method === "home" &&
      (value.address.length < 8 || !/[\p{L}]/u.test(value.address))
    )
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "أدخل عنوان منزل واضحًا (٨ أحرف على الأقل)",
      });
  });
export type CheckoutValues = z.input<typeof checkoutInputSchema>;
export type ValidatedCheckout = z.output<typeof checkoutInputSchema>;
export const validationRequestSchema = z
  .object({
    customer: checkoutInputSchema,
    quoteToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const discountUpdateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    discount: discountSchema,
  })
  .strict();
const methodQuoteSchema = z.object({
  available: z.boolean(),
  amountMinor: z.number().int().nonnegative().nullable(),
  totalMinor: z.number().int().nonnegative().nullable(),
  source: z.enum(["commune", "wilaya", "default", "unavailable"]),
  reason: z.string(),
  eta: z.string(),
});
export const checkoutQuoteSchema = z.object({
  input: pricingInputSchema,
  unitPriceMinor: z.number().int().nonnegative(),
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  methods: z.object({ home: methodQuoteSchema, office: methodQuoteSchema }),
  quoteToken: z.string(),
  demo: z.boolean(),
});
export type CheckoutQuote = z.infer<typeof checkoutQuoteSchema>;

/** Visible optional fields may be empty; hidden fields cannot collect customer data. */
export function checkoutSchemaForSettings(contact: {
  name: "required" | "optional" | "hidden";
  phone: "required" | "optional" | "hidden";
  address: "required" | "optional" | "hidden";
}) {
  const fields = checkoutInputSchema.shape;
  const field = <T extends z.ZodType<string>>(
    schema: T,
    mode: "required" | "optional" | "hidden",
  ) =>
    mode === "hidden"
      ? z.literal("")
      : mode === "optional"
        ? schema.or(z.literal(""))
        : schema;
  return pricingInputSchema
    .extend({
      ...fields,
      name: field(fields.name, contact.name),
      phone: field(fields.phone, contact.phone),
      address: field(fields.address, contact.address),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (
        value.method === "home" &&
        contact.address !== "hidden" &&
        (contact.address === "required" || value.address !== "") &&
        (value.address.length < 8 || !/[\p{L}]/u.test(value.address))
      )
        ctx.addIssue({
          code: "custom",
          path: ["address"],
          message: "أدخل عنوان منزل واضحًا (٨ أحرف على الأقل)",
        });
    });
}
