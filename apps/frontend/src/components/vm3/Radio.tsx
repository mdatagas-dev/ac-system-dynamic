"use client";

/**
 * VM3 Radio — native input + styling M3.
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className, ...rest }, ref) => (
    <label className={cn("vm3-checkbox-wrap", className)}>
      <span className="vm3-interactive vm3-radio">
        <StateLayer />
        <input ref={ref} type="radio" className="vm3-sr-only" {...rest} />
        <span className="vm3-radio-dot" aria-hidden />
        <span className="vm3-radio-inner" aria-hidden />
      </span>
      {label && <span className="vm3-select-label">{label}</span>}
    </label>
  ),
);
Radio.displayName = "Radio";
