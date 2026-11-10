"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmbeddedForm } from "@/storefront/form";
import type { FormSettings } from "@/modules/forms/settings";
import type { CheckoutProduct } from "@/modules/checkout/schema";
import { embeddedFetch } from "@/lib/merchant-fetch";
import { useLanguage } from "../language-provider";
export function EmbeddedPreview({
  product,
  settings,
  styleText,
  revision,
}: {
  product: CheckoutProduct;
  settings: FormSettings;
  styleText: string;
  revision: number;
}) {
  const { language } = useLanguage();
  const host = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<ShadowRoot | null>(null);
  const [variantId, setVariant] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    if (host.current)
      setShadow(
        host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" }),
      );
  }, []);
  return (
    <div ref={host} data-testid="embedded-preview">
      {shadow &&
        createPortal(
          <>
            <style>{styleText}</style>
            <EmbeddedForm
              key={`${product.id}:${revision}`}
              productId={product.id}
              variantId={variantId}
              quantity={quantity}
              setVariant={setVariant}
              setQuantity={setQuantity}
              locale={language}
              apiBase="/api/embedded/preview"
              transport={embeddedFetch}
              designOverride={settings}
              settingsSource="dashboard"
              title=""
              buttonText=""
              introText=""
              footerText=""
            />
          </>,
          shadow,
        )}
    </div>
  );
}
