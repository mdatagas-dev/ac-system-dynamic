"use client";

/**
 * VM3 Popover + Tooltip — shadcn/ui.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Popover as ShadPopover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip as ShadTooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/* ---------- Popover ---------- */
export interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Popover({ trigger, children, className }: PopoverProps) {
  return (
    <ShadPopover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className={cn("w-auto", className)}>{children}</PopoverContent>
    </ShadPopover>
  );
}

/* ---------- Tooltip ---------- */
export interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <ShadTooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={cn(className)}>{label}</TooltipContent>
    </ShadTooltip>
  );
}
