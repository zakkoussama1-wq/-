import { it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  trackingPayload,
  sendTrackingTest,
} from "../src/modules/integrations/tracking";
const event = {
  eventId: randomUUID(),
  consent: true as const,
  testMode: true as const,
  valueMinor: 390000,
  phone: "0551234567",
  sourceUrl: "https://example.test/product",
  testEventCode: "TEST123",
};
it("builds hashed test Lead/SubmitForm payloads with shared event IDs, not paid purchases", () => {
  const meta = trackingPayload("meta", event, "123456");
  const tt = trackingPayload("tiktok", event, "PIXEL123");
  expect(JSON.stringify(meta)).not.toContain(event.phone);
  expect(JSON.stringify(tt)).not.toContain(event.phone);
  expect(JSON.stringify(meta)).toContain("Lead");
  expect(JSON.stringify(tt)).toContain("SubmitForm");
  expect(JSON.stringify(tt)).toContain(event.eventId);
});
it("requires explicit enablement, consent and test mode before any HTTP call", async () => {
  const transport = vi.fn();
  await expect(
    sendTrackingTest(
      "meta",
      event,
      { enabled: false, pixel: "123456", accessToken: "fixture" },
      transport,
    ),
  ).rejects.toThrow();
  await expect(
    sendTrackingTest(
      "meta",
      { ...event, consent: false } as never,
      { enabled: true, pixel: "123456", accessToken: "fixture" },
      transport,
    ),
  ).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
it("handles accepted and rejected provider responses without exposing tokens", async () => {
  const ok = vi.fn(async () => Response.json({ events_received: 1 }));
  expect(
    await sendTrackingTest(
      "meta",
      event,
      { enabled: true, pixel: "123456", accessToken: "fixture" },
      ok,
    ),
  ).toMatchObject({ accepted: true, eventId: event.eventId });
  const fail = vi.fn(
    async () => new Response("sensitive provider response", { status: 401 }),
  );
  await expect(
    sendTrackingTest(
      "tiktok",
      event,
      { enabled: true, pixel: "PIXEL123", accessToken: "fixture" },
      fail,
    ),
  ).rejects.toThrow("HTTP 401");
});
