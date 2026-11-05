export type Locale = "ar" | "fr" | "en";
const words: Record<string, readonly [string, string, string]> = {
  rate: [
    "طلبات كثيرة؛ انتظر دقيقة ثم أعد المحاولة.",
    "Too many requests; wait a minute and retry.",
    "Trop de requêtes ; attendez une minute puis réessayez.",
  ],
  title: [
    "اطلب منتجك بالدفع عند الاستلام",
    "Cash on delivery order",
    "Commande avec paiement à la livraison",
  ],
  phase: [
    "معاينة المرحلة الثانية: التحقق فقط؛ لن يُحفظ أو يُرسل طلب.",
    "Phase 2 preview: validation only; no order will be saved or sent.",
    "Aperçu phase 2 : validation uniquement ; aucune commande enregistrée ou envoyée.",
  ],
  name: ["الاسم واللقب", "Full name", "Nom et prénom"],
  phone: ["رقم الهاتف", "Phone number", "Numéro de téléphone"],
  wilaya: ["الولاية", "Wilaya", "Wilaya"],
  commune: ["البلدية", "Commune", "Commune"],
  choose: ["اختر…", "Choose…", "Choisir…"],
  variant: ["اللون أو المقاس", "Colour or size", "Couleur ou taille"],
  quantity: ["الكمية", "Quantity", "Quantité"],
  home: ["التوصيل إلى المنزل", "Home delivery", "Livraison à domicile"],
  office: [
    "التوصيل إلى المكتب العام",
    "Generic office pickup",
    "Retrait en bureau générique",
  ],
  method: ["طريقة التوصيل", "Delivery method", "Mode de livraison"],
  address: ["عنوان المنزل", "Home address", "Adresse du domicile"],
  subtotal: ["المنتجات", "Products", "Produits"],
  discount: ["الخصم", "Discount", "Remise"],
  shipping: ["التوصيل", "Delivery", "Livraison"],
  total: ["الإجمالي", "Total", "Total"],
  check: ["التحقق من الطلب", "Validate order", "Vérifier la commande"],
  loading: ["جارٍ التحميل…", "Loading…", "Chargement…"],
  checking: ["جارٍ التحقق…", "Validating…", "Vérification…"],
  unavailable: [
    "غير متاح أو لم يُضبط سعره",
    "Unavailable or not priced",
    "Indisponible ou tarif non configuré",
  ],
  stock: ["الكمية غير متوفرة", "Quantity unavailable", "Quantité indisponible"],
  valid: [
    "تم التحقق من البيانات والسعر. لم يُحفظ طلب ولم يُنشأ طلب Shopify.",
    "Details and price validated. No local or Shopify order was created.",
    "Données et prix vérifiés. Aucune commande locale ou Shopify créée.",
  ],
  privacy: [
    "تُرسل البيانات للتحقق فقط ولا تُحفظ في هذه المرحلة.",
    "Data is sent only for validation and is not saved in this phase.",
    "Données envoyées uniquement pour vérification, sans enregistrement à cette phase.",
  ],
  retry: ["إعادة تحميل النموذج", "Reload form", "Recharger le formulaire"],
  invalid: [
    "تحقق من الاسم ورقم الهاتف والمنطقة والعنوان.",
    "Check name, phone, location and address.",
    "Vérifiez le nom, téléphone, zone et adresse.",
  ],
  network: [
    "تعذر تحميل الأسعار. أعد المحاولة.",
    "Could not load prices. Please retry.",
    "Chargement des tarifs impossible. Réessayez.",
  ],
  changed: [
    "تغيرت الأسعار؛ راجع الإجمالي الجديد ثم تحقق مجددًا.",
    "Prices changed; review the new total and validate again.",
    "Les prix ont changé ; vérifiez le nouveau total puis réessayez.",
  ],
  expired: [
    "انتهت جلسة النموذج. أعد تحميله للمتابعة.",
    "Form session expired. Reload to continue.",
    "Session du formulaire expirée. Rechargez pour continuer.",
  ],
  disabled: [
    "النموذج غير متاح حاليًا؛ لم يُرسل أي طلب.",
    "Form currently unavailable; no order was sent.",
    "Formulaire indisponible ; aucune commande envoyée.",
  ],
  minus: ["تقليل الكمية", "Decrease quantity", "Réduire la quantité"],
  plus: ["زيادة الكمية", "Increase quantity", "Augmenter la quantité"],
};
export function text(key: string, language: Locale) {
  return (words[key] ?? words.network)[
    language === "en" ? 1 : language === "fr" ? 2 : 0
  ];
}
export function errorText(code: unknown, language: Locale) {
  return text(
    code === "RATE_LIMITED"
      ? "rate"
      : code === "INVALID_INPUT"
        ? "invalid"
        : code === "PRICE_CHANGED"
          ? "changed"
          : code === "CONTEXT_EXPIRED_OR_INVALID"
            ? "expired"
            : code === "PRODUCT_UNAVAILABLE" || code === "STOREFRONT_DISABLED"
              ? "disabled"
              : code === "DELIVERY_UNAVAILABLE" || code === "QUOTE_UNAVAILABLE"
                ? "unavailable"
                : "network",
    language,
  );
}
