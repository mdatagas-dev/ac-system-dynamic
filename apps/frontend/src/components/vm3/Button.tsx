"use client";

/**
 * VM3 Button — shadcn/ui Button. Varian M3 dipetakan: filled→default,
 * tonal→secondary, elevated→secondary, outlined→outline, text→ghost.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button as ShadButton } from "@/components/ui/button";

export type ButtonVariant = "elevated" | "filled" | "tonal" | "outlined" | "text";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** nama ikon Material Symbols (mis. "add") atau elemen ikon siap pakai */
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantMap: Record<ButtonVariant, "default" | "secondary" | "outline" | "ghost"> = {
  elevated: "secondary",
  filled: "default",
  tonal: "secondary",
  outlined: "outline",
  text: "ghost",
};

function Icon({ value }: { value: ReactNode }) {
  if (typeof value === "string") {
    return (
      <span className="material-symbols-rounded" aria-hidden>
        {value}
      </span>
    );
  }
  return <>{value}</>;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "filled", icon, trailingIcon, loading, fullWidth, className, disabled, children, type = "button", ...rest },
    ref,
  ) => (
    <ShadButton
      ref={ref}
      type={type}
      variant={variantMap[variant]}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(fullWidth && "w-full", className)}
      {...rest}
    >
      {loading ? (
        <span className="material-symbols-rounded animate-spin" aria-hidden>
          progress_activity
        </span>
      ) : (
        icon != null && <Icon value={icon} />
      )}
      {children != null && <span>{children}</span>}
      {trailingIcon != null && <Icon value={trailingIcon} />}
    </ShadButton>
  ),
);
Button.displayName = "Button";
