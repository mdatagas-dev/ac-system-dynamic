"use client";

/**
 * VM3 SearchField — shadcn/ui Input + ikon search + tombol clear.
 */
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  variant?: "filled" | "outlined";
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ value, onChange, onClear, placeholder, label, id, className, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const hasValue = Boolean(value);

    return (
      <div className={cn("w-full", className)}>
        {label && (
          <Label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-foreground">
            {label}
          </Label>
        )}
        <div className="relative">
          <span className="material-symbols-rounded pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground" aria-hidden>
            search
          </span>
          <Input
            ref={ref}
            id={fieldId}
            className="pl-10 pr-9"
            type="search"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            {...rest}
          />
          {hasValue && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                onChange?.("");
                onClear?.();
              }}
            >
              <span className="material-symbols-rounded text-base" aria-hidden>
                close
              </span>
            </button>
          )}
        </div>
      </div>
    );
  },
);
SearchField.displayName = "SearchField";
