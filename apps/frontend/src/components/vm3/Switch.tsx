"use client";

/**
 * VM3 Switch — toggle M3 (track 52x32, thumb, state layer).
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { StateLayer } from "@/components/primitives/StateLayer";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (props, ref) => (
    <span className="vm3-interactive vm3-switch">
      <StateLayer />
      <input ref={ref} type="checkbox" className="vm3-sr-only" {...props} />
      <span className="vm3-switch-thumb" aria-hidden />
    </span>
  ),
);
Switch.displayName = "Switch";
