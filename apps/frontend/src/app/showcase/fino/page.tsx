"use client";

/**
 * FINO Showcase — replika video referensi (mint #e0f0d0 + lime #b0f080).
 * Mock finance dashboard: hero, date strip + modal, balance, 4 mini-stats,
 * Pengeluaran harian (area), Kategori (donut), Budget (bar), Dompet (h-bar),
 * Quick Insight, Daftar transaksi, Filter kategori.
 * Interaktif: calendar modal, category dropdown, count-up, bar grow, theme crossfade.
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";
import { container as stagger, listItem, scale as scaleVar, fade } from "@/design-system/motion/presets";
import { Card } from "@/components/vm3/Card";

const nf = new Intl.NumberFormat("id-ID");

// Mock data — sesuai OCR frame video
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const KATEGORI = [
  { label: "Makan", value: 28, color: "#6DAE2E" },
  { label: "Belanja", value: 18, color: "#F9A825" },
  { label: "Transportasi", value: 14, color: "#FF6F00" },
  { label: "Tagihan", value: 12, color: "#4FC3F7" },
  { label: "Rumah", value: 9, color: "#8E24AA" },
  { label: "Kesehatan", value: 7, color: "#E53935" },
  { label: "Pendidikan", value: 6, color: "#43A047" },
  { label: "Lainnya", value: 6, color: "#A1887F" },
];
const PENGELUARAN_HARIAN = [8, 12, 6, 18, 10, 22, 9, 14, 7, 16, 11, 20, 13, 9, 15, 6, 19, 10, 12, 8, 17, 14, 11, 13, 9, 16, 12, 10, 14, 18, 9];
const BUDGET = [
  { label: "Makan", used: 72, limit: 100, over: false },
  { label: "Belanja", used: 58, limit: 100, over: false },
  { label: "Transport", used: 110, limit: 100, over: true },
  { label: "Tagihan", used: 45, limit: 100, over: false },
  { label: "Rumah", used: 60, limit: 100, over: false },
  { label: "Kesehatan", used: 38, limit: 100, over: false },
  { label: "Pendidikan", used: 52, limit: 100, over: false },
  { label: "Lainnya", used: 110, limit: 100, over: true },
];
const DOMPET = [
  { label: "Bank", pct: 72, amount: 6_850_000 },
  { label: "Cash", pct: 18, amount: 1_720_000 },
  { label: "E-Wallet", pct: 10, amount: 712_500 },
];
const TRANSAKSI = [
  { cat: "Hiburan", nominal: 578_500, pct: 9 },
  { cat: "Makan", nominal: 430_500, pct: 8 },
  { cat: "Perawatan", nominal: 221_500, pct: 3 },
  { cat: "Kesehatan", nominal: 168_000, pct: 2 },
  { cat: "Belanja", nominal: 1_126_000, pct: 20 },
  { cat: "Transportasi", nominal: 1_973_000, pct: 29 },
  { cat: "Sosial", nominal: 173_500, pct: 3 },
  { cat: "Rumah", nominal: 592_500, pct: 9 },
  { cat: "Tagihan", nominal: 1_973_000, pct: 29, dup: true },
];
const TRANSAKSI_LIST = [
  { title: "Jajan sore", sub: "Makan · 18 Agu", amount: 42_000 },
  { title: "Bensin", sub: "Transportasi · 17 Agu", amount: 85_000 },
  { title: "Top up e-wallet", sub: "Transportasi · 16 Agu", amount: 150_000 },
  { title: "Listrik", sub: "Tagihan · 15 Agu", amount: 320_000 },
  { title: "Belanja bulanan", sub: "Rumah · 14 Agu", amount: 445_000 },
];

// (CountUp helper removed — values static in showcase; use inline CountUp where needed)

// Donut SVG
function Donut({ data }: { data: typeof KATEGORI }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const total = data.reduce((a, b) => a + b.value, 0);
  const reduced = useVm3ReducedMotion();
  const segments = useMemo(() => {
    const lens = data.map((k) => (k.value / total) * c);
    return data.map((k, idx) => ({
      label: k.label,
      color: k.color,
      len: lens[idx],
      offset: lens.slice(0, idx).reduce((a, b) => a + b, 0),
    }));
  }, [data, total, c]);
  return (
    <div className="relative grid place-items-center">
      <svg width={140} height={140} viewBox="0 0 140 140" className="-rotate-90">
        <circle cx={70} cy={70} r={r} fill="none" stroke="var(--vm3-color-surface-container-high)" strokeWidth={18} />
        {segments.map((s, i) => {
          const dash = `${s.len} ${c - s.len}`;
          return (
            <motion.circle
              key={s.label}
              cx={70}
              cy={70}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={18}
              strokeDasharray={dash}
              strokeDashoffset={-s.offset}
              strokeLinecap="round"
              initial={reduced ? false : { strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: dash }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.05, 0.7, 0.1, 1] }}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute text-center">
        <div className="text-[10px] font-medium tracking-wide text-on-surface-variant">TOTAL</div>
        <div className="text-sm font-semibold tabular-nums">Rp 9,8 jt</div>
      </div>
    </div>
  );
}

export default function FinoShowcasePage() {
  const reduced = useVm3ReducedMotion();
  const [activeDay, setActiveDay] = useState(17);
  const [showCal, setShowCal] = useState(false);
  const [filterCat, setFilterCat] = useState("Semua kategori");
  const [showFilter, setShowFilter] = useState(false);
  const [filterMode, setFilterMode] = useState<"Hari" | "Kategori">("Hari");

  const vContainer = withReducedMotion(stagger(0.06), reduced);
  const vItem = withReducedMotion(listItem, reduced);

  const filteredBudget = useMemo(() => BUDGET, []);

  return (
    <div className="min-h-dvh bg-surface p-3 sm:p-4">
      <div className="mx-auto max-w-5xl">
        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-on-primary">
              <span className="material-symbols-rounded text-sm" aria-hidden>savings</span>
            </span>
            <span className="text-sm font-bold tracking-tight">FINO</span>
            <span className="hidden text-xs text-on-surface-variant sm:inline">Aether Family Finance</span>
          </div>
          <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">Agustus 2026</span>
        </div>

        <motion.div variants={vContainer} initial="hidden" animate="show" className="flex flex-col gap-4">
          {/* Hero */}
          <motion.div variants={vItem}>
            <div className="relative overflow-hidden rounded-2xl bg-primary-container p-5 sm:p-6">
              {/* dekor blobs ala video */}
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                <motion.div
                  className="absolute -right-6 top-6 h-28 w-48 rounded-full opacity-20"
                  style={{ background: "var(--vm3-color-primary)" }}
                  animate={reduced ? undefined : { y: [0, -6, 0] }}
                  transition={reduced ? undefined : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute right-14 top-5 h-8 w-16 rounded-full border-2 border-on-primary-container/20" />
                <div className="absolute bottom-4 left-20 h-5 w-28 rounded-full bg-primary/10" />
                <svg className="absolute right-24 top-8 h-14 w-14 opacity-25" viewBox="0 0 64 64" fill="none">
                  <path d="M6 44 C 22 10, 38 10, 54 30" stroke="currentColor" className="text-on-primary-container" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="2 6" />
                </svg>
              </div>
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium tracking-wide text-on-primary-container/60">APLIKASI</p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight text-on-primary-container sm:text-2xl">Selamat pagi, Fino</h1>
                  <p className="mt-1 max-w-[48ch] text-sm leading-5 text-on-primary-container/70">
                    Mulai hari dengan yang jernih · 1 Agustus 2026 – 31 Agustus 2026
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCal(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-on-surface shadow-sm "
                  >
                    <span className="material-symbols-rounded text-sm" aria-hidden>calendar_month</span>
                    Agustus 2026
                    <span className="material-symbols-rounded text-sm opacity-60" aria-hidden>expand_more</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full px-3 py-2 text-xs shadow-sm ">
                    <span className="font-medium">Saldo berjalan</span>
                    <span className="ml-2 font-semibold tabular-nums">0 hari</span>
                  </span>
                  <span className="rounded-full px-3 py-2 text-xs shadow-sm ">
                    <span className="font-medium">Sisa</span>
                    <span className="ml-2 font-semibold tabular-nums">29 hari</span>
                  </span>
                </div>
              </div>

              {/* Date strip like video */}
              <div className="relative mt-5 -mx-1 overflow-x-auto scrollbar-none">
                <div className="flex gap-1.5 px-1">
                  {DAYS.slice(0, 18).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setActiveDay(d)}
                      className={`grid min-w-10 place-items-center rounded-2xl px-2 py-2 text-xs font-medium transition ${activeDay === d ? "bg-primary text-on-primary shadow" : "bg-surface-container-high text-on-surface hover:bg-surface-container"}`}
                    >
                      <span className="text-[10px] opacity-60">KAM</span>
                      <span className="text-sm tabular-nums">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Row: summary pills + balance card */}
          <motion.div variants={vItem} className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="grid grid-cols-3 gap-3">
              <Card variant="filled" className="rounded-xl p-4">
                <div className="text-[11px] font-medium tracking-wide text-on-surface-variant">PEMASUKAN BULAN INI</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-semibold tabular-nums">Rp 0</span>
                  <span className="text-xs text-on-surface-variant">dari tahun lalu: di atas</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                  <div className="h-full w-[13%] rounded-full bg-primary" />
                </div>
                <div className="mt-1 text-[11px] tabular-nums text-on-surface-variant">13 / 31</div>
              </Card>
              <Card variant="filled" className="rounded-xl p-4">
                <div className="text-[11px] font-medium tracking-wide text-on-surface-variant">PENGELUARAN BULAN INI</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">Rp 6.702.000</div>
                <div className="mt-2 flex h-7 items-end gap-0.5" aria-hidden>
                  {PENGELUARAN_HARIAN.slice(0, 12).map((v, i) => (
                    <span key={i} className="flex-1 rounded-full bg-primary/25" style={{ height: `${30 + (v / 22) * 60}%` }} />
                  ))}
                </div>
              </Card>
              <Card variant="filled" className="rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium tracking-wide text-on-surface-variant">TRANSAKSI</span>
                  <span className="material-symbols-rounded text-sm text-on-surface-variant" aria-hidden>receipt_long</span>
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">54</div>
                <div className="mt-1 text-xs text-on-surface-variant">Per 1 Agu – 31 Agu</div>
              </Card>
            </div>
            <motion.div whileHover={reduced ? undefined : { y: -1 }} className="rounded-xl bg-primary p-5 text-on-primary shadow-md">
              <div className="flex items-center gap-2 text-xs opacity-90">
                <span className="grid size-7 place-items-center rounded-full bg-on-primary/15">
                  <span className="material-symbols-rounded text-sm" aria-hidden>account_balance_wallet</span>
                </span>
                FINO · Cash + Bank
                <span className="ml-auto size-1.5 rounded-full bg-on-primary/60" />
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">Rp 9.894.500</div>
              <div className="mt-1 text-xs opacity-75">Semua dompet</div>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-on-primary/15 px-3 py-1 text-xs">Kirim</span>
                <span className="rounded-full bg-on-primary px-3 py-1 text-xs font-medium text-primary">Isi</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Charts row 1 */}
          <motion.div variants={vItem} className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card variant="elevated" className="rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight">Pengeluaran harian</h3>
                <div className="flex items-center gap-1 rounded-full bg-surface-container-high p-1">
                  <button
                    type="button"
                    onClick={() => setFilterMode("Hari")}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${filterMode === "Hari" ? "bg-surface shadow-sm" : "text-on-surface-variant"}`}
                  >
                    Per hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("Kategori")}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${filterMode === "Kategori" ? "bg-surface shadow-sm" : "text-on-surface-variant"}`}
                  >
                    Per transaksi
                  </button>
                </div>
              </div>
              <div className="mt-4 h-40">
                <svg viewBox="0 0 300 120" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id="fino-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--vm3-color-primary)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--vm3-color-primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* area fill */}
                  <path
                    d={`M0 90 ${PENGELUARAN_HARIAN.map((v, i) => `L ${(i / (PENGELUARAN_HARIAN.length - 1)) * 300} ${90 - (v / 24) * 70}`).join(" ")} L300 90 Z`}
                    fill="url(#fino-area)"
                  />
                  {/* line */}
                  <path
                    d={`M0 90 ${PENGELUARAN_HARIAN.map((v, i) => `L ${(i / (PENGELUARAN_HARIAN.length - 1)) * 300} ${90 - (v / 24) * 70}`).join(" ")}`}
                    fill="none"
                    stroke="var(--vm3-color-primary)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-on-surface-variant tabular-nums">
                <span>1 Agu</span>
                <span>31 Agu</span>
              </div>
            </Card>

            <Card variant="elevated" className="rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">Kategori</h3>
                <button
                  type="button"
                  onClick={() => setShowFilter((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1 text-xs"
                >
                  <span className="size-2 rounded-full bg-primary" aria-hidden />
                  {filterCat}
                </button>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <Donut data={KATEGORI} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  {KATEGORI.slice(0, 6).map((k) => (
                    <div key={k.label} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: k.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{k.label}</span>
                      <span className="tabular-nums text-on-surface-variant">{k.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Charts row 2 */}
          <motion.div variants={vItem} className="grid gap-4 lg:grid-cols-3">
            <Card variant="elevated" className="rounded-xl p-4 sm:p-5">
              <h3 className="text-sm font-semibold tracking-tight">Budget kategori</h3>
              <div className="mt-4 flex h-32 items-end gap-1.5">
                {filteredBudget.map((b, i) => (
                  <motion.div
                    key={b.label}
                    initial={reduced ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: i * 0.04, ease: [0.05, 0.7, 0.1, 1] }}
                    style={{ height: `${Math.min(b.used, 100)}%`, transformOrigin: "bottom" }}
                    className={`flex-1 rounded-t-md ${b.over ? "bg-error" : "bg-primary"}`}
                    title={`${b.label}: ${b.used}%`}
                  />
                ))}
              </div>
              <div className="mt-2 flex gap-1 overflow-x-auto text-[10px] tracking-wide text-on-surface-variant">
                {filteredBudget.map((b) => (
                  <span key={b.label} className="min-w-0 flex-1 truncate text-center">
                    {b.label.slice(0, 4)}
                  </span>
                ))}
              </div>
            </Card>

            <Card variant="elevated" className="rounded-xl p-4 sm:p-5">
              <h3 className="text-sm font-semibold tracking-tight">Dompet</h3>
              <div className="mt-4 space-y-3">
                {DOMPET.map((d, i) => (
                  <div key={d.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{d.label}</span>
                      <span className="tabular-nums text-on-surface-variant">{d.pct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-container-high">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: i === 0 ? "var(--vm3-color-primary)" : i === 1 ? "var(--vm3-color-secondary)" : "var(--vm3-color-tertiary)" }}
                        initial={reduced ? false : { width: 0 }}
                        whileInView={{ width: `${d.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: [0.05, 0.7, 0.1, 1] }}
                      />
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-on-surface-variant">Rp {nf.format(d.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="elevated" className="rounded-xl p-4 sm:p-5">
              <h3 className="text-sm font-semibold tracking-tight">Quick insight</h3>
              <div className="mt-4 space-y-3">
                <div className="flex gap-3 rounded-xl bg-primary-container p-3 text-on-primary-container">
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-on-primary">
                    <span className="material-symbols-rounded text-sm" aria-hidden>school</span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">Tagihan</div>
                    <div className="text-xs leading-4 opacity-80">Tagihan terbesar bulan ini: Rp 320.000</div>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl bg-surface-container p-3">
                  <span className="grid size-8 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
                    <span className="material-symbols-rounded text-sm" aria-hidden>account_balance</span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">Bank</div>
                    <div className="text-xs leading-4 text-on-surface-variant">Saldo Bank naik 11% dari awal bulan</div>
                  </div>
                </div>
                <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Lihat semua insight
                  <span className="material-symbols-rounded text-sm" aria-hidden>chevron_right</span>
                </button>
              </div>
            </Card>
          </motion.div>

          {/* Daftar per kategori — seperti di video bawah */}
          <motion.div variants={vItem}>
            <Card variant="elevated" className="overflow-hidden rounded-xl">
              <div className="flex items-center gap-2 p-4">
                <span className="material-symbols-rounded text-primary" aria-hidden>category</span>
                <h3 className="flex-1 text-sm font-semibold tracking-tight">Pengeluaran per kategori</h3>
                <span className="text-xs text-on-surface-variant">Agustus 2026</span>
              </div>
              <div className="grid grid-cols-2 gap-0 border-y border-outline-variant/40 sm:grid-cols-4 lg:grid-cols-5">
                {TRANSAKSI.slice(0, 10).map((t) => (
                  <div key={t.cat + t.nominal} className="border-b border-r border-outline-variant/30 p-3 last:border-r-0 sm:p-4">
                    <div className="text-xs text-on-surface-variant">{t.cat}</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">Rp {nf.format(t.nominal)}</div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${t.pct}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] tabular-nums text-on-surface-variant">{t.pct}%</div>
                  </div>
                ))}
              </div>
              <div className="p-4">
                <h4 className="text-sm font-semibold">Daftar transaksi</h4>
                <p className="text-xs text-on-surface-variant">7 Agustus 2026 – 31 Agustus 2026</p>
                <ul className="mt-3 divide-y divide-outline-variant/30">
                  {TRANSAKSI_LIST.map((tr) => (
                    <li key={tr.title} className="flex items-center gap-3 py-3">
                      <span className="grid size-8 place-items-center rounded-full bg-surface-container-high">
                        <span className="material-symbols-rounded text-sm text-on-surface-variant" aria-hidden>payments</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{tr.title}</div>
                        <div className="text-xs text-on-surface-variant">{tr.sub}</div>
                      </div>
                      <span className="text-sm font-medium tabular-nums">Rp {nf.format(tr.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Calendar modal — seperti frame 030 */}
        <AnimatePresence>
          {showCal && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-scrim/40 "
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCal(false)}
              />
              <motion.div
                className="fixed inset-0 z-50 grid place-items-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  variants={withReducedMotion(scaleVar, reduced)}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full max-w-sm rounded-xl bg-surface-container-low p-5 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Agustus 2026</h2>
                    <button type="button" aria-label="Tutup" onClick={() => setShowCal(false)} className="grid size-8 place-items-center rounded-full hover:bg-on-surface/8">
                      <span className="material-symbols-rounded" aria-hidden>close</span>
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
                    {["S", "S", "R", "K", "J", "S", "M"].map((d) => (
                      <span key={d} className="py-1 font-medium text-on-surface-variant">
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setActiveDay(d);
                          setShowCal(false);
                        }}
                        className={`grid size-8 place-items-center rounded-full text-xs tabular-nums ${d === activeDay ? "bg-primary font-semibold text-on-primary" : d % 5 === 0 ? "bg-primary-container font-medium text-on-primary-container" : "hover:bg-surface-container"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-on-surface-variant">31 transaksi · Rp 7.102.500 keluar bulan ini</p>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Filter dropdown — seperti frame 090 */}
        <AnimatePresence>
          {showFilter && (
            <>
              <motion.div className="fixed inset-0 z-30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFilter(false)} />
              <motion.div
                variants={withReducedMotion(fade, reduced)}
                initial="initial"
                animate="animate"
                exit="exit"
                className="fixed right-4 top-24 z-40 w-64 rounded-2xl bg-surface-container-low p-3 shadow-2xl"
              >
                <div className="text-xs font-medium text-on-surface-variant">Filter ditampilkan</div>
                <div className="mt-2 space-y-1 text-sm">
                  {["Semua kategori", "Makan", "Belanja", "Transportasi", "Tagihan", "Rumah", "Kesehatan", "Pendidikan", "Lainnya"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setFilterCat(c);
                        setShowFilter(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-full px-3 py-2 text-left ${filterCat === c ? "bg-primary-container font-medium text-on-primary-container" : "hover:bg-surface-container"}`}
                    >
                      {filterCat === c && <span className="material-symbols-rounded text-sm" aria-hidden>check</span>}
                      {c}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
