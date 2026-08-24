"use client";

/**
 * VM3 TextArea — varian filled/outlined, label melayang, error.
 */
import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/design-system/utilities/cn";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "filled" | "outlined";
  label: string;
  error?: boolean;
  errorText?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ variant = "filled", label, error, errorText, id, className, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const showError = error || Boolean(errorText);

    return (
      <div className={cn("w-full", className)}>
        <div
          className={cn(
            "vm3-field vm3-textarea",
            variant === "filled" ? "vm3-field-filled" : "vm3-field-outlined",
          )}
          data-error={showError || undefined}
        >
          <textarea
            ref={ref}
            id={fieldId}
            className="vm3-field-input vm3-textarea-input"
            placeholder=" "
            aria-invalid={showError || undefined}
            {...rest}
          />
          <label htmlFor={fieldId} className="vm3-field-label">
            {label}
          </label>
        </div>
        {errorText && (
          <div className="vm3-field-helper" data-error="true">
            {errorText}
          </div>
        )}
      </div>
    );
  },
);
TextArea.displayName = "TextArea";
