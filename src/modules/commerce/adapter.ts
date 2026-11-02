import { priceCheckout } from "../checkout/service";
import { getFormSettings } from "../forms/repository";
import type { CheckoutQuote, PricingInput } from "../checkout/schema";
import type { CheckoutCatalog } from "../checkout/schema";
import type { StoredOrder } from "../orders/repository";
import { getCheckoutCatalog } from "../checkout/repository";
import { createOrder, listOrders } from "../orders/repository";
import {
  readShopifyCatalog,
  shopifyCatalogMode,
} from "../integrations/shopify/catalog";
/** Future providers must own authoritative catalog/pricing/order validation.
 * No OAuth, provider transport, or credentials are implemented here.
 */
export interface CommerceAdapter {
  readonly source: "local" | "shopify";
  quote(
    merchant: string,
    input: PricingInput,
    productId?: string,
  ): Promise<CheckoutQuote>;
  catalog(merchant: string): Promise<CheckoutCatalog>;
  submit(
    merchant: string,
    input: unknown,
    idempotencyKey: string,
    productId?: string,
  ): Promise<{ order: StoredOrder; duplicate: boolean }>;
  orders(merchant: string): Promise<StoredOrder[]>;
}
export const localCommerceAdapter: CommerceAdapter = {
  source: "local",
  quote: async (merchant, input, productId) =>
    process.env.NODE_ENV === "production"
      ? Promise.reject(new Error("Shopify commerce adapter required"))
      : priceCheckout(
          merchant,
          input,
          await getFormSettings(merchant, productId),
        ),
  catalog: (merchant) =>
    shopifyCatalogMode()
      ? readShopifyCatalog(merchant)
      : getCheckoutCatalog(merchant),
  submit: (...args) =>
    process.env.NODE_ENV === "production"
      ? Promise.reject(new Error("Shopify order workflow is not implemented"))
      : createOrder(...args),
  orders: listOrders,
};
