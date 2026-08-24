"use client";

/**
 * VM3 Popover + Tooltip — Base UI + Motion (enter anim).
 */
import { Popover as BasePopover, Tooltip as BaseTooltip } from "@base-ui/react";
import { motion } from "motion/react";
import { type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { scaleSmall, fade } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

/* ---------- Popover ---------- */
export interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Popover({ trigger, children, className }: PopoverProps) {
  const reduced = useVm3ReducedMotion();
  return (
    <BasePopover.Root>
      <BasePopover.Trigger render={<span />}>{trigger}</BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner>
          <motion.div variants={withReducedMotion(scaleSmall, reduced)} initial="initial" animate="animate">
            <BasePopover.Popup className={cn("vm3-popover", className)}>
              {children}
            </BasePopover.Popup>
          </motion.div>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

/* ---------- Tooltip ---------- */
export interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ label, children, className }: TooltipProps) {
  const reduced = useVm3ReducedMotion();
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={<span />}>{children}</BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side="top">
          <motion.div variants={withReducedMotion(fade, reduced)} initial="initial" animate="animate">
            <BaseTooltip.Popup className={cn("vm3-tooltip", className)}>{label}</BaseTooltip.Popup>
          </motion.div>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
