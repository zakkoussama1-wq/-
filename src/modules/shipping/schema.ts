import { z } from "zod";
import { administrativeModeSchema } from "../geography/schema";
const money = z
  .number()
  .finite()
  .min(0, "السعر يجب أن يكون غير سالب")
  .max(10000000, "السعر يتجاوز الحد المسموح")
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    "استخدم منزلتين عشريتين كحد أقصى",
  );
const methodSchema = z
  .object({ enabled: z.boolean(), price: money.nullable() })
  .strict()
  .refine((m) => !m.enabled || m.price !== null, "أدخل سعر الطريقة المفعّلة");
export const ruleSchema = z
  .object({
    available: z.boolean(),
    home: methodSchema,
    office: methodSchema,
    eta: z.string().trim().max(100).default(""),
  })
  .strict();
export type ShippingRule = z.infer<typeof ruleSchema>;
export const scopeSchema = z.enum(["default", "wilaya", "commune"]);
export const targetSchema = z
  .object({ scope: scopeSchema, target: z.string().max(80) })
  .strict();
export type RuleTarget = z.infer<typeof targetSchema>;
export const entrySchema = targetSchema.extend({ rule: ruleSchema }).strict();
export type RuleEntry = z.infer<typeof entrySchema>;
const base = {
  mode: administrativeModeSchema,
  revision: z.number().int().nonnegative(),
};
export const mutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...base,
      action: z.literal("save"),
      entries: z.array(entrySchema).min(1).max(1611),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("reset"),
      targets: z.array(targetSchema).min(1).max(1611),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("settings"),
      genericOffice: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal("import"),
      csv: z.string().min(1).max(1000000),
    })
    .strict(),
]);
export const quoteSchema = z
  .object({
    mode: administrativeModeSchema.default("legacy58"),
    wilayaCode: z.string().regex(/^\d{2}$/),
    communeId: z.string().regex(/^dz:commune:\d+$/),
    method: z.enum(["home", "office"]),
  })
  .strict();
export type QuoteInput = z.infer<typeof quoteSchema>;
export interface ShippingState {
  communeNames?: Record<string, string>;
  communeParents?: Record<string, string>;
  mode: z.infer<typeof administrativeModeSchema>;
  revision: number;
  genericOffice: boolean;
  entries: RuleEntry[];
}
export const emptyRule: ShippingRule = {
  available: true,
  home: { enabled: false, price: null },
  office: { enabled: false, price: null },
  eta: "",
};
export const shippingStateSchema = z.object({
  mode: administrativeModeSchema,
  revision: z.number().int().nonnegative(),
  genericOffice: z.boolean(),
  entries: z.array(entrySchema),
  communeNames: z.record(z.string(), z.string()).default({}),
  communeParents: z.record(z.string(), z.string()).default({}),
});
