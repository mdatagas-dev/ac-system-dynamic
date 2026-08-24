"use client";

/**
 * VM3 Slider — range input M3 (accent primary).
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/design-system/utilities/cn";

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} type="range" className={cn("vm3-slider", className)} {...rest} />
  ),
);
Slider.displayName = "Slider";
