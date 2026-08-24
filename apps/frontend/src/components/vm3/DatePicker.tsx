"use client";

/**
 * VM3 DatePicker — kalender M3 dalam Popover.
 * Navigasi bulan, hari ini, pilihan, disabled range.
 */
import { Popover as BasePopover } from "@base-ui/react/popover";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { cn } from "@/design-system/utilities/cn";
import { scaleSmall } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface DatePickerProps {
  value: string | null; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  label?: string;
  min?: string;
  max?: string;
  className?: string;
}

export function DatePicker({ value, onChange, label, min, max, className }: DatePickerProps) {
  const reduced = useVm3ReducedMotion();
  const today = new Date();
  const todayStr = toISO(today);
  const [view, setView] = useState(() => (value ? new Date(value + "T00:00:00") : new Date()));

  const cells = useMemo(() => buildMonthGrid(view), [view]);

  const moveMonth = (delta: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));

  const select = (dateStr: string) => {
    onChange(dateStr);
  };

  return (
    <BasePopover.Root>
      <BasePopover.Trigger
        render={
          <button type="button" className={cn("vm3-field vm3-field-outlined vm3-date-trigger", className)}>
            <span className="material-symbols-rounded vm3-field-icon" aria-hidden>
              calendar_today
            </span>
            <span className={cn("vm3-date-value", !value && "vm3-select-placeholder")}>
              {value ? formatDisplay(value) : (label ?? "Pilih tanggal")}
            </span>
          </button>
        }
      />
      <BasePopover.Portal>
        <BasePopover.Positioner>
          <motion.div variants={withReducedMotion(scaleSmall, reduced)} initial="initial" animate="animate">
            <BasePopover.Popup className="vm3-datepicker">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Bulan sebelumnya"
                  className="vm3-iconbtn"
                  onClick={() => moveMonth(-1)}
                >
                  <span className="material-symbols-rounded" aria-hidden>
                    chevron_left
                  </span>
                </button>
                <div className="font-semibold">
                  {view.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </div>
                <button
                  type="button"
                  aria-label="Bulan berikutnya"
                  className="vm3-iconbtn"
                  onClick={() => moveMonth(1)}
                >
                  <span className="material-symbols-rounded" aria-hidden>
                    chevron_right
                  </span>
                </button>
              </div>
              <div className="vm3-datepicker-grid">
                {DAY_NAMES.map((d) => (
                  <span key={d} className="vm3-datepicker-dow">
                    {d}
                  </span>
                ))}
                {cells.map((cell, i) => {
                  if (cell == null) return <span key={`e${i}`} />;
                  const { date, dateStr } = cell;
                  const isSelected = dateStr === value;
                  const isToday = dateStr === todayStr;
                  const isDisabled =
                    (min != null && dateStr < min) || (max != null && dateStr > max);
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={isDisabled}
                      className="vm3-datepicker-cell"
                      data-selected={isSelected || undefined}
                      data-today={isToday || undefined}
                      onClick={() => select(dateStr)}
                      aria-label={date.toLocaleDateString("id-ID")}
                      aria-pressed={isSelected}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </BasePopover.Popup>
          </motion.div>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

/* ---------- helpers ---------- */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

interface Cell {
  date: Date;
  dateStr: string;
}

function buildMonthGrid(view: Date): Array<Cell | null> {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Minggu
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Cell | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, dateStr: toISO(date) });
  }
  return cells;
}
