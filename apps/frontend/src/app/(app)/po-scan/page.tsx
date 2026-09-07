"use client";
/**
 * Data Scan per PO — paritas dengan halaman datascan lama:
 * tabel scan dikelompokkan per batch (order_number) × line (subline),
 * pencarian keyword, paginasi, dan Export per baris via
 * /rdps/export-odf-po-all.xlsx (semua baris scan untuk kombinasi tersebut).
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { downloadFile, http } from "@/lib/api";
import { Card } from "@/components/vm3/Card";
import { SearchField } from "@/components/vm3/SearchField";
import { Button } from "@/components/vm3/Button";
import { useSnackbar } from "@/components/vm3/Snackbar";

interface PoScanRow {
  model: string;
  order_number: string;
  po_number: string | null;
  subline: string | null;
  countsubline: number;
  index?: number;
}

const LIMIT = 10;

export default function PoScanPage() {
  return (
    <Suspense fallback={null}>
      <PoScanContent />
    </Suspense>
  );
}

function PoScanContent() {
  const { show } = useSnackbar();
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const [applied, setApplied] = useState(keyword);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PoScanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (applied.trim()) q.set("keyword", applied.trim());
      const res = await http.get<{ data: PoScanRow[]; total: number; totalPages: number }>(`/rdps/total-po-scan?${q}`);
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
    } catch (err) {
      show(`Gagal memuat data scan: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [applied, page, show]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const applySearch = (value: string) => {
    setPage(1);
    setApplied(value);
  };

  // Export per baris: filter model + batch + PO + line, sama seperti datascan lama.
  const exportRow = async (row: PoScanRow) => {
    const key = `${row.model}|${row.order_number}|${row.po_number}|${row.subline}`;
    setExporting(key);
    try {
      const q = new URLSearchParams({ model: row.model, order_number: row.order_number });
      if (row.po_number) q.set("po_number", row.po_number);
      if (row.subline) q.set("subline", row.subline);
      await downloadFile(`/rdps/export-odf-po-all.xlsx?${q}`, `allHistory-${row.order_number}.xlsx`);
    } catch (err) {
      show(`Gagal export: ${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Data Scan</h1>
        <div className="w-full max-w-xs">
          <SearchField value={keyword} onChange={setKeyword} onClear={() => applySearch("")} onKeyDown={(e) => e.key === "Enter" && applySearch(keyword)} placeholder="Cari SN, model, batch, PO, line…" />
        </div>
      </div>
      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                <th className="p-3">No</th>
                <th className="p-3">Model</th>
                <th className="p-3">Order Number</th>
                <th className="p-3">PO Number</th>
                <th className="p-3">Line</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Act</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = `${row.model}|${row.order_number}|${row.po_number}|${row.subline}`;
                return (
                  <tr key={key} className="border-b border-outline-variant/40 last:border-0">
                    <td className="p-3 tabular-nums text-on-surface-variant">{row.index ?? ""}</td>
                    <td className="p-3 font-medium">{row.model}</td>
                    <td className="p-3">{row.order_number}</td>
                    <td className="p-3 font-mono text-xs">{row.po_number || "Kosong"}</td>
                    <td className="p-3">{row.subline || "Kosong"}</td>
                    <td className="p-3 text-right font-medium tabular-nums">{row.countsubline}</td>
                    <td className="p-3 text-right">
                      <Button variant="outlined" onClick={() => exportRow(row)} disabled={exporting === key}>
                        {exporting === key ? "Mengunduh…" : "Export"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant">Tidak ada data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-outline-variant p-3 text-sm">
          <span className="text-on-surface-variant">Total {total} kombinasi batch × line</span>
          <div className="flex gap-2">
            <button type="button" className="rounded px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Sebelumnya
            </button>
            <span className="px-2 py-1">
              {page}/{totalPages}
            </span>
            <button type="button" className="rounded px-3 py-1 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Berikutnya
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
