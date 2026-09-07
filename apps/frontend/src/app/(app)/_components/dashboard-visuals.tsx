"use client";

// Presentasi dashboard: count-up, hero, kartu stat, kartu UPH, tabel PO.
// Murni tampilan — pengambilan data ada di page.tsx.

import { useEffect, useMemo, useState } from "react";
import { motion, animate, useMotionValue, useTransform } from "motion/react";
import { Button } from "@/components/vm3/Button";
import { Card } from "@/components/vm3/Card";
import { SearchField } from "@/components/vm3/SearchField";
import { useVm3ReducedMotion } from "@/hooks/useVm3ReducedMotion";

export const nfID = new Intl.NumberFormat("id-ID");
export const timeFmt = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateLong = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

export function fmtJam(jam: number): string {
  return timeFmt.format(new Date(2024, 0, 1, jam));
}

export interface UphRow {
  time: number;
  record: string;
}
export interface DashboardData {
  model: string;
  suph: string | null;
  total: number;
  uph: UphRow[];
}
export interface DashboardResponse {
  data: DashboardData[];
  subline: Array<{ subline: string }>;
}
export interface PoScanRow {
  model: string;
  order_number: string;
  po_number: string;
  subline: string;
  countsubline: number;
}

/* ---------- Angka count-up ---------- */
function CountUp({ value }: { value: number }) {
  const reduced = useVm3ReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const text = useTransform(mv, (v) => nfID.format(Math.round(v)));
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.55, ease: [0.05, 0.7, 0.1, 1] });
    return () => c.stop();
  }, [value, reduced, mv]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

/* ---------- Hero — solid, kontras jelas (light/dark terasa beda) ---------- */
export function FinoHero({
  greeting,
  subtitle,
  totalUnits,
  hasData,
  keyword,
  onKeywordChange,
  onSearch,
  onClear,
}: {
  greeting: string;
  subtitle: string;
  totalUnits: number;
  hasData: boolean;
  keyword: string;
  onKeywordChange: (v: string) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  return (
    <Card variant="filled" className="overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary">AC SYSTEM</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold text-on-surface sm:text-[26px]">{greeting}</h1>
          <p className="mt-1 max-w-[52ch] text-pretty text-sm leading-5 text-on-surface-variant">{subtitle}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="material-symbols-rounded text-sm" aria-hidden>
              calendar_today
            </span>
            {dateLong.format(new Date())}
            <span aria-hidden>·</span>
            <span className="tabular-nums">{hasData ? `${nfID.format(totalUnits)} unit terdata` : "memuat data…"}</span>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[320px]">
          <div className="rounded-xl bg-primary-container px-5 py-4 text-on-primary-container">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="material-symbols-rounded text-base" aria-hidden>
                analytics
              </span>
              Total Scan Hari Ini
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums leading-none">
              {hasData ? <CountUp value={totalUnits} /> : "–"}
            </div>
            <div className="mt-1 text-xs opacity-80">Semua line · semua kategori</div>
          </div>

          <form
            role="search"
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch();
            }}
          >
            <div className="min-w-0 flex-1">
              <SearchField
                value={keyword}
                onChange={onKeywordChange}
                onClear={onClear}
                placeholder="Cari line / subline…"
                name="q"
              />
            </div>
            <Button type="submit" icon="search" className="shrink-0">
              Cari
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}

/* ---------- StatCard — kontras tegas di light & dark ---------- */
export type Tone = "primary" | "secondary" | "tertiary";const toneChip: Record<Tone, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary text-on-secondary",
  tertiary: "bg-tertiary text-on-tertiary",
};

export function StatCard({
  label,
  value,
  icon,
  tone,
  placeholder,
  hint,
}: {
  label: string;
  value: number;
  icon: string;
  tone: Tone;
  placeholder: boolean;
  hint?: string;
}) {
  const reduced = useVm3ReducedMotion();
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="h-full"
    >
      <Card variant="elevated" className="flex h-full flex-col gap-3 rounded-xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`material-symbols-rounded grid size-10 shrink-0 place-items-center rounded-full text-[22px] [font-variation-settings:'FILL'_1,'wght'_500,'GRAD'_0,'opsz'_24] ${toneChip[tone]}`}
            aria-hidden
          >
            {icon}
          </span>
          {hint && (
            <span className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-medium text-on-surface-variant">
              {hint}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium tracking-wide text-on-surface-variant">{label}</div>
          <div className="mt-1 text-3xl leading-none font-semibold tracking-tight sm:text-[30px]">
            {placeholder ? <span className="text-on-surface-variant">–</span> : <CountUp value={value} />}
          </div>
        </div>
        {/* mini sparkline decor (FINO: chart kecil di stat) */}
        <div className="mt-auto flex h-7 items-end gap-0.5 opacity-60" aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full ${tone === "primary" ? "bg-primary/30" : tone === "secondary" ? "bg-secondary/30" : "bg-tertiary/25"}`}
              style={{ height: `${30 + Math.sin(i * 0.9 + value * 0.001) * 30 + ((i * 37) % 20)}%` }}
            />
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

/* ---------- Kartu UPH per model — detail penuh (SpaceX dashboard) ---------- */
export function UphCard({ row }: { row: DashboardData }) {
  const reduced = useVm3ReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const uph = row.uph ?? [];
  const sorted = [...uph].sort((a, b) => a.time - b.time);
  const records = sorted.map((u) => Number(u.record));
  const maxRecord = Math.max(...records, 1);
  const suphNum = row.suph != null && row.suph !== "" ? Number(row.suph) : NaN;
  const pakaiTarget = Number.isFinite(suphNum);
  const targetPct = pakaiTarget ? Math.min(100, Math.max(0, (suphNum / maxRecord) * 100)) : null;
  const totalJam = sorted.length;
  const hit = pakaiTarget ? sorted.filter((u) => Number(u.record) >= suphNum).length : 0;
  const hitRate = totalJam ? Math.round((hit / totalJam) * 100) : 0;
  const rata = totalJam ? Math.round(records.reduce((a, b) => a + b, 0) / totalJam) : 0;
  const jamTertinggi = totalJam ? sorted.reduce((a, b) => (Number(b.record) > Number(a.record) ? b : a)) : null;
  // skala Y: bulatkan ke kelipatan 5/10
  const yMax = Math.max(maxRecord, suphNum || 0);
  const yStep = yMax <= 20 ? 5 : yMax <= 50 ? 10 : 20;
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, i) => i * yStep);

  return (
    <Card variant="elevated" className="overflow-hidden rounded-xl">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="hidden size-2 rounded-full bg-primary sm:block" aria-hidden />
            <h3 className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">{row.model}</h3>
            <span className="hidden rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-medium tracking-wide text-on-primary-container sm:inline-flex">UPH</span>
          </div>
          <p className="mt-1 text-xs leading-none text-on-surface-variant tabular-nums">
            Std <span className="font-medium text-on-surface">{pakaiTarget ? nfID.format(suphNum) : "—"}/jam</span>
            <span aria-hidden> · </span>
            Total <span className="font-medium text-on-surface">{nfID.format(row.total)}</span>
            <span aria-hidden> · </span>
            {totalJam} jam
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-on-surface-variant">Capaian</div>
          <div className="text-sm font-semibold tabular-nums leading-none">{pakaiTarget ? `${hitRate}%` : "—"}</div>
          <div className="text-[11px] text-on-surface-variant tabular-nums">{pakaiTarget ? `${hit}/${totalJam} jam` : `${totalJam} jam`}</div>
        </div>
      </div>

      {/* insight mini */}
      <div className="mx-4 flex flex-wrap gap-2 border-y border-outline-variant/40 py-2.5 text-xs sm:mx-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface-variant">
          <span className="material-symbols-rounded text-sm" aria-hidden>avg_pace</span>
          Rata <b className="font-semibold text-on-surface tabular-nums">{nfID.format(rata)}/jam</b>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface-variant">
          <span className="material-symbols-rounded text-sm" aria-hidden>arrow_outward</span>
          Tertinggi <b className="font-semibold text-on-surface tabular-nums">{jamTertinggi ? `${nfID.format(Number(jamTertinggi.record))} @ ${fmtJam(jamTertinggi.time)}` : "—"}</b>
        </span>
        {pakaiTarget && (
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${hitRate >= 80 ? "bg-primary text-on-primary" : hitRate >= 50 ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"}`}>
            {hitRate >= 80 ? "● Optimal" : hitRate >= 50 ? "● Perlu perhatian" : "● Di bawah standar"}
          </span>
        )}
      </div>

      {/* chart */}
      <div
        className="p-4 sm:p-5"
        role="img"
        aria-label={totalJam === 0 ? `Grafik UPH ${row.model}: belum ada data` : `Grafik UPH ${row.model}: total ${nfID.format(row.total)} unit${pakaiTarget ? `, standar ${nfID.format(suphNum)}` : ""}`}
      >
        {totalJam === 0 ? (
          <div className="grid h-28 place-items-center rounded-lg border border-dashed border-outline-variant py-8 text-center">
            <p className="text-sm text-on-surface-variant">Belum ada data per jam</p>
          </div>
        ) : (
          <div className="relative">
            {/* grid + target */}
            <div className="relative h-[132px] pl-8">
              {/* Y ticks + grid */}
              <div aria-hidden className="pointer-events-none absolute inset-0 pl-8">
                {yTicks.map((v) => (
                  <div key={v} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(v / Math.max(yMax, 1)) * 100}%` }}>
                    <div className="h-px flex-1 bg-outline-variant/50" />
                  </div>
                ))}
              </div>
              {/* Y labels */}
              <div aria-hidden className="absolute inset-y-0 left-0 flex flex-col justify-between py-1 text-right text-[10px] leading-none text-on-surface-variant tabular-nums">
                {[...yTicks].reverse().map((v) => (
                  <span key={v} style={{ transform: "translateY(3px)" }}>{v}</span>
                ))}
              </div>
              {/* target line */}
              {targetPct != null && (
                <div aria-hidden className="absolute inset-x-0 z-10 ml-8 border-t border-dashed border-primary" style={{ bottom: `${targetPct}%` }}>
                  <span className="absolute -top-2 right-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-on-primary">STD {nfID.format(suphNum)}</span>
                </div>
              )}
              {/* hover tooltip */}
              {hover != null && sorted[hover] && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-lg bg-inverse-surface px-2.5 py-1.5 text-xs font-medium leading-none text-inverse-on-surface shadow-lg"
                  style={{
                    left: `calc(2rem + ${((hover + 0.5) / totalJam) * 100}% - 1rem)`,
                    bottom: `${Math.max(Number(sorted[hover].record) / Math.max(yMax, 1), 0.06) * 100 + 6}%`,
                  }}
                >
                  {fmtJam(sorted[hover].time)} · {nfID.format(Number(sorted[hover].record))} unit
                  {pakaiTarget && (Number(sorted[hover].record) >= suphNum ? " ✓" : " !")}
                </div>
              )}
              {/* bars */}
              <div aria-hidden className="absolute inset-0 ml-8 flex items-end gap-1 sm:gap-1.5" onMouseLeave={() => setHover(null)}>
                {sorted.map((u, i) => {
                  const nilai = Number(u.record);
                  const capai = pakaiTarget && nilai >= suphNum;
                  const hPct = Math.max(nilai > 0 ? 5 : 0, (nilai / Math.max(yMax, 1)) * 100);
                  return (
                    <div key={`${u.time}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <motion.div
                        onMouseEnter={() => setHover(i)}
                        initial={reduced ? false : { scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.38, delay: reduced ? 0 : Math.min(i * 0.035, 0.5), ease: [0.05, 0.7, 0.1, 1] }}
                        style={{ height: `${hPct}%`, transformOrigin: "bottom", minHeight: nilai > 0 ? 6 : 0 }}
                        className={`relative flex w-full cursor-default items-start justify-center rounded-t-md pt-1 text-[10px] font-medium leading-none transition ${capai ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface-variant border border-outline-variant/60"} ${hover === i ? "ring-1 ring-primary" : ""}`}
                      >
                        <span className={nilai === 0 ? "opacity-0" : ""}>{nilai > 0 ? nfID.format(nilai) : ""}</span>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* X labels — per jam, bukan hanya ujung */}
            <div className="ml-8 mt-2 grid gap-1 text-center text-[10px] leading-none text-on-surface-variant tabular-nums" style={{ gridTemplateColumns: `repeat(${totalJam}, minmax(0,1fr))` }}>
              {sorted.map((u) => (
                <span key={`x-${u.time}`} className="truncate">{fmtJam(u.time).replace(".", ":")}</span>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-on-surface-variant">
              <span>{fmtJam(sorted[0].time)} → {fmtJam(sorted[sorted.length - 1].time)}</span>
              <span className="tabular-nums">{totalJam} titik</span>
            </div>
          </div>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/40 bg-surface-container/50 px-4 py-2.5 text-xs sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-primary border border-primary" /> ≥ standar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-surface-container-highest border border-outline-variant" /> &lt; standar
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span aria-hidden className="w-5 border-t border-dashed border-primary" /> garis = standar
        </span>
      </div>

      {/* tabel detail — bukan sr-only lagi, jadi detail terasa */}
      <details className="group border-t border-outline-variant/30">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-primary sm:px-5">
          <span className="inline-flex items-center gap-1.5"><span className="material-symbols-rounded text-sm" aria-hidden>table_view</span> Detail per jam</span>
          <span className="material-symbols-rounded text-sm transition group-open:rotate-180" aria-hidden>expand_more</span>
        </summary>
        <div className="max-h-48 overflow-auto border-t border-outline-variant/30">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-container-high text-[11px] uppercase tracking-wide text-on-surface-variant">
              <tr><th className="px-4 py-2 font-medium">Pukul</th><th className="px-4 py-2 text-right font-medium">Unit</th><th className="px-4 py-2 text-right font-medium">vs Std</th></tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const v = Number(u.record);
                const diff = pakaiTarget ? v - suphNum : null;
                return (
                  <tr key={`row-${u.time}`} className="border-b border-outline-variant/30 last:border-0 hover:bg-surface-container/50">
                    <td className="px-4 py-1.5 tabular-nums">{fmtJam(u.time)}</td>
                    <td className="px-4 py-1.5 text-right font-medium tabular-nums">{nfID.format(v)}</td>
                    <td className={`px-4 py-1.5 text-right tabular-nums ${diff == null ? "text-on-surface-variant" : diff >= 0 ? "text-primary font-medium" : "text-error"}`}>{diff == null ? "—" : `${diff > 0 ? "+" : ""}${nfID.format(diff)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

/* ---------- Tabel Total Scan per PO (FINO polish) ---------- */
export function PoTable({ rows, adaFilter, onExport, exportingKey }: { rows: PoScanRow[]; adaFilter: boolean; onExport?: (row: PoScanRow) => void; exportingKey?: string | null }) {
  const [sortAsc, setSortAsc] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) => (sortAsc ? a.countsubline - b.countsubline : b.countsubline - a.countsubline)), [rows, sortAsc]);
  return (
    <Card variant="elevated" className="overflow-hidden rounded-xl">
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <span className="grid size-9 place-items-center rounded-full bg-primary-container text-primary" aria-hidden>
          <span className="material-symbols-rounded text-xl">receipt_long</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight sm:text-base">Total Scan per PO</h2>
          <p className="text-xs text-on-surface-variant">20 PO terbaru · urutkan via header</p>
        </div>
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant tabular-nums">
          {nfID.format(rows.length)} PO
        </span>
      </div>
      <div role="region" aria-label="Tabel total scan per PO" tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Dua puluh purchase order terakhir dengan jumlah scan per subline</caption>
          <thead>
            <tr className="border-y border-outline-variant/60 bg-surface-container/50 text-xs uppercase tracking-wide text-on-surface-variant">
              <th scope="col" className="p-3 font-medium">Model</th>
              <th scope="col" className="hidden p-3 font-medium md:table-cell">Order</th>
              <th scope="col" className="p-3 font-medium">PO</th>
              <th scope="col" className="p-3 font-medium">Subline</th>
              <th scope="col" aria-sort={sortAsc ? "ascending" : "descending"} className="p-3 text-right font-medium">
                <button type="button" onClick={() => setSortAsc((v) => !v)} className="inline-flex items-center gap-1 hover:text-on-surface">
                  Scan
                  <span className="material-symbols-rounded text-sm transition-transform" aria-hidden>
                    {sortAsc ? "arrow_upward" : "arrow_downward"}
                  </span>
                </button>
              </th>
              {onExport && <th scope="col" className="p-3"><span className="sr-only">Ekspor</span></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={`${row.po_number}-${row.subline}-${i}`} className="border-b border-outline-variant/40 last:border-0 transition-colors duration-100 hover:bg-primary-container/20">
                <td className="p-3 font-medium">{row.model}</td>
                <td className="hidden p-3 md:table-cell">{row.order_number}</td>
                <td className="p-3 font-mono text-xs sm:text-sm">{row.po_number}</td>
                <td className="p-3"><span className="rounded-full bg-secondary-container px-2.5 py-1 text-xs font-medium text-on-secondary-container">{row.subline}</span></td>
                <td className="p-3 text-right font-medium tabular-nums">{nfID.format(row.countsubline)}</td>
                {onExport && (
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      disabled={exportingKey === `${row.po_number}-${row.subline}`}
                      onClick={() => onExport(row)}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {exportingKey === `${row.po_number}-${row.subline}` ? "…" : "Export"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-10 text-center text-on-surface-variant">
            <span className="material-symbols-rounded mb-2 block text-3xl opacity-40" aria-hidden>inbox</span>
            {adaFilter ? "Belum ada data untuk filter ini." : "Belum ada data yang tercatat."}
          </div>
        )}
      </div>
    </Card>
  );
}
