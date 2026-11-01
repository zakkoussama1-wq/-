import type { FormSettings } from "./settings";
/** Product-specific presentation, derived per request; never overwrites the merchant template. */
export function productFormSettings(
  settings: FormSettings,
  productId?: string,
): FormSettings {
  if (productId === undefined) return settings;
  if (
    !productId ||
    productId.length > 100 ||
    [...productId].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new RangeError("معرف المنتج غير صالح.");
  return {
    ...settings,
    featuredProductId: productId,
    featuredVariantId: "",
    elements: {
      ...settings.elements,
      productSelector: false,
      variant: true,
      quantity: true,
      productImage: true,
      productTitle: true,
      productPrice: true,
      locationSearch: true,
    },
    order: [
      "variant",
      "quantity",
      ...settings.order.filter(
        (key) => key !== "variant" && key !== "quantity",
      ),
    ],
  };
}
export function requestedProduct(request: Request) {
  const values = new URL(request.url).searchParams.getAll("product");
  if (!values.length) return undefined;
  if (
    values.length !== 1 ||
    !values[0] ||
    values[0].length > 100 ||
    [...values[0]].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new RangeError("معرف المنتج غير صالح.");
  return values[0];
}
export function productFormLink(id: string, store?: string | null) {
  const query = new URLSearchParams({ product: id });
  if (store) query.set("store", store);
  return "/form?" + query.toString();
}
