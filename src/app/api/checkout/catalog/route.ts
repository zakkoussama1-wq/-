import { readCatalog } from "@/modules/checkout/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return await readCatalog(request);
}
