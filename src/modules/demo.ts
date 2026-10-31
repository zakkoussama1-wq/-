import { z } from "zod";
export const demoProduct = {
  name: "حقيبة يومية عصرية",
  variant: "أخضر زيتوني · مقاس واحد",
  price: 3900,
} as const;
export const previewSchema = z.object({
  name: z.string().trim().min(3, "أدخل الاسم الكامل (٣ أحرف على الأقل)"),
  phone: z
    .string()
    .regex(/^0[567][0-9]{8}$/, "أدخل رقم هاتف جزائري صحيحًا من ١٠ أرقام"),
  quantity: z.number().int().min(1).max(10),
});
export type PreviewValues = z.infer<typeof previewSchema>;
export function demoSubtotal(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw new Error("الكمية غير صالحة");
  return demoProduct.price * quantity;
}
