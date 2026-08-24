"use client";

/**
 * VM3 TextField — varian filled/outlined, label melayang, error, helper,
 * ikon leading, disabled. a11y: <label> terhubung ke input via id.
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";

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
  (
    { variant = "filled", label, helper, error, errorText, icon, endSlot, id, className, ...rest },
    ref,
  ) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const helperId = useId();
    const showError = error || Boolean(errorText);

    return (
      <div className={cn("w-full", className)}>
        <div
          className={cn("vm3-field", variant === "filled" ? "vm3-field-filled" : "vm3-field-outlined")}
          data-error={showError || undefined}
        >
          {icon && (
            <span className="material-symbols-rounded vm3-field-icon" aria-hidden>
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={fieldId}
            className="vm3-field-input"
            placeholder=" "
            aria-invalid={showError || undefined}
            aria-describedby={helperId}
            {...rest}
          />
          <label htmlFor={fieldId} className="vm3-field-label">
            {label}
          </label>
          {endSlot}
        </div>
        {(helper || errorText) && (
          <div id={helperId} className="vm3-field-helper" data-error={showError || undefined}>
            {errorText ?? helper}
          </div>
        )}
      </div>
    );
  },
);
TextField.displayName = "TextField";
