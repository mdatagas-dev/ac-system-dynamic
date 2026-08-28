"use client";

/**
 * VM3 DatePicker — shadcn/ui Calendar dalam Popover.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export interface DatePickerProps {
  value: string | null; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  label?: string;
  min?: string;
  max?: string;
  className?: string;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DatePicker({ value, onChange, label, min, max, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start gap-2 font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="material-symbols-rounded text-base" aria-hidden>
            calendar_today
          </span>
          {value
            ? new Date(value + "T00:00:00").toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : (label ?? "Pilih tanggal")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toISO(d));
              setOpen(false);
            }
          }}
          disabled={(d) =>
            (min != null && toISO(d) < min) || (max != null && toISO(d) > max)
          }
        />
      </PopoverContent>
    </Popover>
  );
}
