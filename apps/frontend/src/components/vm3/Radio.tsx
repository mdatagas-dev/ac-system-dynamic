"use client";

/**
 * VM3 Radio — shadcn/ui RadioGroup (single). API native (checked + onChange).
 */
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type InputHTMLAttributes, type ReactNode, type ChangeEvent } from "react";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export function Radio({ label, checked, onChange, disabled, id, className }: RadioProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <RadioGroup
        value={checked ? "on" : "off"}
        disabled={disabled}
        onValueChange={() =>
          onChange?.({
            target: { checked: !checked },
          } as unknown as ChangeEvent<HTMLInputElement>)
        }
      >
        <RadioGroupItem value="on" id={id} />
      </RadioGroup>
      {label && (
        <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
          {label}
        </label>
      )}
    </div>
  );
}
