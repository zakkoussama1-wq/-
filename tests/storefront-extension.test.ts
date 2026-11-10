import { createReadBudget } from "../src/modules/storefront/budget";
import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createContext,
  verifyContext,
} from "../src/modules/storefront/context";
import { vi, afterEach } from "vitest";
afterEach(() => vi.unstubAllEnvs());
it("declares a product-only inline Theme App Block with editable presentation and a validation notice", () => {
  const liquid = readFileSync(
    "extensions/dz-cod-form/blocks/cod-form.liquid",
    "utf8",
  );
  const schema = JSON.parse(
    liquid.split("{% schema %}")[1].split("{% endschema %}")[0],
  );
  expect(schema).toMatchObject({
    target: "section",
    javascript: "dz-cod.js",
    enabled_on: { templates: ["product"] },
  });
  expect(schema.settings.map((s: { id?: string }) => s.id)).toEqual(
    expect.arrayContaining([
      "title",
      "button_text",
      "intro_text",
      "footer_text",
      "language",
      "accent",
      "background",
      "ink",
      "width",
      "align",
      "proxy_path",
    ]),
  );
  expect(liquid).toContain("dz_product.selected_or_first_available_variant.id");
  expect(liquid).toContain("closest.product | default: product");
  expect(liquid).toContain("'dz-cod-runtime.js' | asset_url | escape");
  expect(
    readFileSync("extensions/dz-cod-form/assets/dz-cod.js").byteLength,
  ).toBeLessThanOrEqual(10000);
  expect(liquid).not.toMatch(/<iframe|<dialog|window.open|access_token/i);
});
it("scopes the signed form capability and rejects expiration and tampering", () => {
  vi.stubEnv("SHOPIFY_CLIENT_SECRET", "synthetic-secret");
  const product = "gid://shopify/Product/1",
    shop = "fixture.myshopify.com",
    origin = "https://fixture-store.example";
  const context = createContext(shop, product, origin);
  expect(verifyContext(context, shop, product, origin)).toMatchObject({
    shop,
    product,
    origin,
  });
  expect(() =>
    verifyContext(context, shop, "gid://shopify/Product/2", origin),
  ).toThrow("CONTEXT_EXPIRED_OR_INVALID");
  expect(() => verifyContext(context + "x", shop, product, origin)).toThrow();
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 11 * 60000);
  try {
    expect(() => verifyContext(context, shop, product, origin)).toThrow(
      "CONTEXT_EXPIRED_OR_INVALID",
    );
  } finally {
    vi.useRealTimers();
  }
});

it("bounds per-shop read work without persisting shopper or customer data", () => {
  let now = 0;
  const consume = createReadBudget(2, () => now);
  consume("a.myshopify.com");
  consume("a.myshopify.com");
  expect(() => consume("a.myshopify.com")).toThrow("RATE_LIMITED");
  expect(() => consume("b.myshopify.com")).not.toThrow();
  now = 61000;
  expect(() => consume("a.myshopify.com")).not.toThrow();
});
