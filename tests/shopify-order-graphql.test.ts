import { afterEach, expect, it, vi } from "vitest";
import { shopifyOrderGraph } from "../src/modules/orders/shopify/client";
afterEach(() => {
  vi.unstubAllGlobals();
});
it.each([
  [{ errors: [{ extensions: { code: "ACCESS_DENIED" } }] }, "not_created"],
  [{ errors: [{ extensions: { code: "THROTTLED" } }] }, "not_created"],
  [
    { data: null, errors: [{ extensions: { code: "ACCESS_DENIED" } }] },
    "unknown",
  ],
  [
    {
      data: { orderCreate: null },
      errors: [
        {
          extensions: { code: "ACCESS_DENIED" },
          path: ["orderCreate", "order", "lineItems"],
        },
      ],
    },
    "unknown",
  ],
  [
    {
      errors: [
        { extensions: { code: "ACCESS_DENIED" }, path: ["orderCreate"] },
      ],
    },
    "unknown",
  ],
  [
    { errors: [{ extensions: { code: "ACCESS_DENIED" }, path: null }] },
    "unknown",
  ],
  [
    { errors: [{ extensions: { code: "THROTTLED" }, path: ["orderCreate"] }] },
    "unknown",
  ],
  [
    {
      data: { orderCreate: null },
      errors: [{ extensions: { code: "THROTTLED" } }],
    },
    "unknown",
  ],
  [
    {
      errors: [
        { extensions: { code: "ACCESS_DENIED" } },
        { message: "private-data" },
      ],
    },
    "unknown",
  ],
] as const)(
  "distinguishes request rejection from potentially committed GraphQL execution %#",
  async (body, outcome) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(body, {
          headers: { "x-shopify-api-version": "2026-10" },
        }),
      ),
    );
    await expect(
      shopifyOrderGraph(
        "fixture.myshopify.com",
        "fixture-token",
      )("mutation DzCreateCod { orderCreate { order { id } } }"),
    ).rejects.toMatchObject({ outcome });
  },
);
it("retains an available order even if its response has partial GraphQL errors", async () => {
  const order = { id: "gid://shopify/Order/123" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          data: { orderCreate: { order } },
          errors: [
            {
              extensions: { code: "ACCESS_DENIED" },
              path: ["orderCreate", "order", "lineItems"],
            },
          ],
        },
        { headers: { "x-shopify-api-version": "2026-10" } },
      ),
    ),
  );
  expect(
    await shopifyOrderGraph(
      "fixture.myshopify.com",
      "fixture-token",
    )("mutation DzCreateCod { orderCreate { order { id } } }"),
  ).toEqual({ orderCreate: { order } });
});
