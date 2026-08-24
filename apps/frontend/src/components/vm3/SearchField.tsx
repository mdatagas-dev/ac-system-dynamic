"use client";

/**
 * VM3 SearchField — TextField dengan ikon search + tombol clear.
 */
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/design-system/utilities/cn";

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  variant?: "filled" | "outlined";
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ value, onChange, onClear, placeholder, label, variant = "filled", id, className, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const hasValue = Boolean(value);

    return (
      <div className={cn("w-full", className)}>
        <div
          className={cn("vm3-field", variant === "filled" ? "vm3-field-filled" : "vm3-field-outlined")}
        >
          <span className="material-symbols-rounded vm3-field-icon" aria-hidden>
            search
          </span>
          <input
            ref={ref}
            id={fieldId}
            className="vm3-field-input"
            placeholder=" "
            type="search"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            {...rest}
          />
          <label htmlFor={fieldId} className="vm3-field-label">
            {label ?? placeholder ?? "Cari"}
          </label>
          {hasValue && (
            <button
              type="button"
              aria-label="Bersihkan pencarian"
              className="vm3-search-clear"
              onClick={() => {
                onChange?.("");
                onClear?.();
              }}
            >
              <span className="material-symbols-rounded" aria-hidden>
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
