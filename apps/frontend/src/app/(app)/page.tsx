"use client";

/**
 * Dashboard UPH — FINO edition (video ref: mint #e0f0d0 + lime #b0f080).
 * Visual: hero gradient + dekor blob (parallax), entrance berjenjang,
 * angka count-up, bar UPH tumbuh (scaleY stagger), scrim modal,
 * tema crossfade 360ms — semua hormati prefers-reduced-motion.
 * Logika data tidak berubah: /rdps/dashboard + /rdps/total-po-scan.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from "motion/react";
import { http } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/vm3/Button";
import { Card } from "@/components/vm3/Card";
import { IconButton } from "@/components/vm3/IconButton";
import { SearchField } from "@/components/vm3/SearchField";
import { container as staggerContainer, listItem } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";

const REFRESH_MS = 30_000;

const nfID = new Intl.NumberFormat("id-ID");
const timeFmt = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateLong = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
function fmtJam(jam: number): string {
  return timeFmt.format(new Date(2024, 0, 1, jam));
}

interface UphRow {
  time: number;
  record: string;
}
interface DashboardData {
  model: string;
  suph: string | null;
  total: number;
  uph: UphRow[];
}
interface DashboardResponse {
  data: DashboardData[];
  subline: Array<{ subline: string }>;
}
interface PoScanRow {
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
function FinoHero({
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
          {/* Highlight — primaryContainer: di light = mint #cbeda5 (kontras dark text), di dark = olive #334e17 (kontras light text) */}
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
type Tone = "primary" | "secondary" | "tertiary";
const toneChip: Record<Tone, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary text-on-secondary",
  tertiary: "bg-tertiary text-on-tertiary",
};

function StatCard({
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const qAwal = searchParams.get("q") ?? "";
  const reduced = useVm3ReducedMotion();
  const { user } = useAuth();

  const [keyword, setKeyword] = useState(qAwal);
  const [appliedQ, setAppliedQ] = useState(qAwal);
  const [data, setData] = useState<DashboardData[] | null>(null);
  const [subline, setSubline] = useState<string[]>([]);
  const [poRows, setPoRows] = useState<PoScanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (kw: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const params = kw ? `?keyword=${encodeURIComponent(kw)}` : "";
      const [dash, po] = await Promise.all([
        http.get<DashboardResponse>(`/rdps/dashboard${params}`, { signal: ctrl.signal }),
        http.get<{ data: PoScanRow[] }>("/rdps/total-po-scan?limit=20", { signal: ctrl.signal }),
      ]);
      if (ctrl.signal.aborted) return;
      setData(dash.data);
      setSubline(dash.subline.map((s) => s.subline));
      setPoRows(po.data ?? []);
      setUpdatedAt(new Date());
    } catch (err) {
      if (ctrl.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(appliedQ), 0);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") load(appliedQ);
    }, REFRESH_MS);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      abortRef.current?.abort();
    };
  }, [appliedQ, load]);

  const applySearch = (value: string) => {
    const q = value.trim();
    setKeyword(q);
    setAppliedQ(q);
    window.history.replaceState(null, "", q ? `/?q=${encodeURIComponent(q)}` : "/");
  };

  const totalUnits = data?.reduce((acc, d) => acc + (d.total ?? 0), 0) ?? 0;

  const vContainer = withReducedMotion(staggerContainer(0.07), reduced);
  const vItem = withReducedMotion(listItem, reduced);
  const greeting = `Selamat pagi, ${user?.username ?? "Operator"}`;

  return (
    <motion.div
      variants={vContainer}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-7xl flex-col gap-6"
    >
      <p role="status" className="sr-only">
        {loading ? "Memuat dashboard…" : updatedAt ? `Diperbarui pukul ${timeFmt.format(updatedAt)}` : ""}
      </p>

      {/* Hero */}
      <motion.div variants={vItem}>
        <FinoHero
          greeting={greeting}
          subtitle="Pantau output per jam tiap model dan line — terinspirasi FINO, tetap data UPH real-time."
          totalUnits={totalUnits}
          hasData={data !== null && !error}
          keyword={keyword}
          onKeywordChange={setKeyword}
          onSearch={() => applySearch(keyword)}
          onClear={() => applySearch("")}
        />
      </motion.div>

      {/* Stats — FINO 3 kartu + hint */}
      <motion.div variants={vItem} className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-3">
        <StatCard label="Total Scan" value={totalUnits} icon="analytics" tone="primary" placeholder={data === null && !error} hint="hari ini" />
        <StatCard label="Model Aktif" value={data?.length ?? 0} icon="precision_manufacturing" tone="secondary" placeholder={data === null && !error} hint={`${subline.length} subline`} />
        <StatCard label="Subline" value={subline.length} icon="alt_route" tone="tertiary" placeholder={data === null && !error} hint="terdaftar" />
      </motion.div>

      {/* Kontrol umur data — FINO pill */}
      <motion.div variants={vItem} className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1.5">
          <IconButton icon="refresh" label="Muat ulang data" onClick={() => load(appliedQ)} disabled={loading} />
          <span className="tabular-nums">{updatedAt ? `Diperbarui ${timeFmt.format(updatedAt)}` : "Belum dimuat"}</span>
          <span aria-hidden>·</span>
          <span>auto 30s</span>
        </span>
        {appliedQ && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1.5 text-on-primary-container">
            <span className="material-symbols-rounded text-sm" aria-hidden>filter_alt</span>
            {appliedQ}
            <button type="button" aria-label="Hapus filter" onClick={() => applySearch("")} className="ml-1 grid size-5 place-items-center rounded-full hover:bg-on-primary-container/10">
              <span className="material-symbols-rounded text-sm" aria-hidden>close</span>
            </button>
          </span>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            variants={vItem}
            initial="hidden"
            animate="show"
            exit="exit"
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-error-container px-5 py-4 text-on-error-container"
          >
            <span className="material-symbols-rounded" aria-hidden>cloud_off</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Gagal memuat dashboard</p>
              <p className="mt-0.5 break-words text-sm opacity-90">{error}</p>
            </div>
            <Button variant="text" className="text-on-error-container" onClick={() => load(appliedQ)}>
              Coba Lagi
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && data === null && !error && (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-surface-container-high" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl bg-surface-container-high" />
          <span className="sr-only">Memuat dashboard</span>
        </div>
      )}

      {data !== null && !error && (
        <motion.div variants={vItem} className="flex flex-col gap-5">
          <section aria-label="UPH per model" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-xl text-primary" aria-hidden>monitoring</span>
              <h2 className="text-base font-semibold tracking-tight">UPH per Model</h2>
              <span className="ml-auto rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant tabular-nums">
                {nfID.format(data.length)} model
              </span>
            </div>
            <div className="grid gap-4 grid-cols-1">
              {data.length === 0 && (
                <Card variant="elevated" className="col-span-full rounded-xl p-8 text-center">
                  <p className="font-medium">Tidak ada model yang cocok</p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Coba kata kunci lain atau{" "}
                    <button type="button" className="text-primary underline underline-offset-2" onClick={() => applySearch("")}>
                      hapus pencarian
                    </button>
                    .
                  </p>
                </Card>
              )}
              {data.map((row) => (
                <UphCard key={row.model} row={row} />
              ))}
            </div>
          </section>

          <PoTable rows={poRows} adaFilter={Boolean(appliedQ)} />
        </motion.div>
      )}
    </motion.div>
  );
}

/* ---------- Kartu UPH per model — detail penuh (SpaceX dashboard) ---------- */
function UphCard({ row }: { row: DashboardData }) {
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
      {/* header */}
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
function PoTable({ rows, adaFilter }: { rows: PoScanRow[]; adaFilter: boolean }) {
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

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
