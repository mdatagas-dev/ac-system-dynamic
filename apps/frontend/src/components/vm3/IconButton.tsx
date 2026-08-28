"use client";

/**
 * VM3 IconButton — shadcn/ui Button size=icon. Wajib aria-label.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button as ShadButton } from "@/components/ui/button";

export type IconButtonVariant = "standard" | "outlined" | "filled" | "tonal";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  icon: ReactNode;
  /** wajib untuk aksesibilitas (tombol ikon murni) */
  label: string;
}

const variantMap: Record<IconButtonVariant, "default" | "secondary" | "outline" | "ghost"> = {
  standard: "ghost",
  outlined: "outline",
  filled: "default",
  tonal: "secondary",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "standard", icon, label, className, disabled, type = "button", ...rest }, ref) => (
    <ShadButton
      ref={ref}
      type={type}
      aria-label={label}
      variant={variantMap[variant]}
      size="icon"
      disabled={disabled}
      className={cn(className)}
      {...rest}
    >
      <span className="material-symbols-rounded" aria-hidden>
        {icon}
      </span>
    </ShadButton>
  ),
);
IconButton.displayName = "IconButton";
