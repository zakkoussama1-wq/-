import type { HTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Surface({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("ds-surface", className)} {...props} />;
}
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("ds-skeleton", className)} />;
}
export function Toast({
  children,
  onClose,
  closeLabel,
}: {
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="ds-toast" role="status">
      <span>{children}</span>
      <button type="button" aria-label={closeLabel} onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
