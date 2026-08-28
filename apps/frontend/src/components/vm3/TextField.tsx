"use client";

/**
 * VM3 TextField — shadcn/ui Input + Label. API sama: label, helper, error,
 * errorText, icon leading, endSlot (mata password, clear, dll).
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FieldVariant = "filled" | "outlined";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: FieldVariant;
  label: string;
  helper?: string;
  error?: boolean;
  errorText?: string;
  icon?: ReactNode;
  /** ikon aksi di ujung kanan (mata password, clear, dll) */
  endSlot?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, helper, error, errorText, icon, endSlot, id, className, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const showError = error || Boolean(errorText);

    return (
      <div className={cn("w-full", className)}>
        <Label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </Label>
        <div className="relative">
          {icon && (
            <span className="material-symbols-rounded pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground" aria-hidden>
              {icon}
            </span>
          )}
          <Input
            ref={ref}
            id={fieldId}
            className={cn(icon && "pl-10", endSlot && "pr-10")}
            aria-invalid={showError || undefined}
            {...rest}
          />
          {endSlot && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2">{endSlot}</div>
          )}
        </div>
        {(helper || errorText) && (
          <p className={cn("mt-1 text-xs", showError ? "text-destructive" : "text-muted-foreground")}>
            {errorText ?? helper}
          </p>
        )}
      </div>
    );
  },
);
TextField.displayName = "TextField";
