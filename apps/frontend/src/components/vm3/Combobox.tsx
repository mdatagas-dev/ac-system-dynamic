"use client";

/**
 * VM3 Combobox — shadcn/ui Combobox (Base UI) dengan trigger chevron yang terlihat:
 * klik → daftar penuh, ketik → menyaring. Field label + placeholder.
 */
import {
  Combobox as BaseCombobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function Combobox({ options, value, onChange, label, placeholder, className }: ComboboxProps) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-on-surface">{label}</label>
      )}
      <BaseCombobox value={value} onValueChange={(v) => onChange(v ?? "")}>
        <ComboboxInput
          showTrigger
          showClear={!!value}
          className="w-full"
          placeholder={placeholder ?? "Ketik untuk mencari"}
        >
          <ComboboxContent>
            <ComboboxList>
              {options.map((o) => (
                <ComboboxItem key={o} value={o}>
                  {o}
                </ComboboxItem>
              ))}
              <ComboboxEmpty>Tidak ada hasil</ComboboxEmpty>
            </ComboboxList>
          </ComboboxContent>
        </ComboboxInput>
      </BaseCombobox>
    </div>
  );
}
