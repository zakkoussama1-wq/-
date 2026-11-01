import { z } from "zod";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const fieldOrder = [
  "variant",
  "name",
  "phone",
  "geography",
  "method",
  "address",
  "quantity",
] as const;
export const elementDefaults = {
  productSelector: false,
  variant: false,
  productImage: true,
  productTitle: true,
  productPrice: true,
  title: true,
  subtitle: false,
  badge: false,
  summary: true,
  footer: false,
  quantity: true,
  geography: true,
  method: true,
  locationSearch: false,
  administrativeMode: false,
};
const elementSchema = z
  .object(
    Object.fromEntries(
      Object.entries(elementDefaults).map(([key, value]) => [
        key,
        z.boolean().default(value),
      ]),
    ) as { [K in keyof typeof elementDefaults]: z.ZodDefault<z.ZodBoolean> },
  )
  .strict();
export const labelDefaults = {
  product: "المنتج المطلوب",
  variant: "خيار المنتج",
  wilaya: "الولاية",
  commune: "البلدية",
  method: "طريقة التوصيل",
  home: "التوصيل إلى المنزل",
  office: "التوصيل إلى المكتب",
  quantity: "الكمية",
  subtotal: "مجموع المنتجات",
  discount: "خصم التاجر على المنتجات",
  shipping: "التوصيل",
  total: "الإجمالي النهائي",
};
const labelsSchema = z
  .object(
    Object.fromEntries(
      Object.entries(labelDefaults).map(([key, value]) => [
        key,
        z.string().trim().min(1).max(80).default(value),
      ]),
    ) as { [K in keyof typeof labelDefaults]: z.ZodDefault<z.ZodString> },
  )
  .strict();
const contactMode = z.enum(["required", "optional", "hidden"]);
export const formSettingsSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    buttonColor: color,
    background: color,
    textColor: color.default("#202223"),
    border: z.enum(["soft", "plain"]),
    successMessage: z.string().min(1).max(200),
    nameLabel: z.string().min(1).max(60),
    phoneLabel: z.string().min(1).max(60),
    addressLabel: z.string().min(1).max(60),
    namePlaceholder: z.string().max(100),
    phonePlaceholder: z.string().max(100),
    addressPlaceholder: z.string().max(100),
    labels: labelsSchema.default(labelDefaults),
    buttonText: z.string().min(1).max(80).default("تأكيد الطلب وحفظه"),
    subtitle: z
      .string()
      .max(250)
      .default("أدخل معلوماتك وسنتواصل معك لتأكيد الطلب."),
    footerText: z
      .string()
      .max(250)
      .default("بياناتك آمنة وتُستخدم لتوصيل طلبك فقط."),
    badgeText: z.string().max(100).default("الدفع عند الاستلام"),
    officePickupInstructions: z.string().trim().max(300).optional(),
    compact: z.boolean().default(true),
    columns: z.enum(["one", "two"]).default("two"),
    elements: elementSchema.default(elementDefaults),
    contact: z
      .object({
        name: contactMode.default("required"),
        phone: contactMode.default("required"),
        address: contactMode.default("required"),
      })
      .strict()
      .default({ name: "required", phone: "required", address: "required" }),
    deliveryMode: z.enum(["both", "home", "office"]).default("both"),
    defaultMethod: z.enum(["none", "home", "office"]).default("none"),
    administrativeMode: z.enum(["legacy58", "updated69"]).default("legacy58"),
    fixedWilaya: z
      .string()
      .regex(/^(\d{2})?$/)
      .default(""),
    fixedCommune: z
      .string()
      .regex(/^(dz:commune:\d+)?$/)
      .default(""),
    featuredProductId: z.string().max(100).default(""),
    featuredVariantId: z.string().max(100).default(""),
    order: z
      .array(z.enum(fieldOrder))
      .length(7)
      .refine((a) => new Set(a).size === 7),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !value.elements.geography &&
      (!value.fixedWilaya || !value.fixedCommune)
    )
      ctx.addIssue({
        code: "custom",
        path: ["elements", "geography"],
        message: "حدد ولاية وبلدية ثابتتين قبل إخفاء المنطقة.",
      });
    if (!value.elements.method && value.deliveryMode === "both")
      ctx.addIssue({
        code: "custom",
        path: ["elements", "method"],
        message: "اختر طريقة توصيل واحدة قبل إخفاء اختيار التوصيل.",
      });
  });
export const defaultFormSettings = formSettingsSchema.parse({
  title: "أكمل معلومات طلبك",
  buttonColor: "#008060",
  background: "#ffffff",
  border: "soft",
  successMessage: "تم استلام طلبك للمراجعة.",
  nameLabel: "الاسم الكامل",
  phoneLabel: "رقم الهاتف",
  addressLabel: "عنوان المنزل",
  namePlaceholder: "الاسم واللقب",
  phonePlaceholder: "05 XX XX XX XX",
  addressPlaceholder: "الشارع، الحي، رقم المنزل",
  order: [...fieldOrder],
});
export type FormSettings = z.infer<typeof formSettingsSchema>;
/** WCAG contrast: yellow/orange buttons need dark text rather than white. */
export function buttonForeground(hex: string) {
  const c = hex
    .slice(1)
    .match(/../g)!
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.179
    ? "#111827"
    : "#ffffff";
}
