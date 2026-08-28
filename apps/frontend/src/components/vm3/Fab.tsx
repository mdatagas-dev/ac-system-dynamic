"use client";

/**
 * VM3 FAB — shadcn/ui Button bulat (regular/small/extended).
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button as ShadButton } from "@/components/ui/button";

export interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** label → mode extended */
  label?: string;
  small?: boolean;
}

export const Fab = forwardRef<HTMLButtonElement, FabProps>(
  ({ icon, label, small, className, disabled, type = "button", ...rest }, ref) => (
    <ShadButton
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={typeof icon === "string" ? icon : "Aksi"}
      className={cn(
        "rounded-full shadow-lg",
        small ? (label ? "h-9 px-3" : "size-10 p-0") : label ? "gap-1.5 px-4" : "size-14 p-0",
        className,
      )}
      {...rest}
    >
      <span className="material-symbols-rounded" aria-hidden>
        {icon}
      </span>
      {label && <span>{label}</span>}
    </ShadButton>
  ),
);
Fab.displayName = "Fab";
