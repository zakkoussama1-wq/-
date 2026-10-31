import { z } from "zod";
export const formSettingsSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    border: z.enum(["soft", "plain"]),
    successMessage: z.string().min(1).max(200),
    nameLabel: z.string().min(1).max(60),
    phoneLabel: z.string().min(1).max(60),
    addressLabel: z.string().min(1).max(60),
    namePlaceholder: z.string().max(100),
    phonePlaceholder: z.string().max(100),
    addressPlaceholder: z.string().max(100),
    order: z
      .array(
        z.enum([
          "variant",
          "name",
          "phone",
          "geography",
          "method",
          "address",
          "quantity",
        ]),
      )
      .length(7)
      .refine((a) => new Set(a).size === 7),
  })
  .strict();
export const defaultFormSettings = formSettingsSchema.parse({
  title: "أكمل معلومات طلبك",
  buttonColor: "#047857",
  background: "#ffffff",
  border: "soft",
  successMessage: "تم استلام طلبك للمراجعة.",
  nameLabel: "الاسم الكامل",
  phoneLabel: "رقم الهاتف",
  addressLabel: "عنوان المنزل",
  namePlaceholder: "أدخل اسمك ولقبك",
  phonePlaceholder: "05 XX XX XX XX أو +213",
  addressPlaceholder: "الشارع، الحي، رقم المنزل",
  order: [
    "variant",
    "name",
    "phone",
    "geography",
    "method",
    "address",
    "quantity",
  ],
});
export type FormSettings = z.infer<typeof formSettingsSchema>;
