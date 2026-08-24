"use client";

/**
 * VM3 SegmentedButton — pilihan tunggal (radio-like) atau banyak (checkbox-like).
 * Indikator pilihan: secondary-container + ikon check.
 * Aksesibilitas: role radiogroup/group, aria-pressed/aria-checked per segmen.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";
import { FocusRing } from "@/components/primitives/FocusRing";

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
    const toggle = (v: string) => {
      if (!onChange) return;
      if (multiple) {
        const next = values.includes(v)
          ? values.filter((x) => x !== v)
          : [...values, v];
        onChange(next);
      } else {
        onChange(v);
      }
    };

    return (
      <div
        ref={ref}
        role={multiple ? "group" : "radiogroup"}
        className={cn("vm3-segmented", className)}
        {...rest}
      >
        {segments.map((s) => {
          const selected = values.includes(s.value);
          return (
            <button
              key={s.value}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={selected}
              aria-label={s.label}
              className={cn("vm3-interactive vm3-segment", selected && "vm3-segment-selected")}
              onClick={() => toggle(s.value)}
            >
              <StateLayer />
              <FocusRing />
              {selected && (
                <span className="material-symbols-rounded vm3-segment-check" aria-hidden>
                  check
                </span>
              )}
              {s.icon && (
                <span className="material-symbols-rounded" aria-hidden>
                  {s.icon}
                </span>
              )}
              <span className="vm3-segment-label">{s.label}</span>
            </button>
          );
        })}
      </div>
    );
  },
);
SegmentedButton.displayName = "SegmentedButton";
