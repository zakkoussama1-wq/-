"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../language-provider";

export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="ds-dialog"
      aria-labelledby={id}
      aria-busy={busy}
      onCancel={(event) => {
        // File picker cancellation bubbles; only the dialog’s own Escape event closes it.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="ds-dialog-header">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label={t("إغلاق النافذة")}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
