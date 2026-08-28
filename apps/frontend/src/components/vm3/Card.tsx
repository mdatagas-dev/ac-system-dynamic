"use client";

/**
 * VM3 Card — shadcn/ui Card. Varian: elevated→shadow, filled→bg-muted, outlined→border.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Card as ShadCard } from "@/components/ui/card";

export type CardVariant = "elevated" | "filled" | "outlined";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "elevated", interactive, className, children, ...rest }, ref) => (
    <ShadCard
      ref={ref}
      className={cn(
        variant === "elevated" && "shadow-sm",
        variant === "filled" && "bg-muted/50",
        variant === "outlined" && "border-border",
        interactive && "cursor-pointer transition-colors hover:bg-accent/50",
        className,
      )}
      {...rest}
    >
      {children}
    </ShadCard>
  ),
);
Card.displayName = "Card";
