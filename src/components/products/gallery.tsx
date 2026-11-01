"use client";
import { useState } from "react";
import { ProductImage } from "./image";
import { useLanguage } from "../language-provider";
export function ProductGallery({
  images,
  initial,
  name,
}: {
  images: string[];
  initial: string;
  name: string;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(initial);
  const active = images.includes(selected) ? selected : images[0];
  return (
    <section className="product-gallery" aria-label={t("صور المنتج")}>
      <div className="product-gallery-main" data-testid="product-gallery-main">
        <ProductImage src={active} name={name} size={240} fluid />
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbnails">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              aria-label={`${t("عرض الصورة")} ${index + 1}`}
              aria-pressed={active === src}
              onClick={() => setSelected(src)}
            >
              <ProductImage src={src} name={`${name} ${index + 1}`} size={44} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
