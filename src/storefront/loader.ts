// Fetch the larger isolated UI only when a product block approaches the viewport.
(() => {
  let pending: Promise<void> | null = null;
  const load = (block: Element) => {
    if (customElements.get("dz-cod-form")) return;
    if (!pending) {
      pending = new Promise<void>((resolve, reject) => {
        const path = block.getAttribute("data-runtime-url");
        if (!path) return reject(new Error("Runtime missing"));
        const url = new URL(path, location.origin);
        if (
          url.protocol !== "https:" ||
          !url.pathname.endsWith("/assets/dz-cod-runtime.js") ||
          !(
            url.origin === location.origin || url.hostname === "cdn.shopify.com"
          )
        )
          return reject(new Error("Invalid runtime"));
        const script = document.createElement("script");
        script.src = url.href;
        script.async = true;
        script.onload = () => {
          if (customElements.get("dz-cod-form")) resolve();
          else reject(new Error("Runtime unavailable"));
        };
        script.onerror = () => {
          script.remove();
          reject(new Error("Runtime unavailable"));
        };
        document.head.append(script);
      });
    }
    void pending
      .then(() => {
        observer.disconnect();
        mutations.disconnect();
      })
      .catch(() => {
        // Text only: never display exception messages or URLs to visitors.
        const language = block.getAttribute("data-language") ?? "ar";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = language.startsWith("fr")
          ? "Réessayer"
          : language.startsWith("en")
            ? "Try again"
            : "إعادة المحاولة";
        retry.onclick = () => {
          pending = null;
          block.replaceChildren();
          load(block);
        };
        block.replaceChildren(retry);
      });
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) load(entry.target);
    },
    { rootMargin: "300px" },
  );
  const scan = () => {
    if (customElements.get("dz-cod-form")) {
      observer.disconnect();
      mutations.disconnect();
      return;
    }
    document.querySelectorAll("dz-cod-form").forEach((block) => {
      observer.observe(block);
    });
  };
  const mutations = new MutationObserver(scan);
  mutations.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  scan();
})();
