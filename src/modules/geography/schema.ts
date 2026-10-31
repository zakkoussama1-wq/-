import { z } from "zod";
export const administrativeModeSchema = z.enum(["legacy58", "updated69"]);
export const locationOptionSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  nameAr: z.string(),
  nameLatin: z.string(),
});
export type LocationOption = z.infer<typeof locationOptionSchema>;
export const geographyResponseSchema = z.object({
  items: z.array(locationOptionSchema),
  mode: administrativeModeSchema,
  verification: z.enum(["source-reviewed", "secondary-reference-only"]),
});
export const searchParamsSchema = z.object({
  mode: administrativeModeSchema.default("legacy58"),
  q: z.string().trim().max(100).default(""),
});
export const communeParamsSchema = searchParamsSchema.extend({
  wilayaCode: z.string().regex(/^\d{2}$/),
});
