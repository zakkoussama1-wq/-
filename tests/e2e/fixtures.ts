import { test as base } from "@playwright/test";
import { defaultFormSettings } from "../../src/modules/forms/settings";
export { expect, type Page, type APIRequestContext } from "@playwright/test";
// Legacy feature scenarios explicitly enable the optional controls they exercise.
// Compact, hidden-by-default controls are covered separately by test:local.
export const test = base.extend<{ fullForm: undefined }>({
  fullForm: [
    async ({ request }, use) => {
      const response = await request.post("/api/form-config", {
        headers: { origin: "http://127.0.0.1:3000" },
        data: {
          ...defaultFormSettings,
          defaultMethod: "home",
          elements: {
            ...defaultFormSettings.elements,
            productSelector: true,
            variant: true,
            locationSearch: true,
            administrativeMode: true,
          },
        },
      });
      if (!response.ok())
        throw new Error(
          "Cannot configure optional form controls for feature regression tests.",
        );
      await use(undefined);
    },
    { auto: true },
  ],
});
