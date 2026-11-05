import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canPrepareOrderTrial } from "../src/modules/orders/shopify/trial";
import {
  safeTrialCode,
  trialReportSchema,
} from "../src/modules/orders/shopify/trial-ui";
const id = "4a1446b0-ae66-47cf-9693-09133389da05";
const order = { id, catalogSource: "shopify", status: "submitted" };
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://fixture.invalid/test");
  vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "0");
  vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC_MODE", "single_order");
  vi.stubEnv("DZ_SHOPIFY_ORDER_TRIAL_ID", id);
  for (const flag of [
    "DZ_BOOTSTRAP_MODE",
    "DZ_LOCAL_DEMO",
    "DZ_DISABLE_EXTERNAL_INTEGRATIONS",
  ])
    vi.stubEnv(flag, "");
});
afterEach(() => vi.unstubAllEnvs());
it("limits the server preparation hint to the configured, eligible local order", () => {
  expect(canPrepareOrderTrial(order)).toBe(true);
  expect(
    canPrepareOrderTrial({
      ...order,
      id: "3d519b54-f17a-45fa-b51d-2032bb1b0912",
    }),
  ).toBe(false);
  expect(canPrepareOrderTrial({ ...order, status: "cancelled" })).toBe(false);
  expect(canPrepareOrderTrial({ ...order, catalogSource: "local" })).toBe(
    false,
  );
});
it.each([
  ["DZ_SHOPIFY_ORDER_SYNC", "1"],
  ["DZ_SHOPIFY_ORDER_SYNC_MODE", "all"],
  ["DZ_SHOPIFY_ORDER_TRIAL_ID", ""],
  ["DATABASE_URL", ""],
  ["DZ_BOOTSTRAP_MODE", "1"],
  ["DZ_LOCAL_DEMO", "1"],
  ["DZ_DISABLE_EXTERNAL_INTEGRATIONS", "1"],
])("does not offer preparation with %s=%s", (name, value) => {
  vi.stubEnv(name, value);
  expect(canPrepareOrderTrial(order)).toBe(false);
});
it("never treats an incomplete or mutating response as a readiness report", () => {
  expect(
    trialReportSchema.safeParse({ ready: true, readOnly: true, checks: {} })
      .success,
  ).toBe(false);
  expect(
    trialReportSchema.safeParse({
      ready: true,
      readOnly: false,
      liveOrderCreationVerified: true,
      checks: {},
    }).success,
  ).toBe(false);
  expect(safeTrialCode("PRIVATE_ACCESS_TOKEN")).toBe("UNKNOWN_DIAGNOSTIC");
  expect(safeTrialCode("__proto__")).toBe("UNKNOWN_DIAGNOSTIC");
  expect(safeTrialCode("TRIAL_ALREADY_BOUND")).toBe("TRIAL_ALREADY_BOUND");
});
