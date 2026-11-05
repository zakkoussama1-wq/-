import { z } from "zod";
import { authenticatedShopTenant } from "@/modules/merchants/local-context";
import { prepareOrderTrial } from "@/modules/orders/shopify/outbox";
import { SyncFailure } from "@/modules/orders/shopify/types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const url = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${url.protocol}//${request.headers.get("host") ?? url.host}`
  )
    return Response.json({ code: "ORIGIN_DENIED" }, { status: 403, headers });
  let merchant: string;
  try {
    merchant = (await authenticatedShopTenant(request)).merchantId;
  } catch {
    return Response.json({ code: "AUTH_REQUIRED" }, { status: 401, headers });
  }
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 1024)
      return Response.json(
        { code: "REQUEST_TOO_LARGE" },
        { status: 413, headers },
      );
    const { id } = z.object({ id: z.uuid() }).strict().parse(JSON.parse(text));
    return Response.json(await prepareOrderTrial(merchant, id), { headers });
  } catch (error) {
    return Response.json(
      {
        code:
          error instanceof SyncFailure
            ? error.code
            : "TRIAL_PREPARATION_FAILED",
      },
      { status: 409, headers },
    );
  }
}
