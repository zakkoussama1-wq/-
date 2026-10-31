// Module boundaries. Geography and local shipping are implemented; authentication remains future work.
export type MerchantId = string & {
  readonly merchantId: unique symbol;
};
export type MoneyDzd = number;
export interface Merchant {
  id: MerchantId;
  name: string;
}
export interface Session {
  merchantId: MerchantId;
  expiresAt: Date;
}
export interface Product {
  id: string;
  merchantId: MerchantId;
  name: string;
  price: MoneyDzd;
  variants: {
    id: string;
    name: string;
  }[];
}
export type AdministrativeMode = "legacy58" | "updated69";
export interface Wilaya {
  id: string;
  code: string;
  nameAr: string;
  nameLatin?: string;
  mode: AdministrativeMode;
}
export interface Commune {
  id: string;
  wilayaId: string;
  nameAr: string;
  nameLatin?: string;
  mode: AdministrativeMode;
}
export type DeliveryMethod = "home" | "office";
export interface ShippingQuote {
  available: boolean;
  amount: MoneyDzd | null;
  source: "commune" | "wilaya" | "default" | "unavailable";
}
export interface ShippingService {
  quote(
    merchantId: MerchantId,
    input: {
      mode: AdministrativeMode;
      wilayaCode: string;
      communeId: string;
      method: DeliveryMethod;
    },
  ): Promise<ShippingQuote>;
}
export interface FormSettings {
  merchantId: MerchantId;
  title: string;
  buttonColor: string;
  successMessage: string;
}
export type OrderStatus = "submitted" | "confirmed" | "fulfilled" | "cancelled";
export interface Order {
  id: string;
  merchantId: MerchantId;
  status: OrderStatus;
  total: MoneyDzd;
  createdAt: Date;
}
export interface Analytics {
  submissions: number;
  confirmed: number;
  fulfilled: number;
}
export interface ShopifyAdapter {
  syncProducts(merchantId: MerchantId): Promise<void>;
  createCodOrder(merchantId: MerchantId, orderId: string): Promise<string>;
}
export interface TrackingAdapter {
  send(event: {
    merchantId: MerchantId;
    eventId: string;
    type: "order_submitted";
    consent: boolean;
    testMode: boolean;
  }): Promise<void>;
}
