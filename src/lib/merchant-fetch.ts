/** Existing standalone callers keep their cookie transport. Embedded callers use
 * fresh App Bridge tokens on a strict same-origin API allowlist, never storage. */
export function inEmbeddedAdmin() {
  return (
    typeof window !== "undefined" &&
    /^\/shopify(?:\/|$)/.test(window.location.pathname)
  );
}
export async function embeddedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  if (typeof window === "undefined")
    throw new Error("Embedded browser required");
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    window.location.origin,
  );
  if (
    url.origin !== window.location.origin ||
    !url.pathname.startsWith("/api/embedded/")
  )
    throw new Error("Embedded endpoint unavailable");
  const expires = Date.now() + 10000;
  while (!window.shopify?.idToken) {
    if (Date.now() >= expires)
      throw new Error(
        "App Bridge unavailable. Open the app from Shopify Admin.",
      );
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const headers = new Headers(init?.headers);
  let token: string;
  try {
    token = await window.shopify.idToken();
    if (typeof token !== "string" || !token || token.length > 4096)
      throw new Error();
  } catch {
    throw new Error("تعذر التحقق من جلسة Shopify. أعد فتح التطبيق من Apps.");
  }
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  if (response.status === 401)
    window.dispatchEvent(new Event("dz:embedded-session-expired"));
  return response;
}
export const merchantFetch: typeof fetch = (input, init) => {
  if (!inEmbeddedAdmin()) return fetch(input, init);
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    window.location.origin,
  );
  const mapping: Record<string, string> = {
    "/api/shipping": "shipping",
    "/api/shipping/quote": "shipping/quote",
    "/api/shipping/csv": "shipping/csv",
    "/api/geography/wilayas": "wilayas",
    "/api/geography/communes": "communes",
  };
  if (
    url.origin !== window.location.origin ||
    !Object.hasOwn(mapping, url.pathname)
  )
    return Promise.reject(new Error("Embedded endpoint unavailable"));
  url.pathname = "/api/embedded/" + mapping[url.pathname];
  return embeddedFetch(url, init);
};
