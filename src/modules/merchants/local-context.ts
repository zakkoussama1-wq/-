import { sessionMerchant, merchantExists } from "../auth/store";
/** Private endpoints use only the authenticated session. Public storefront selection is explicit. */
export async function localMerchantId(request?: Request, publicStore = false) {
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
  return process.env.LOCAL_MERCHANT_ID || "local-development-merchant";
}
