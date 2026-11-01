"use client";
import Image from "next/image";
import { useState } from "react";
import { useLanguage } from "../language-provider";
export function ProductImage({
  src,
  name,
  size = 72,
}: {
  src: string;
  name: string;
  size?: number;
}) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState("");
  if (failed === src)
    return (
      <span
        role="img"
        aria-label={t("تعذر عرض الصورة.")}
        className="product-image-error"
        style={{ width: size, height: size }}
      >
        {t("تعذر عرض الصورة.")}
      </span>
    );
  return (
    <Image
      unoptimized
      src={src}
      alt={name}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className="product-thumbnail"
      style={{ width: size, height: size }}
    />
  );
}
