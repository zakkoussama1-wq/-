import { storefrontRequest } from "@/modules/storefront/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ operation: string }> };
export async function GET(request: Request, context: Context) {
  return storefrontRequest(request, (await context.params).operation);
}
export async function POST(request: Request, context: Context) {
  return storefrontRequest(request, (await context.params).operation);
}
