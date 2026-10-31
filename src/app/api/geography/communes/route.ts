import { geographyResponse } from "@/modules/geography/http";
export const runtime = "nodejs";
export function GET(request: Request) {
  return geographyResponse(request, "communes");
}
