import { sessionMerchant, merchantExists, validSession } from "../auth/store";
import { isLocalDemo } from "../../lib/local-demo";
import { verifiedShopForMerchant } from "./shops";
export class TenantAccessError extends RangeError {
  constructor(
    public code:
      | "AUTH_REQUIRED"
      | "MERCHANT_SESSION_REQUIRED"
      | "SHOPIFY_CONNECTION_REQUIRED"
      | "TENANT_FORBIDDEN",
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authenticatedShopTenant(request: Request) {
  const token =
    request.headers
      .get("cookie")
      ?.match(/(?:^|; )dz_session=([a-f0-9]+)/)?.[1] ?? "";
  const merchant = await sessionMerchant(token);
  if (!merchant) {
    if (await validSession(token))
      throw new TenantAccessError(
        "MERCHANT_SESSION_REQUIRED",
        403,
        "جلسة الإدارة لا تحدد تاجرًا. سجّل الدخول بحساب التاجر المرتبط بالمتجر.",
      );
    throw new TenantAccessError(
      "AUTH_REQUIRED",
      401,
      "يلزم تسجيل الدخول بحساب التاجر من لوحة التحكم.",
    );
  }
  let tenant: Awaited<ReturnType<typeof verifiedShopForMerchant>>;
  try {
    tenant = await verifiedShopForMerchant(merchant);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Verified Shopify installation required"
    )
      throw new TenantAccessError(
        "SHOPIFY_CONNECTION_REQUIRED",
        409,
        "هذا الحساب لا يرتبط بمتجر Shopify موثّق.",
      );
    throw error;
  }
  const requested = new URL(request.url).searchParams.get("store");
  if (requested && requested !== tenant.merchantId)
    throw new TenantAccessError(
      "TENANT_FORBIDDEN",
      403,
      "لا يمكن الوصول إلى متجر آخر.",
    );
  return tenant;
}
/** Private endpoints use only the authenticated session. Public storefront selection is explicit. */
export async function localMerchantId(request?: Request, publicStore = false) {
  if (process.env.NODE_ENV === "production") {
    if (!request) throw new RangeError("Authenticated Shopify tenant required");
    return (await authenticatedShopTenant(request)).merchantId;
  }
  if (request) {
    const store = new URL(request.url).searchParams.get("store");
    if (publicStore && store) {
      if (!/^[a-f0-9-]{36}$/.test(store))
        throw new RangeError("معرف المتجر غير صالح.");
      if (!(await merchantExists(store)))
        throw new RangeError("المتجر غير موجود.");
      return store;
    }
    const token =
      request.headers
        .get("cookie")
        ?.match(/(?:^|; )dz_session=([a-f0-9]+)/)?.[1] ?? "";
    const merchant = await sessionMerchant(token);
    if (merchant) return merchant;
  }
  if (
    isLocalDemo() ||
    process.env.NODE_ENV === "test" ||
    (process.env.NODE_ENV === "development" &&
      process.env.DZ_AUTH_TEST_BYPASS === "1")
  )
    return process.env.LOCAL_MERCHANT_ID || "local-development-merchant";
  throw new RangeError("Authenticated tenant identity required");
}
