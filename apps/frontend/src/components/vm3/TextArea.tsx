"use client";

/**
 * VM3 TextArea — shadcn/ui Textarea + Label.
 */
import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "filled" | "outlined";
  label: string;
  error?: boolean;
  errorText?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, errorText, id, className, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const showError = error || Boolean(errorText);

    return (
      <div className={cn("w-full", className)}>
        <Label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </Label>
        <Textarea
          ref={ref}
          id={fieldId}
          aria-invalid={showError || undefined}
          className={cn(showError && "border-destructive focus-visible:ring-destructive/30")}
          {...rest}
        />
        {errorText && <p className="mt-1 text-xs text-destructive">{errorText}</p>}
      </div>
    );
  },
);
TextArea.displayName = "TextArea";
