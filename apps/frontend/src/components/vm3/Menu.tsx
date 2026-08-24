"use client";

/**
 * VM3 Menu — Base UI Menu + Motion (enter anim).
 * API: trigger + items. a11y (kbd, aria, esc) dari Base UI.
 */
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { motion } from "motion/react";
import { type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { scaleSmall } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";
import { StateLayer } from "@/components/primitives/StateLayer";

export interface MenuItemDef {
  label: string;
  icon?: string;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItemDef[];
  className?: string;
}

export function Menu({ trigger, items, className }: MenuProps) {
  const reduced = useVm3ReducedMotion();
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={<span />}>{trigger}</BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner>
          <motion.div
            variants={withReducedMotion(scaleSmall, reduced)}
            initial="initial"
            animate="animate"
          >
            <BaseMenu.Popup className={cn("vm3-menu", className)}>
              {items.map((item) => (
                <BaseMenu.Item
                  key={item.label}
                  disabled={item.disabled}
                  onSelect={item.onSelect}
                  className="vm3-interactive vm3-menu-item"
                >
                  <StateLayer />
                  {item.icon && (
                    <span className="material-symbols-rounded vm3-menu-item-icon" aria-hidden>
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </BaseMenu.Item>
              ))}
            </BaseMenu.Popup>
          </motion.div>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
