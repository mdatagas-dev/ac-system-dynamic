"use client";

/**
 * VM3 IconButton — varian standard/outlined/filled/tonal.
 * Wajib aria-label (ikon murni tanpa teks).
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";
import { FocusRing } from "@/components/primitives/FocusRing";

export type IconButtonVariant = "standard" | "outlined" | "filled" | "tonal";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  icon: ReactNode;
  /** wajib untuk aksesibilitas (tombol ikon murni) */
  label: string;
}

const variantClass: Record<IconButtonVariant, string> = {
  standard: "vm3-iconbtn-standard",
  outlined: "vm3-iconbtn-outlined",
  filled: "vm3-iconbtn-filled",
  tonal: "vm3-iconbtn-tonal",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "standard", icon, label, className, disabled, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "vm3-interactive vm3-iconbtn",
        variantClass[variant],
        disabled && "vm3-disabled",
        className,
      )}
      disabled={disabled}
      {...rest}
    >
      <StateLayer />
      <FocusRing />
      <span className="material-symbols-rounded vm3-iconbtn-icon" aria-hidden>
        {icon}
      </span>
    </button>
  ),
);
IconButton.displayName = "IconButton";
