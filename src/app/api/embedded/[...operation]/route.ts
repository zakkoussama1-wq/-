import { embeddedRequest } from "@/modules/embedded/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ operation: string[] }> };
export async function GET(request: Request, context: Context) {
  return embeddedRequest(request, (await context.params).operation.join("/"));
}
export async function POST(request: Request, context: Context) {
  return embeddedRequest(request, (await context.params).operation.join("/"));
}
