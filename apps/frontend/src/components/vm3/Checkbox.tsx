"use client";

/**
 * VM3 Checkbox — native input + styling M3. a11y penuh dari <input>.
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, checked, ...rest }, ref) => (
    <label className={cn("vm3-checkbox-wrap", className)}>
      <span className="vm3-interactive vm3-checkbox">
        <StateLayer />
        <input
          ref={ref}
          type="checkbox"
          className="vm3-sr-only"
          checked={checked}
          aria-checked={checked}
          {...rest}
        />
        <span className="vm3-checkbox-box" aria-hidden>
          <span className="material-symbols-rounded vm3-checkbox-check">check</span>
        </span>
      </span>
      {label && <span className="vm3-select-label">{label}</span>}
    </label>
  ),
);
Checkbox.displayName = "Checkbox";
