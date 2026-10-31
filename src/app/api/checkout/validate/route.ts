import { checkoutPost } from "@/modules/checkout/http";
export const runtime = "nodejs";
export function POST(request: Request) {
  return checkoutPost(request, "validate");
}
