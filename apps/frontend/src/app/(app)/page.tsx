"use client";

/**
 * Dashboard UPH — orkestrasi data (fetch, filter, refresh, state).
 * Semua tampilan (hero, stat, kartu UPH, tabel PO) ada di
 * ./_components/dashboard-visuals.tsx.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { downloadFile, http } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/vm3/Button";
import { Card } from "@/components/vm3/Card";
import { IconButton } from "@/components/vm3/IconButton";
import { container as staggerContainer, listItem } from "@/design-system/motion/presets";
import { useVm3ReducedMotion, withReducedMotion } from "@/hooks/useVm3ReducedMotion";
import {
  FinoHero,
  StatCard,
  UphCard,
  PoTable,
  nfID,
  timeFmt,
  type DashboardData,
  type DashboardResponse,
  type PoScanRow,
} from "./_components/dashboard-visuals";

const REFRESH_MS = 30_000;

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
  const [exportingRow, setExportingRow] = useState<string | null>(null);
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

  const exportPo = async (row: PoScanRow) => {
    const key = `${row.po_number}-${row.subline}`;
    setExportingRow(key);
    try {
      const query = new URLSearchParams({
        model: row.model,
        order_number: row.order_number,
        po_number: row.po_number,
        subline: row.subline,
      });
      await downloadFile(`/rdps/export-odf-po-all.xlsx?${query}`, "allHistory.xlsx");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh XLSX.");
    } finally {
      setExportingRow(null);
    }
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

          <PoTable rows={poRows} adaFilter={Boolean(appliedQ)} onExport={exportPo} exportingKey={exportingRow} />
        </motion.div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
