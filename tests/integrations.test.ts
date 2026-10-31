import { it, expect } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import {
  verifyShopifyWebhook,
  simulateTracking,
  localSubmissionEvent,
} from "../src/modules/integrations/verification";
it("verifies Shopify webhook raw bytes and rejects tampering", () => {
  const bytes = Buffer.from('{"order":1}');
  const secret = "local-fixture-secret";
  const signature = createHmac("sha256", secret).update(bytes).digest("base64");
  expect(verifyShopifyWebhook(bytes, signature, secret)).toBe(true);
  expect(verifyShopifyWebhook(Buffer.from("{}"), signature, secret)).toBe(
    false,
  );
  expect(verifyShopifyWebhook(bytes, "bad", secret)).toBe(false);
});
it("keeps tracking local, consented and deduplicatable without claiming paid purchase", () => {
  const id = randomUUID();
  const result = localSubmissionEvent("meta", 400000, id);
  expect(result.delivered).toBe(false);
  expect(result.event.eventId).toBe(id);
  expect(localSubmissionEvent("tiktok", 400000, id).event.eventId).toBe(id);
  expect(() =>
    simulateTracking({ ...result.event, testMode: false }),
  ).toThrow();
  expect(() => simulateTracking({ ...result.event, consent: false })).toThrow();
  expect(() =>
    simulateTracking({ ...result.event, event: "Purchase" }),
  ).toThrow();
});
