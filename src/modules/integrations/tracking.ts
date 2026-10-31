import { createHash } from "node:crypto";
import { z } from "zod";
const eventSchema = z
  .object({
    eventId: z.uuid(),
    consent: z.literal(true),
    testMode: z.literal(true),
    valueMinor: z.number().int().nonnegative(),
    phone: z.string().regex(/^0[567]\d{8}$/),
    sourceUrl: z.url().refine((s) => new URL(s).protocol === "https:"),
    testEventCode: z.string().min(1).max(100),
  })
  .strict();
export type TrackingTestEvent = z.infer<typeof eventSchema>;
export function trackingPayload(
  platform: "meta" | "tiktok",
  raw: TrackingTestEvent,
  pixel: string,
) {
  const e = eventSchema.parse(raw);
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(pixel))
    throw new Error("معرف منصة غير صالح.");
  const phone = createHash("sha256")
    .update("213" + e.phone.slice(1))
    .digest("hex");
  const common = {
    event_id: e.eventId,
    event_time: Math.floor(Date.now() / 1000),
    properties: { currency: "DZD", value: e.valueMinor / 100 },
  };
  return platform === "meta"
    ? {
        data: [
          {
            event_name: "Lead",
            event_time: common.event_time,
            event_id: e.eventId,
            action_source: "website",
            event_source_url: e.sourceUrl,
            user_data: { ph: [phone] },
            custom_data: common.properties,
          },
        ],
        test_event_code: e.testEventCode,
      }
    : {
        event_source: "web",
        event_source_id: pixel,
        test_event_code: e.testEventCode,
        data: [
          {
            ...common,
            event: "SubmitForm",
            user: { phone: phone },
            page: { url: e.sourceUrl },
          },
        ],
      };
}
/** Server-only, test-event transport. Never invoked automatically by order creation. */
export async function sendTrackingTest(
  platform: "meta" | "tiktok",
  event: TrackingTestEvent,
  settings: {
    enabled: boolean;
    pixel: string;
    accessToken: string;
    metaVersion?: string;
  },
  transport: typeof fetch = fetch,
) {
  if (process.env.DZ_DISABLE_EXTERNAL_INTEGRATIONS === "1")
    throw new Error("التكاملات الخارجية معطلة في التجربة المحلية.");
  if (!settings.enabled) throw new Error("الإرسال الخارجي معطّل.");
  if (!settings.accessToken) throw new Error("اعتماد المنصة غير متاح.");
  const version = settings.metaVersion ?? "v23.0";
  if (!/^v\d+\.0$/.test(version)) throw new Error("إصدار Meta غير صالح.");
  const payload = trackingPayload(platform, event, settings.pixel);
  const url =
    platform === "meta"
      ? `https://graph.facebook.com/${version}/${settings.pixel}/events`
      : "https://business-api.tiktok.com/open_api/v1.3/event/track/";
  const response = await transport(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(platform === "meta"
        ? { Authorization: `Bearer ${settings.accessToken}` }
        : { "Access-Token": settings.accessToken }),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`رفضت المنصة طلب الاختبار (HTTP ${response.status}).`);
  const data = await response.json();
  if (platform === "meta" && Number(data.events_received) < 1)
    throw new Error("لم تؤكد Meta استلام الحدث.");
  if (platform === "tiktok" && data.code !== 0)
    throw new Error("لم تؤكد TikTok استلام الحدث.");
  return { accepted: true, eventId: event.eventId, testMode: true };
}
