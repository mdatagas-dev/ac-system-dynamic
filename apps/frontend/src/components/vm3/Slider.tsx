"use client";

/**
 * VM3 Slider — shadcn/ui Slider. API native range input (value + onChange event).
 */
import { cn } from "@/lib/utils";
import { Slider as ShadSlider } from "@/components/ui/slider";
import { type InputHTMLAttributes, type ChangeEvent } from "react";

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Slider({ value, onChange, min = 0, max = 100, step = 1, disabled, className }: SliderProps) {
  return (
    <ShadSlider
      value={[Number(value ?? min)]}
      min={Number(min)}
      max={Number(max)}
      step={Number(step)}
      disabled={disabled}
      onValueChange={(v) =>
        onChange?.({
          target: { value: String(v[0]) },
        } as unknown as ChangeEvent<HTMLInputElement>)
      }
      className={cn("w-full", className)}
    />
  );
}
