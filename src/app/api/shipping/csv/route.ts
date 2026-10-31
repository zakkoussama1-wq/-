import { readShipping } from "@/modules/shipping/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return await readShipping(request, true);
}
