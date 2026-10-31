"use client";
import { useLanguage } from "@/components/language-provider";
import {
  Children,
  isValidElement,
  type CSSProperties,
  type ReactNode,
} from "react";
/** Reorder actual DOM children, so keyboard focus follows the merchant's visual ordering. */
export function OrderedFields({
  children,
  disabled,
  compact = false,
  columns = "one",
}: {
  compact?: boolean;
  columns?: "one" | "two";
  children: ReactNode;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const order = (child: ReactNode) =>
    isValidElement<{
      style?: CSSProperties;
    }>(child)
      ? Number(child.props.style?.order ?? 99)
      : 99;
  const fields = Children.toArray(children).sort((a, b) => order(a) - order(b));
  return (
    <fieldset
      disabled={disabled}
      className={
        compact
          ? "lead-fields grid grid-cols-2 gap-3"
          : "lead-fields grid grid-cols-2 gap-5"
      }
      data-columns={columns}
    >
      {t(fields)}
    </fieldset>
  );
}
