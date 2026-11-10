import { storefrontCustomerSchema } from "./settings";
import { consumeReadBudget } from "./budget";
import { z } from "zod";
import { listWilayas, listCommunes } from "../geography/repository";
import {
  pricingInputSchema,
  checkoutSchemaForSettings,
} from "../checkout/schema";
import { priceCheckoutSnapshot, CheckoutError } from "../checkout/service";
import {
  proxyShop,
  productIdSchema,
  createContext,
  verifyContext,
  StorefrontError,
} from "./context";
import { readStorefrontData } from "./data";
import { shopifyConfiguration } from "../integrations/shopify/sdk";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function storefrontRequest(request: Request, operation: string) {
  return storefrontForRequest(request, operation, () => proxyShop(request));
}
/** Only server-side embedded handlers may supply a JWT-verified tenant. */
export async function storefrontForRequest(
  request: Request,
  operation: string,
  authenticate: () => Promise<string>,
  preview = false,
) {
  try {
    const methods: Record<string, string> = {
      bootstrap: "GET",
      communes: "GET",
      quote: "POST",
      validate: "POST",
    };
    if (!Object.hasOwn(methods, operation))
      return Response.json({ code: "NOT_FOUND" }, { status: 404, headers });
    if (request.method !== methods[operation])
      return Response.json(
        { code: "METHOD_NOT_ALLOWED" },
        { status: 405, headers: { ...headers, Allow: methods[operation] } },
      );
    const shop = await authenticate(),
      url = new URL(request.url);
    consumeReadBudget(shop);
    if (operation === "communes") {
      const wilaya = z
        .string()
        .regex(/^(0[1-9]|[1-4][0-9]|5[0-8])$/)
        .parse(url.searchParams.get("wilaya"));
      return Response.json(
        { items: listCommunes("legacy58", wilaya) },
        { headers },
      );
    }
    let raw: unknown;
    if (request.method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new StorefrontError("JSON_REQUIRED", 415);
      const text = await request.text();
      if (Buffer.byteLength(text) > 8192)
        throw new StorefrontError("BODY_TOO_LARGE", 413);
      try {
        raw = JSON.parse(text);
      } catch {
        throw new StorefrontError("INVALID_INPUT", 400);
      }
    }
    const body =
      operation === "quote"
        ? z
            .object({
              context: z.string().max(2048),
              input: pricingInputSchema,
            })
            .strict()
            .parse(raw)
        : operation === "validate"
          ? z
              .object({
                context: z.string().max(2048),
                customer: storefrontCustomerSchema,
                quoteToken: z.string().regex(/^[a-f0-9]{64}$/),
              })
              .strict()
              .parse(raw)
          : null;
    const productId =
      operation === "bootstrap"
        ? productIdSchema.parse(url.searchParams.get("product"))
        : body &&
          ("input" in body ? body.input.productId : body.customer.productId);
    if (!productId) throw new StorefrontError("INVALID_INPUT", 400);
    if (
      body &&
      ("input" in body ? body.input.mode : body.customer.mode) !== "legacy58"
    )
      throw new StorefrontError("INVALID_INPUT", 400);
    if (body)
      verifyContext(
        body.context,
        shop,
        productId,
        request.headers.get("origin"),
      );
    const data = await readStorefrontData(shop, productId);
    if (operation === "bootstrap") {
      const origin = z.url().parse(url.searchParams.get("origin"));
      if (
        !(preview
          ? origin === shopifyConfiguration().origin
          : data.origins.includes(origin))
      )
        throw new StorefrontError("ORIGIN_DENIED", 403);
      return Response.json(
        {
          phase: 2,
          submission: "validate_only",
          context: createContext(shop, productId, origin),
          product: data.catalog.products[0],
          wilayas: listWilayas("legacy58"),
          genericOffice: data.shipping.genericOffice,
          design: {
            ...data.settings,
            officePickupInstructions:
              data.settings.officePickupInstructions ?? "",
          },
        },
        { headers },
      );
    }
    const input = body && ("input" in body ? body.input : body.customer);
    if (input?.mode !== "legacy58")
      throw new StorefrontError("INVALID_INPUT", 400);
    const parsed = pricingInputSchema.parse(
      Object.fromEntries(
        [
          "productId",
          "variantId",
          "quantity",
          "mode",
          "wilayaCode",
          "communeId",
        ].map((k) => [k, input[k as keyof typeof input]]),
      ),
    );
    const quote = await priceCheckoutSnapshot(
      data.merchant,
      parsed,
      data.catalog,
      data.shipping,
      data.settings,
    );
    if (operation === "quote") return Response.json(quote, { headers });
    if (!body || !("customer" in body))
      throw new StorefrontError("INVALID_INPUT", 400);
    checkoutSchemaForSettings(data.settings.contact).parse(body.customer);
    if (!quote.methods[body.customer.method].available)
      throw new StorefrontError("DELIVERY_UNAVAILABLE", 422);
    if (quote.quoteToken !== body.quoteToken)
      throw new StorefrontError("PRICE_CHANGED", 409);
    return Response.json(
      { validated: true, persisted: false, shopifyOrderCreated: false, quote },
      { headers },
    );
  } catch (error) {
    const code =
      error instanceof StorefrontError
        ? error.code
        : error instanceof z.ZodError || error instanceof RangeError
          ? "INVALID_INPUT"
          : error instanceof CheckoutError
            ? "QUOTE_UNAVAILABLE"
            : "STOREFRONT_UNAVAILABLE";
    const status =
      error instanceof StorefrontError
        ? error.status
        : error instanceof z.ZodError || error instanceof RangeError
          ? 400
          : error instanceof CheckoutError
            ? error.status
            : 503;
    return Response.json(
      { code },
      {
        status,
        headers: {
          ...headers,
          ...(status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  }
}
