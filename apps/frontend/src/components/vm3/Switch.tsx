"use client";

/**
 * VM3 Switch — shadcn/ui Switch. API native input (checked + onChange event).
 */
import { cn } from "@/lib/utils";
import { Switch as ShadSwitch } from "@/components/ui/switch";
import { type InputHTMLAttributes, type ChangeEvent } from "react";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Switch({
  checked,
  onChange,
  disabled,
  id,
  "aria-label": ariaLabel,
  className,
}: SwitchProps) {
  return (
    <ShadSwitch
      checked={Boolean(checked)}
      onCheckedChange={(c) =>
        onChange?.({
          target: { checked: c },
        } as unknown as ChangeEvent<HTMLInputElement>)
      }
      disabled={disabled}
      id={id}
      aria-label={ariaLabel}
      className={cn(className)}
    />
  );
}
