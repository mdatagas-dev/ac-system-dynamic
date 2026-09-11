"use client";

/**
 * Riwayat scan — /rdps/history dengan header idregist + pencarian.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { downloadFile, http } from "@/lib/api";
import { Card } from "@/components/vm3/Card";
import { SearchField } from "@/components/vm3/SearchField";
import { Select } from "@/components/vm3/Select";
import { IconButton } from "@/components/vm3/IconButton";
import { Button } from "@/components/vm3/Button";
import { Dialog } from "@/components/vm3/Dialog";
import { useSnackbar } from "@/components/vm3/Snackbar";
import { bomFields, type BomRuleField } from "@/lib/bom";

interface Regist {
  id: string;
  model: string;
  order_number: string;
  subline: string;
  product_category?: string | null;
}
interface ScanRecord extends Record<string, unknown> {
  id: string;
  timestamps: string;
}

interface ScanContext {
  bomlist?: Array<Record<string, unknown>>;
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const { show } = useSnackbar();
  const searchParams = useSearchParams();
  const idRegistParam = searchParams.get("idregist");
  const [regists, setRegists] = useState<Regist[]>([]);
  const [registId, setRegistId] = useState<string | null>(idRegistParam);
  const [rows, setRows] = useState<ScanRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletePin, setDeletePin] = useState("");
  const [fields, setFields] = useState<BomRuleField[]>([]);

  useEffect(() => {
    http
      .get<{ data: Regist[] }>("/registscan?limit=100")
      .then((res) => {
        setRegists(res.data ?? []);
        if (res.data?.length) setRegistId((prev) => prev ?? res.data![0].id);
      })
      .catch((err) => show(`Gagal muat: ${(err as Error).message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!registId) return;
    setLoading(true);
    try {
      const res = await http.get<{ data: ScanRecord[]; total: number }>(
        `/rdps/history?page=${page}&limit=20${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`,
        { extraHeaders: { idregist: registId } },
      );
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      show(`Gagal muat riwayat: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [registId, page, keyword, show]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!registId) {
      const timer = setTimeout(() => setFields([]), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    http
      .get<ScanContext>("/rdps/scan", { extraHeaders: { idregist: registId } })
      .then((res) => {
        if (!cancelled) setFields(bomFields(res.bomlist?.[0]));
      })
      .catch((err) => {
        if (!cancelled) show(`Gagal memuat struktur riwayat: ${(err as Error).message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [registId, show]);

  const remove = async () => {
    if (!deleteId) return;
    try {
      await http.del(`/rdps/delete/${deleteId}`, {
        body: { reason: deleteReason },
        extraHeaders: { idregist: registId!, "X-PIN": deletePin },
      });
      show("Scan dihapus");
      setDeleteId(null);
      setDeleteReason("");
      setDeletePin("");
      load();
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
    }
  };

  const exportHistory = async () => {
    if (!registId) return;
    setExporting(true);
    try {
      const kw = keyword.trim();
      await downloadFile(
        `/rdps/history.xlsx${kw ? `?keyword=${encodeURIComponent(kw)}` : ""}`,
        "history.xlsx",
        { idregist: registId },
      );
    } catch (err) {
      show(`Gagal mengunduh XLSX: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-bold">Riwayat Scan</h1>
        <div className="ml-auto w-full max-w-xs">
          <Select
            options={regists.map((r) => ({ value: r.id, label: `${r.model} · ${r.subline}` }))}
            value={registId}
            onChange={(value) => {
              setRegistId(value);
              setPage(1);
            }}
            placeholder="Pilih registrasi"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-sm flex-1">
          <SearchField value={keyword} onChange={setKeyword} placeholder="Cari serial atau komponen…" />
        </div>
        <Button variant="outlined" onClick={exportHistory} disabled={!registId || exporting || rows.length === 0}>
          <span className="material-symbols-rounded text-base" aria-hidden>download</span>
          {exporting ? "Mengunduh…" : "Export"}
        </Button>
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                {fields.map((field) => <th key={field.key} className="p-3">{field.label}</th>)}
                <th className="p-3">Waktu</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant last:border-0">
                  {fields.map((field) => (
                    <td key={field.key} className="p-3 font-mono font-medium">
                      {String(r[field.key] ?? "-")}
                    </td>
                  ))}
                  <td className="p-3 text-on-surface-variant">
                    {r.timestamps ? new Date(r.timestamps).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="p-1 text-right">
                    <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(r.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <div className="p-8 text-center text-on-surface-variant">Tidak ada data</div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-outline-variant p-3 text-sm">
          <span className="text-on-surface-variant">Total {total}</span>
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

      <Dialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Scan"
        description="Scan akan diarsipkan dari hasil aktif. PIN harian dan alasan akan dicatat pada audit trail."
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteId(null)}>
              Batal
            </Button>
            <Button onClick={remove} disabled={!deleteReason.trim() || !deletePin.trim()}>Hapus</Button>
          </>
        }
      >
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-on-surface">
            Alasan penghapusan
            <input value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} className="h-10 rounded-md border border-outline bg-card px-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-on-surface">
            PIN harian
            <input type="password" inputMode="numeric" value={deletePin} onChange={(event) => setDeletePin(event.target.value)} className="h-10 rounded-md border border-outline bg-card px-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
