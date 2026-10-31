import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
/** Verify the original raw bytes before parsing webhook JSON. */
export function verifyShopifyWebhook(
  raw: Buffer,
  received: string,
  secret: string,
) {
  if (!secret || !received) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const provided = Buffer.from(received, "base64");
  return (
    provided.length === expected.length && timingSafeEqual(expected, provided)
  );
}
const trackingSchema = z
  .object({
    platform: z.enum(["meta", "tiktok"]),
    eventId: z.uuid(),
    event: z.literal("order_submitted"),
    consent: z.literal(true),
    testMode: z.literal(true),
    valueMinor: z.number().int().nonnegative(),
    currency: z.literal("DZD"),
  })
  .strict();
/** Local event validation only: no network transport and no purchase event inference. */
export function simulateTracking(raw: unknown) {
  const event = trackingSchema.parse(raw);
  return { delivered: false as const, mode: "local-test" as const, event };
}
export function localSubmissionEvent(
  platform: "meta" | "tiktok",
  valueMinor: number,
  eventId = randomUUID(),
) {
  return simulateTracking({
    platform,
    valueMinor,
    eventId,
    event: "order_submitted",
    currency: "DZD",
    consent: true,
    testMode: true,
  });
}
