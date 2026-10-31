import { readShipping, writeShipping } from "@/modules/shipping/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return await readShipping(request);
}
export function POST(request: Request) {
  return writeShipping(request);
}
