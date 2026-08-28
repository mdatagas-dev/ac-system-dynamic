"use client";

/**
 * VM3 Checkbox — shadcn/ui Checkbox. API native (checked + onChange event).
 */
import { cn } from "@/lib/utils";
import { Checkbox as ShadCheckbox } from "@/components/ui/checkbox";
import { type InputHTMLAttributes, type ReactNode, type ChangeEvent } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
}

export function Checkbox({ label, checked, onChange, disabled, className }: CheckboxProps) {
  return (
    <label className={cn("inline-flex items-center gap-2", className)}>
      <ShadCheckbox
        checked={Boolean(checked)}
        onCheckedChange={(c) =>
          onChange?.({
            target: { checked: Boolean(c) },
          } as unknown as ChangeEvent<HTMLInputElement>)
        }
        disabled={disabled}
      />
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}
