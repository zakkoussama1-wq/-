import type { FormSettings } from "../forms/settings";
import { getFormSettings } from "../forms/repository";
import { assertFormPricing, formValidationSchema } from "../forms/policy";
import { createHash } from "node:crypto";
import type { CheckoutCatalog } from "./schema";
import type { ShippingState } from "../shipping/schema";
import { getCheckoutCatalog } from "./repository";
import {
  pricingInputSchema,
  type PricingInput,
  type CheckoutQuote,
} from "./schema";
import { amounts, toMinor } from "./money";
import { getShippingState } from "../shipping/repository";
import { quoteShippingFromState } from "../shipping/service";
export class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
/** Canonical server pricing entry point, reusable by Phase 5 order creation. */
export async function priceCheckout(
  merchant: string,
  input: PricingInput,
  formSettings?: FormSettings,
): Promise<CheckoutQuote> {
  const data = pricingInputSchema.parse(input);
  return priceCheckoutSnapshot(
    merchant,
    data,
    await getCheckoutCatalog(merchant),
    await getShippingState(merchant, data.mode),
    formSettings,
  );
}
export async function priceCheckoutSnapshot(
  merchant: string,
  data: PricingInput,
  catalog: CheckoutCatalog,
  shipping: ShippingState,
  formSettings?: FormSettings,
): Promise<CheckoutQuote> {
  const settings = formSettings ?? (await getFormSettings(merchant));
  assertFormPricing(settings, data);
  const product = catalog.products.find((p) => p.id === data.productId);
  const variant = product?.variants.find((v) => v.id === data.variantId);
  if (!product || !variant || !product.active || product.deleted)
    throw new CheckoutError("المنتج أو الخيار المحدد غير متاح.", 400);
  if (variant.stock !== null && variant.stock < data.quantity)
    throw new CheckoutError("الكمية المطلوبة غير متوفرة في المخزون.");
  const totals = amounts(variant.priceMinor, data.quantity, catalog.discount);
  const method = async (method: "home" | "office") => {
    const quote = await quoteShippingFromState(shipping, {
      mode: data.mode,
      wilayaCode: data.wilayaCode,
      communeId: data.communeId,
      method,
    });
    if (settings.deliveryMode !== "both" && settings.deliveryMode !== method) {
      quote.available = false;
      quote.amount = null;
      quote.reason = "طريقة التوصيل غير متاحة في هذا النموذج.";
    }
    const amountMinor = quote.available ? toMinor(quote.amount!) : null;
    return {
      available: quote.available,
      amountMinor,
      totalMinor: amountMinor === null ? null : totals.netMinor + amountMinor,
      source: quote.source,
      reason: quote.reason,
      eta: quote.eta,
    };
  };
  const methods = {
    home: await method("home"),
    office: await method("office"),
  };
  const quoteToken = createHash("sha256")
    .update(
      JSON.stringify({
        merchant,
        input: data,
        priceMinor: variant.priceMinor,
        discount: catalog.discount,
        revision: catalog.revision,
        shippingRevision: shipping.revision,
        formPolicy: {
          deliveryMode: settings.deliveryMode,
          elements: settings.elements,
          contact: settings.contact,
          administrativeMode: settings.administrativeMode,
          fixedWilaya: settings.fixedWilaya,
          fixedCommune: settings.fixedCommune,
          featuredProductId: settings.featuredProductId,
          featuredVariantId: settings.featuredVariantId,
        },
        totals,
        methods,
      }),
    )
    .digest("hex");
  return {
    input: data,
    unitPriceMinor: variant.priceMinor,
    subtotalMinor: totals.subtotalMinor,
    discountMinor: totals.discountMinor,
    methods,
    quoteToken,
    demo: product.demo,
  };
}
export async function validateCheckout(
  merchant: string,
  raw: unknown,
  productFormId?: string,
) {
  const settings = await getFormSettings(merchant, productFormId);
  const { customer, quoteToken } = formValidationSchema(settings).parse(raw);
  const { productId, variantId, quantity, mode, wilayaCode, communeId } =
    customer;
  const quote = await priceCheckout(
    merchant,
    {
      productId,
      variantId,
      quantity,
      mode,
      wilayaCode,
      communeId,
    },
    settings,
  );
  const method = quote.methods[customer.method];
  if (!method.available) throw new CheckoutError(method.reason);
  if (quoteToken !== quote.quoteToken)
    throw new CheckoutError(
      "تغيرت الأسعار أو الإعدادات. حدّث الحساب وراجع الإجمالي ثم أكد مجددًا.",
      409,
    );
  // Intentionally no storage, order IDs, conversion tracking, or side effects with customer data.
  return {
    validated: true as const,
    persisted: false as const,
    quote,
    message:
      "تم التحقق من بيانات الطلب وتسعيره على الخادم. لم يُنشأ أو يُحفظ طلب؛ الحفظ متاح في المرحلة الخامسة.",
  };
}
