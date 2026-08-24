"use client";

/**
 * VM3 Select — Base UI Select + Motion. M3 style trigger + popup list.
 */
import { Select as BaseSelect } from "@base-ui/react/select";
import { motion } from "motion/react";
import { type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { scaleSmall } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ options, value, onChange, placeholder, className, disabled }: SelectProps) {
  const reduced = useVm3ReducedMotion();
  const selected = options.find((o) => o.value === value);

  return (
    <BaseSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <BaseSelect.Trigger className={cn("vm3-select-trigger", className)}>
        <span className="vm3-select-value">
          {selected?.label ?? <span className="vm3-select-placeholder">{placeholder ?? "Pilih"}</span>}
        </span>
        <span className="material-symbols-rounded vm3-select-arrow" aria-hidden>
          arrow_drop_down
        </span>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner>
          <BaseSelect.Popup className="vm3-select-popup">
            <motion.div
              variants={withReducedMotion(scaleSmall, reduced)}
              initial="initial"
              animate="animate"
              className="flex flex-col"
            >
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  className="vm3-interactive vm3-select-item"
                >
                  <span className="material-symbols-rounded vm3-select-check" aria-hidden>
                    check
                  </span>
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </motion.div>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

export type { ReactNode };
