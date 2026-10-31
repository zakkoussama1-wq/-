/** Carry explicit public storefront selection; never used to select an admin tenant. */
export function storefrontUrl(path: string) {
  if (typeof window === "undefined") return path;
  const store = new URLSearchParams(window.location.search).get("store");
  return store
    ? `${path}${path.includes("?") ? "&" : "?"}store=${encodeURIComponent(store)}`
    : path;
}
