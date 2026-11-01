import { z } from "zod";
export const attributionSchema = z
  .object({
    fbclid: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,256}$/)
      .optional(),
    ttclid: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,256}$/)
      .optional(),
    gclid: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,256}$/)
      .optional(),
    gbraid: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,256}$/)
      .optional(),
    wbraid: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,256}$/)
      .optional(),
  })
  .strict();
export const simulationConsentSchema = z
  .object({
    consent: z.literal(true),
    visitId: z.uuid(),
    attribution: attributionSchema.optional(),
  })
  .strict();
export const eventTypeSchema = z.enum([
  "page_view",
  "product_view",
  "checkout_started",
  "order_submitted",
  "order_confirmed",
  "order_delivered",
  "purchase",
]);
export type SimulationConsent = z.infer<typeof simulationConsentSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export const settingsSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    enabled: z.boolean(),
    purchaseOnFulfilled: z.boolean(),
  })
  .strict();
export type SimulationSettings = z.infer<typeof settingsSchema>;
export type SimulationEvent = {
  eventId: string;
  platform: string;
  channel: string;
  eventType: EventType;
  source: "browser" | "order" | "admin";
  orderId: string | null;
  productId: string;
  payload: Record<string, unknown>;
  status: "simulated" | "deduplicated" | "failed";
  attempts: number;
  createdAt: string;
  lastAttemptAt: string;
};
