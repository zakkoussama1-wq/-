import { it, expect } from "vitest";
import {
  defaultFormSettings,
  formSettingsSchema,
} from "../src/modules/forms/settings";
it("preserves every fulfillment field and rejects invalid style injection", () => {
  expect(formSettingsSchema.safeParse(defaultFormSettings).success).toBe(true);
  expect(
    formSettingsSchema.safeParse({
      ...defaultFormSettings,
      order: defaultFormSettings.order.slice(1),
    }).success,
  ).toBe(false);
  expect(
    formSettingsSchema.safeParse({
      ...defaultFormSettings,
      order: Array(7).fill("name"),
    }).success,
  ).toBe(false);
  expect(
    formSettingsSchema.safeParse({
      ...defaultFormSettings,
      buttonColor: "url(javascript:bad)",
    }).success,
  ).toBe(false);
});
