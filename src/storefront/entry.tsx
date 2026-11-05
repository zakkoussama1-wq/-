import { createRoot, type Root } from "react-dom/client";
import { EmbeddedForm, type FormProps } from "./form";
import type { Locale } from "./copy";
import css from "./style.css";
const instances = new Map<string, DzCodForm>();
const gid = (value: string, type: "Product" | "ProductVariant") =>
  new RegExp(`^gid://shopify/${type}/[1-9][0-9]*$`).test(value)
    ? value
    : /^[1-9][0-9]*$/.test(value)
      ? `gid://shopify/${type}/${value}`
      : "";
class DzCodForm extends HTMLElement {
  private root: Root | null = null;
  private cleanup: (() => void) | null = null;
  static get observedAttributes() {
    return [
      "data-product-id",
      "data-proxy-path",
      "data-variant-id",
      "data-language",
      "data-title",
      "data-button-text",
      "data-intro-text",
      "data-footer-text",
      "data-accent",
      "data-background",
      "data-ink",
      "data-width",
    ];
  }
  connectedCallback() {
    this.mount();
  }
  disconnectedCallback() {
    this.unmount();
    queueMicrotask(() =>
      document.querySelectorAll<DzCodForm>("dz-cod-form").forEach((el) => {
        el.mount();
      }),
    );
  }
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    if (oldValue === newValue || !this.isConnected) return;
    if (name === "data-product-id") {
      this.unmount();
      this.mount();
    } else this.render();
  }
  private product() {
    return gid(this.getAttribute("data-product-id") ?? "", "Product");
  }
  private themeScope() {
    const local = this.closest(".shopify-section");
    if (local?.querySelector('form[action*="/cart/add"]')) return local;
    return (
      document
        .querySelector('main form[action*="/cart/add"]')
        ?.closest(".shopify-section") ??
      local ??
      document.querySelector("main") ??
      document
    );
  }
  private themeForm() {
    return this.themeScope().querySelector<HTMLFormElement>(
      'form[action*="/cart/add"]',
    );
  }
  private externalVariant() {
    return this.themeForm()?.querySelector<HTMLInputElement>('[name="id"]');
  }
  private externalQuantity() {
    return this.themeForm()?.querySelector<HTMLInputElement>(
      '[name="quantity"]',
    );
  }
  mount() {
    if (this.root || !this.isConnected) return;
    const id = this.product();
    if (!id) return;
    const other = instances.get(id);
    if (other && other !== this && other.isConnected) {
      this.hidden = true;
      return;
    }
    instances.set(id, this);
    this.hidden = false;
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" }),
      style = document.createElement("style"),
      container = document.createElement("div");
    style.textContent = css;
    shadow.replaceChildren(style, container);
    this.root = createRoot(container);
    this.dataset.mounted = "true";
    const scope = this.themeScope(),
      sync = () => this.render();
    const variantEvent = (event: Event) => {
      const e = event as CustomEvent<{
        variant?: { id?: string | number };
        sectionId?: string;
      }>;
      if (
        e.detail?.sectionId &&
        (scope instanceof Element ? scope.id : "") !==
          `shopify-section-${e.detail.sectionId}`
      )
        return;
      if (
        e.target instanceof Node &&
        e.target !== document &&
        scope !== document &&
        !scope.contains(e.target)
      )
        return;
      if (e.detail?.variant?.id) {
        const external = this.externalVariant();
        if (external)
          external.value = String(e.detail.variant.id).split("/").at(-1)!;
        this.setAttribute("data-variant-id", String(e.detail.variant.id));
      } else sync();
    };
    scope.addEventListener("change", sync);
    scope.addEventListener("input", sync);
    document.addEventListener("variant:change", variantEvent);
    document.addEventListener("product:variant-change", variantEvent);
    window.addEventListener("popstate", sync);
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (r) =>
            r.type === "childList" ||
            (r.target instanceof HTMLInputElement &&
              ["id", "quantity"].includes(r.target.name)),
        )
      )
        sync();
    });
    observer.observe(scope, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["value"],
    });
    this.cleanup = () => {
      observer.disconnect();
      scope.removeEventListener("change", sync);
      scope.removeEventListener("input", sync);
      document.removeEventListener("variant:change", variantEvent);
      document.removeEventListener("product:variant-change", variantEvent);
      window.removeEventListener("popstate", sync);
    };
    this.render();
  }
  private unmount() {
    this.cleanup?.();
    this.cleanup = null;
    this.root?.unmount();
    this.root = null;
    delete this.dataset.mounted;
    if (instances.get(this.product()) === this)
      instances.delete(this.product());
    for (const [id, el] of instances) if (el === this) instances.delete(id);
  }
  private render() {
    if (!this.root) return;
    const base = this.getAttribute("data-proxy-path") ?? "/apps/dz-cod";
    if (!/^\/(apps|a|community|tools)\/[a-zA-Z0-9_-]+$/.test(base)) {
      this.root.render(<p role="alert">Invalid App Proxy path</p>);
      return;
    }
    const rawLocale = (
      this.getAttribute("data-language") ?? "ar"
    ).toLowerCase();
    const locale: Locale = rawLocale.startsWith("fr")
      ? "fr"
      : rawLocale.startsWith("en")
        ? "en"
        : "ar";
    for (const [attr, variable] of [
      ["accent", "--dz-accent"],
      ["background", "--dz-background"],
      ["ink", "--dz-ink"],
    ] as const) {
      const value = this.getAttribute("data-" + attr);
      if (value && /^#[a-f0-9]{6}$/i.test(value))
        this.style.setProperty(variable, value);
    }
    const accent = this.getAttribute("data-accent");
    if (accent && /^#[a-f0-9]{6}$/i.test(accent)) {
      const rgb = [1, 3, 5]
        .map((i) => parseInt(accent.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      this.style.setProperty(
        "--dz-button-ink",
        rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
          ? "#111827"
          : "#ffffff",
      );
    }
    const width = Number(this.getAttribute("data-width") ?? 480);
    if (width >= 280 && width <= 600)
      this.style.setProperty("--dz-width", width + "px");
    const variant = gid(
      this.getAttribute("data-variant-id") ??
        this.externalVariant()?.value ??
        "",
      "ProductVariant",
    );
    const quantity = Number(this.externalQuantity()?.value ?? 1);
    const props: FormProps = {
      productId: this.product(),
      variantId: variant,
      quantity: Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1,
      locale,
      apiBase: base,
      title: (this.getAttribute("data-title") ?? "").slice(0, 150),
      buttonText: (this.getAttribute("data-button-text") ?? "").slice(0, 80),
      introText: (this.getAttribute("data-intro-text") ?? "").slice(0, 300),
      footerText: (this.getAttribute("data-footer-text") ?? "").slice(0, 300),
      setVariant: (id) => {
        const input = this.externalVariant();
        this.setAttribute("data-variant-id", id);
        if (input) {
          input.value = id.split("/").at(-1)!;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      setQuantity: (n) => {
        const input = this.externalQuantity();
        if (input) {
          input.value = String(n);
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
    };
    // Theme input updates take precedence; event adapters update the block attribute.
    const external = this.externalVariant()?.value;
    if (external) props.variantId = gid(external, "ProductVariant");
    this.root.render(<EmbeddedForm key={props.productId} {...props} />);
  }
}
if (!customElements.get("dz-cod-form"))
  customElements.define("dz-cod-form", DzCodForm);
