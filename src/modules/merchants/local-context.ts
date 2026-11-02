import { sessionMerchant, merchantExists } from "../auth/store";
import { isLocalDemo } from "../../lib/local-demo";
import { verifiedShopForMerchant } from "./shops";
export async function authenticatedShopTenant(request: Request) {
  const token =
    request.headers
      .get("cookie")
      ?.match(/(?:^|; )dz_session=([a-f0-9]+)/)?.[1] ?? "";
  const merchant = await sessionMerchant(token);
  if (!merchant) throw new RangeError("Authenticated Shopify tenant required");
  const tenant = await verifiedShopForMerchant(merchant);
  const requested = new URL(request.url).searchParams.get("store");
  if (requested && requested !== tenant.merchantId)
    throw new RangeError("Tenant selection is not authorized");
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
