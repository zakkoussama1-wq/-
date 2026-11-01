"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { useLanguage } from "../language-provider";
import { ProductImage } from "./image";
import type { CheckoutProduct } from "@/modules/checkout/schema";
export function productImages(product: CheckoutProduct) {
  return [
    ...new Set(
      [product.imageUrl, ...(product.images ?? [])].filter(
        (s): s is string => !!s,
      ),
    ),
  ];
}
export function MediaEditor({
  product,
  onChange,
  onBusy,
}: {
  product: CheckoutProduct;
  onChange: (value: CheckoutProduct) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [config, setConfig] = useState({
    maxBytes: 5 * 1024 * 1024,
    maxImages: 12,
    remoteHosts: [] as string[],
  });
  const replacing = useRef<number | null>(null);
  const replacement = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const images = productImages(product);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products/media", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(
    () => () => {
      pending.forEach((value) => {
        URL.revokeObjectURL(value);
      });
    },
    [pending],
  );
  function change(next: string[]) {
    onChange({
      ...product,
      images: next,
      imageUrl: next[0],
      variants: product.variants.map((v) =>
        v.imageUrl && !next.includes(v.imageUrl)
          ? { ...v, imageUrl: undefined }
          : v,
      ),
    });
  }
  async function add(files?: FileList | null, index?: number) {
    if (busy) return;
    const selected = files ? [...files] : [];
    setError("");
    if (files && !selected.length) return;
    if (
      images.length +
        (files ? selected.length : 1) -
        (index === undefined ? 0 : 1) >
      config.maxImages
    ) {
      setError("يمكن إضافة 12 صورة كحد أقصى للمنتج.");
      return;
    }
    if (selected.some((file) => file.size > config.maxBytes)) {
      setError("حجم الصورة يتجاوز الحد المسموح.");
      return;
    }
    if (
      selected.some(
        (file) =>
          !["image/png", "image/jpeg", "image/webp"].includes(file.type),
      )
    ) {
      setError("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP.");
      return;
    }
    setBusy(true);
    onBusy(true);
    setPending(selected.map((file) => URL.createObjectURL(file)));
    const next = [...images];
    try {
      for (const file of selected.length ? selected : [null]) {
        const form = new FormData();
        if (file) form.set("file", file);
        const response = await fetch("/api/products/media", {
          method: "POST",
          ...(file
            ? { body: form }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
              }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (index === undefined) next.push(data.url);
        else next[index] = data.url;
      }
      change(next);
      setUrl("");
    } catch (e) {
      // Preserve completed uploads and the old image when its replacement failed.
      change(next);
      setError(
        e instanceof Error && /[\u0600-\u06ff]/.test(e.message)
          ? e.message
          : "تعذر حفظ الصورة. أعد المحاولة.",
      );
    } finally {
      setPending([]);
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="product-media-editor" aria-busy={busy}>
      <h3>{t("صور المنتج")}</h3>
      <p className="data-muted">
        {t("PNG أو JPG أو WebP. الحد لكل صورة:")}{" "}
        {(config.maxBytes / 1024 / 1024).toFixed(1)} MB · {t("حتى 12 صورة.")}
      </p>
      <div className="product-media-grid">
        {images.map((src, index) => (
          <div key={src} className="product-media-item">
            <ProductImage
              src={src}
              name={`${product.name || t("صورة المنتج")} ${index + 1}`}
              size={88}
            />
            <span>{index === 0 ? t("الصورة الرئيسية") : index + 1}</span>
            <div className="product-media-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || index === 0}
                aria-label={`${t("تعيين صورة رئيسية")} ${index + 1}`}
                onClick={() =>
                  change([src, ...images.filter((s) => s !== src)])
                }
              >
                <Star size={13} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || index === 0}
                aria-label={`${t("تقديم الصورة")} ${index + 1}`}
                onClick={() => {
                  const next = [...images];
                  [next[index - 1], next[index]] = [
                    next[index],
                    next[index - 1],
                  ];
                  change(next);
                }}
              >
                <ArrowLeft size={13} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || index === images.length - 1}
                aria-label={`${t("تأخير الصورة")} ${index + 1}`}
                onClick={() => {
                  const next = [...images];
                  [next[index + 1], next[index]] = [
                    next[index],
                    next[index + 1],
                  ];
                  change(next);
                }}
              >
                <ArrowRight size={13} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={`${t("استبدال الصورة")} ${index + 1}`}
                onClick={() => {
                  replacing.current = index;
                  replacement.current?.click();
                }}
              >
                <Upload size={13} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={`${t("إزالة الصورة")} ${index + 1}`}
                onClick={() => change(images.filter((s) => s !== src))}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        ))}
        {pending.map((src, i) => (
          <div key={src} className="product-media-item">
            <ProductImage
              src={src}
              name={`${t("معاينة الصورة المختارة")} ${i + 1}`}
              size={88}
            />
            <span>{t("جارٍ رفع الصور…")}</span>
          </div>
        ))}
      </div>
      <label htmlFor="product-upload">{t("رفع صور من الجهاز")}</label>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => uploadInput.current?.click()}
      >
        <Upload size={15} />
        {t("اختيار الصور")}
      </Button>
      <input
        ref={uploadInput}
        className="sr-only"
        tabIndex={-1}
        id="product-upload"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        disabled={busy}
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={replacement}
        type="file"
        aria-label={t("ملف الصورة البديلة")}
        className="sr-only"
        tabIndex={-1}
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        disabled={busy}
        onChange={(e) => {
          void add(e.target.files, replacing.current ?? undefined);
          e.target.value = "";
        }}
      />
      <label htmlFor="product-image">{t("رابط صورة HTTPS (اختياري)")}</label>
      <div className="product-url-input">
        <input
          id="product-image"
          type="url"
          dir="ltr"
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={busy || !url.trim()}
          onClick={() => void add()}
        >
          {t("استيراد الصورة")}
        </Button>
      </div>
      {!!config.remoteHosts.length && (
        <p className="data-muted">
          {t("نطاقات الاستيراد المعتمدة:")}{" "}
          <bdi>{config.remoteHosts.join(", ")}</bdi>
        </p>
      )}
      <p className="data-muted">
        {t("إزالة الصورة تفصلها عن المنتج ولا تمسح ملفها التاريخي.")}
      </p>
      {error && (
        <p role="alert" className="data-error">
          {t(error)}
        </p>
      )}
      {busy && <p role="status">{t("جارٍ رفع الصور…")}</p>}
    </section>
  );
}
