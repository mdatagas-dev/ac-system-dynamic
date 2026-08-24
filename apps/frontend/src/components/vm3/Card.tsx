"use client";

/**
 * VM3 Card — elevated/filled/outlined, opsional interaktif.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";

export type CardVariant = "elevated" | "filled" | "outlined";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "elevated", interactive, className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "vm3-card",
        variant === "elevated" && "vm3-card-elevated",
        variant === "filled" && "vm3-card-filled",
        variant === "outlined" && "vm3-card-outlined",
        interactive && "vm3-card-interactive",
        className,
      )}
      {...rest}
    >
      {interactive && <StateLayer />}
      {children}
    </div>
  ),
);
Card.displayName = "Card";
