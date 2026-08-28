"use client";

/**
 * VM3 SegmentedButton — shadcn/ui ToggleGroup. Pilihan tunggal/banyak.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface Segment {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedButtonProps extends Omit<ButtonHTMLAttributes<HTMLDivElement>, "onChange"> {
  segments: Segment[];
  value: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
}

export const SegmentedButton = forwardRef<HTMLDivElement, SegmentedButtonProps>(
  ({ segments, value, onChange, multiple, className, ...rest }, ref) => {
    const values = Array.isArray(value) ? value : [value];
    const renderItems = () =>
      segments.map((s) => {
        const selected = values.includes(s.value);
        return (
          <ToggleGroupItem
            key={s.value}
            value={s.value}
            aria-label={s.label}
            className="flex items-center gap-1 rounded-full px-3 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {selected && (
              <span className="material-symbols-rounded text-sm" aria-hidden>
                check
              </span>
            )}
            {s.icon && (
              <span className="material-symbols-rounded text-sm" aria-hidden>
                {s.icon}
              </span>
            )}
            {s.label}
          </ToggleGroupItem>
        );
      });

    return (
      <div ref={ref} className={cn(className)} {...rest}>
        {multiple ? (
          <ToggleGroup type="multiple" value={values} onValueChange={(v) => onChange?.(v)} className="rounded-full border p-0.5">
            {renderItems()}
          </ToggleGroup>
        ) : (
          <ToggleGroup type="single" value={values[0] ?? ""} onValueChange={(v) => onChange?.(v ?? "")} className="rounded-full border p-0.5">
            {renderItems()}
          </ToggleGroup>
        )}
      </div>
    );
  },
);
SegmentedButton.displayName = "SegmentedButton";