import { z } from "zod";
import { embeddedTenant, embeddedMutationOrigin, EmbeddedError } from "./auth";
import { getFormSettings } from "../forms/repository";
import { formSettingsSchema } from "../forms/settings";
import { authDb } from "../auth/store";
import { administrativeModeSchema } from "../geography/schema";
import { listWilayas, listCommunes } from "../geography/repository";
import {
  getShippingState,
  changeShipping,
  ConflictError,
} from "../shipping/repository";
import { mutationSchema, quoteSchema } from "../shipping/schema";
import { importShippingCsv, exportShippingCsv } from "../shipping/csv";
import { quoteShipping } from "../shipping/service";
import { embeddedCatalog } from "./catalog";
import { storefrontForRequest } from "../storefront/http";
import { connectionCredential } from "../integrations/shopify/connections";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
async function json(request: Request, limit: number) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new EmbeddedError("JSON_REQUIRED", 415);
  const value = await request.text();
  if (Buffer.byteLength(value) > limit)
    throw new EmbeddedError("BODY_TOO_LARGE", 413);
  try {
    return JSON.parse(value);
  } catch {
    throw new EmbeddedError("INVALID_INPUT", 400);
  }
}
export async function embeddedRequest(request: Request, operation: string) {
  try {
    const methods: Record<string, string[]> = {
      session: ["GET"],
      "form-config": ["GET", "POST"],
      catalog: ["GET"],
      shipping: ["GET", "POST"],
      "shipping/csv": ["GET"],
      "shipping/quote": ["GET"],
      wilayas: ["GET"],
      communes: ["GET"],
      integrations: ["GET"],
      "preview/bootstrap": ["GET"],
      "preview/communes": ["GET"],
      "preview/quote": ["POST"],
      "preview/validate": ["POST"],
    };
    if (!Object.hasOwn(methods, operation))
      throw new EmbeddedError("NOT_FOUND", 404);
    if (!methods[operation].includes(request.method))
      throw new EmbeddedError("METHOD_NOT_ALLOWED", 405);
    const tenant = await embeddedTenant(request);
    if (request.method === "POST") embeddedMutationOrigin(request);
    const url = new URL(request.url);
    if (operation.startsWith("preview/"))
      return storefrontForRequest(
        request,
        operation.slice(8),
        async () => tenant.domain,
        true,
      );
    if (operation === "session")
      return Response.json(
        { connected: true, shop: tenant.domain },
        { headers },
      );
    if (operation === "form-config") {
      if (request.method === "GET")
        return Response.json(await getFormSettings(tenant.merchantId), {
          headers,
        });
      const settings = formSettingsSchema.parse(await json(request, 8192));
      if (settings.administrativeMode !== "legacy58")
        throw new EmbeddedError("STOREFRONT_POLICY_UNSUPPORTED", 422);
      if (
        !settings.elements.geography &&
        !listCommunes("legacy58", settings.fixedWilaya).some(
          (c) => c.id === settings.fixedCommune,
        )
      )
        throw new EmbeddedError("FIXED_LOCATION_INVALID", 422);
      const db = await authDb();
      try {
        await db
          .prepare(
            "INSERT INTO form_settings VALUES(?,?) ON CONFLICT(merchant_id) DO UPDATE SET settings=excluded.settings",
          )
          .run(tenant.merchantId, JSON.stringify(settings));
      } finally {
        await db.close();
      }
      return Response.json({ saved: true }, { headers });
    }
    if (operation === "catalog")
      return Response.json(await embeddedCatalog(tenant), { headers });
    if (operation === "integrations") {
      const credential = await connectionCredential(
        tenant.merchantId,
        false,
        false,
      );
      if (credential.shop !== tenant.domain)
        throw new EmbeddedError("SHOP_BINDING_INVALID", 403);
      const response = await fetch(
        `https://${tenant.domain}/admin/api/2026-10/graphql.json`,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": credential.accessToken,
          },
          body: JSON.stringify({
            query:
              "query DzEmbeddedScopes { currentAppInstallation { accessScopes { handle } } }",
          }),
        },
      );
      const raw = await response.json();
      if (
        !response.ok ||
        response.headers.get("x-shopify-api-version") !== "2026-10" ||
        raw.errors?.length
      )
        throw new EmbeddedError("SCOPE_CHECK_FAILED", 502);
      const scopes = z
        .array(z.object({ handle: z.string() }))
        .parse(raw.data?.currentAppInstallation?.accessScopes)
        .map((s) => s.handle);
      return Response.json(
        {
          readProductsGranted:
            scopes.includes("read_products") ||
            scopes.includes("write_products"),
          writeOrdersGranted: scopes.includes("write_orders"),
          offline: credential.offline,
          sendingEnabled: false,
        },
        { headers },
      );
    }
    if (operation === "shipping/quote")
      return Response.json(
        await quoteShipping(
          tenant.merchantId,
          quoteSchema.parse(Object.fromEntries(url.searchParams)),
        ),
        { headers },
      );
    const mode = administrativeModeSchema.parse(
      url.searchParams.get("mode") ?? "legacy58",
    );
    if (operation === "wilayas")
      return Response.json(
        {
          items: listWilayas(mode),
          mode,
          verification:
            mode === "legacy58"
              ? "source-reviewed"
              : "secondary-reference-only",
        },
        { headers },
      );
    if (operation === "communes")
      return Response.json(
        {
          items: listCommunes(
            mode,
            z
              .string()
              .regex(/^\d{2}$/)
              .parse(url.searchParams.get("wilayaCode")),
          ),
          mode,
          verification:
            mode === "legacy58"
              ? "source-reviewed"
              : "secondary-reference-only",
        },
        { headers },
      );
    if (request.method === "GET") {
      const state = await getShippingState(tenant.merchantId, mode);
      return operation === "shipping/csv"
        ? new Response(exportShippingCsv(state.entries), {
            headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
          })
        : Response.json(state, { headers });
    }
    const data = mutationSchema.parse(await json(request, 1100000));
    const change =
      data.action === "import"
        ? { entries: importShippingCsv(data.csv) }
        : data.action === "save"
          ? { entries: data.entries }
          : data.action === "reset"
            ? { reset: data.targets }
            : { genericOffice: data.genericOffice };
    return Response.json(
      await changeShipping(tenant.merchantId, data.mode, data.revision, change),
      { headers },
    );
  } catch (error) {
    const code =
      error instanceof EmbeddedError
        ? error.code
        : error instanceof ConflictError
          ? "REVISION_CONFLICT"
          : error instanceof z.ZodError || error instanceof RangeError
            ? "INVALID_INPUT"
            : "EMBEDDED_UNAVAILABLE";
    const status =
      error instanceof EmbeddedError
        ? error.status
        : error instanceof ConflictError
          ? 409
          : error instanceof z.ZodError || error instanceof RangeError
            ? 400
            : 503;
    return Response.json(
      {
        code,
        error:
          status === 401
            ? "انتهت جلسة Shopify. أعد فتح التطبيق من قائمة Apps."
            : "تعذر إتمام العملية. تحقق من الإعدادات أو أعد المحاولة.",
      },
      { status, headers },
    );
  }
}
