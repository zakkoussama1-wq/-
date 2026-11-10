// This schema asset stays under Shopify's 10 KB budget. The UI loads only near
// the viewport, except in Theme Editor where a visible, diagnosable preview wins.
(() => {
  if (document.documentElement.dataset.dzLoader === "1") return;
  document.documentElement.dataset.dzLoader = "1";
  let pending: Promise<void> | null = null;
  const watched = new WeakSet<Element>();
  const loading = new WeakSet<Element>();
  const label = (el: Element, ar: string, fr: string, en: string) => {
    const lang = el.getAttribute("data-language") ?? "ar";
    return lang.startsWith("fr") ? fr : lang.startsWith("en") ? en : ar;
  };
  const showError = (block: Element, code: string) => {
    if (customElements.get("dz-cod-form") && block.hasAttribute("data-mounted"))
      return;
    block.setAttribute("data-dz-state", code);
    const message = document.createElement("p"),
      retry = document.createElement("button");
    message.setAttribute("role", "alert");
    message.textContent =
      label(
        block,
        "تعذر تحميل النموذج. أعد المحاولة أو تواصل مع المتجر.",
        "Impossible de charger le formulaire. Réessayez ou contactez la boutique.",
        "The form could not load. Retry or contact the store.",
      ) + ` [${code}]`;
    retry.type = "button";
    retry.textContent = label(
      block,
      "إعادة المحاولة",
      "Réessayer",
      "Try again",
    );
    retry.onclick = () => {
      pending = null;
      load(block);
    };
    block.replaceChildren(message, retry);
  };
  const load = (block: Element) => {
    if (customElements.get("dz-cod-form") || loading.has(block)) return;
    loading.add(block);
    block.setAttribute("data-dz-state", "RUNTIME_LOADING");
    if (!pending)
      pending = new Promise<void>((resolve, reject) => {
        const path = block.getAttribute("data-runtime-url");
        if (!path) return reject(new Error("RUNTIME_URL_MISSING"));
        const url = new URL(path, location.origin);
        if (
          url.protocol !== "https:" ||
          !url.pathname.endsWith("/assets/dz-cod-runtime.js") ||
          !(
            url.origin === location.origin || url.hostname === "cdn.shopify.com"
          )
        )
          return reject(new Error("RUNTIME_URL_INVALID"));
        const script = document.createElement("script");
        script.src = url.href;
        script.async = true;
        const timer = setTimeout(() => {
          script.remove();
          reject(new Error("RUNTIME_TIMEOUT"));
        }, 15000);
        script.onload = () => {
          clearTimeout(timer);
          if (customElements.get("dz-cod-form")) resolve();
          else reject(new Error("RUNTIME_NOT_REGISTERED"));
        };
        script.onerror = () => {
          clearTimeout(timer);
          script.remove();
          reject(new Error("RUNTIME_DOWNLOAD_FAILED"));
        };
        document.head.append(script);
      });
    void pending
      .then(() => {
        observer?.disconnect();
        mutations.disconnect();
      })
      .catch((error: unknown) => {
        const code =
          error instanceof Error && /^RUNTIME_[A-Z_]+$/.test(error.message)
            ? error.message
            : "RUNTIME_UNAVAILABLE";
        showError(block, code);
      })
      .finally(() => loading.delete(block));
  };
  const observer =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries)
              if (entry.isIntersecting) load(entry.target);
          },
          { rootMargin: "300px" },
        )
      : null;
  const scan = () => {
    if (customElements.get("dz-cod-form")) {
      observer?.disconnect();
      mutations.disconnect();
      return;
    }
    document.querySelectorAll("dz-cod-form").forEach((block) => {
      if (watched.has(block)) return;
      watched.add(block);
      if (!observer || block.getAttribute("data-design-mode") === "true")
        load(block);
      else observer.observe(block);
    });
  };
  const mutations = new MutationObserver(scan);
  mutations.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  document.addEventListener("shopify:block:select", (event) => {
    if (event.target instanceof Element)
      event.target.querySelectorAll("dz-cod-form").forEach((block) => {
        load(block);
      });
  });
  document.addEventListener("shopify:section:load", scan);
  scan();
})();
