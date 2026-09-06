"use client";

/**
 * VM3 Select — shadcn/ui Select. API sama: options, value, onChange,
 * placeholder, disabled. Opsi value "" dipetakan ke "__none__" (placeholder).
 */
import { cn } from "@/lib/utils";
import {
  Select as ShadSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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
  "aria-label"?: string;
}

const NONE_KEY = "__none__";

export function Select({ options, value, onChange, placeholder, className, disabled, "aria-label": ariaLabel }: SelectProps) {
  const hasNone = options.some((o) => o.value === "");

  return (
    <ShadSelect
      value={value ? value : hasNone ? NONE_KEY : ""}
      onValueChange={(v) => onChange(v === NONE_KEY ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder ?? "Pilih"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) =>
          o.value === "" ? (
            <SelectItem key={NONE_KEY} value={NONE_KEY}>
              {o.label}
            </SelectItem>
          ) : (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </ShadSelect>
  );
}
