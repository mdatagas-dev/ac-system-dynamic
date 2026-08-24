"use client";

/**
 * VM3 Combobox — Base UI Autocomplete (filter + pilih dari daftar).
 */
import { Autocomplete as BaseAuto } from "@base-ui/react/autocomplete";
import { motion } from "motion/react";
import { useId, useMemo } from "react";
import { cn } from "@/design-system/utilities/cn";
import { scaleSmall } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

export interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function Combobox({ options, value, onChange, label, placeholder, className }: ComboboxProps) {
  const reduced = useVm3ReducedMotion();
  const autoId = useId();
  const filtered = useMemo(
    () => (value ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase())) : options),
    [options, value],
  );

  return (
    <div className={cn("w-full", className)}>
      <BaseAuto.Root value={value} onValueChange={onChange}>
        <div className="vm3-field vm3-field-filled">
          <BaseAuto.Input
            id={autoId}
            className="vm3-field-input"
            placeholder=" "
          />
          <label htmlFor={autoId} className="vm3-field-label">
            {label ?? placeholder ?? "Ketik untuk mencari"}
          </label>
        </div>
        <BaseAuto.Portal>
          <BaseAuto.Positioner>
            <motion.div variants={withReducedMotion(scaleSmall, reduced)} initial="initial" animate="animate">
              <BaseAuto.Popup className="vm3-select-popup">
                {filtered.length === 0 && (
                  <div className="vm3-select-item">Tidak ada hasil</div>
                )}
                {filtered.map((option) => (
                  <BaseAuto.Item key={option} value={option} className="vm3-select-item">
                    {option}
                  </BaseAuto.Item>
                ))}
              </BaseAuto.Popup>
            </motion.div>
          </BaseAuto.Positioner>
        </BaseAuto.Portal>
      </BaseAuto.Root>
    </div>
  );
}
