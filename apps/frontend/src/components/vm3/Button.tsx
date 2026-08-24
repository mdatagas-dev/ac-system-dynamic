"use client";

/**
 * VM3 Button — 5 varian M3 (elevated/filled/tonal/outlined/text).
 * - State layer currentColor (on-container role) — M3 compliant
 * - Focus ring keyboard, disabled, loading
 * - Elevated: hover menaikkan shadow (spatial response)
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";
import { FocusRing } from "@/components/primitives/FocusRing";

export type ButtonVariant = "elevated" | "filled" | "tonal" | "outlined" | "text";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** nama ikon Material Symbols (mis. "add") atau elemen ikon siap pakai */
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

function Icon({ value }: { value: ReactNode }) {
  if (typeof value === "string") {
    return (
      <span className="material-symbols-rounded vm3-btn-icon" aria-hidden>
        {value}
      </span>
    );
  }
  return <>{value}</>;
}

const variantClass: Record<ButtonVariant, string> = {
  elevated: "vm3-btn-elevated",
  filled: "vm3-btn-filled",
  tonal: "vm3-btn-tonal",
  outlined: "vm3-btn-outlined",
  text: "vm3-btn-text",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "filled", icon, trailingIcon, loading, fullWidth, className, disabled, children, type = "button", ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "vm3-interactive vm3-btn",
        variantClass[variant],
        fullWidth && "vm3-btn-full",
        (disabled || loading) && "vm3-disabled",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <StateLayer />
      <FocusRing />
      <span className="vm3-btn-content">
        {loading ? <span className="vm3-btn-spinner" aria-hidden /> : icon != null && <Icon value={icon} />}
        {children != null && <span className="vm3-btn-label">{children}</span>}
        {trailingIcon != null && <Icon value={trailingIcon} />}
      </span>
    </button>
  ),
);
Button.displayName = "Button";
