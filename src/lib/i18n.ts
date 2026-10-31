export const locale = {
  code: "ar-DZ",
  direction: "rtl",
  currency: "DZD",
} as const;
export function formatDzd(amount: number) {
  return new Intl.NumberFormat(
    typeof document === "undefined"
      ? locale.code
      : ({ ar: "ar-DZ", fr: "fr-DZ", en: "en-DZ" }[
          document.documentElement.lang
        ] ?? locale.code),
    {
      style: "currency",
      currency: locale.currency,
      maximumFractionDigits: 2,
    },
  ).format(amount);
}
