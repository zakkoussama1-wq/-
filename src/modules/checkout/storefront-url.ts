/** Carry explicit public storefront selection; never used to select an admin tenant. */
export function storefrontUrl(path: string) {
  if (typeof window === "undefined") return path;
  const current = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  const store = current.get("store");
  if (store) params.set("store", store);
  if (window.location.pathname === "/form")
    for (const product of current.getAll("product"))
      params.append("product", product);
  return params.size
    ? `${path}${path.includes("?") ? "&" : "?"}${params}`
    : path;
}
