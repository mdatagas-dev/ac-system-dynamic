"use client";

/**
 * Riwayat scan — /rdps/history dengan header idregist + pencarian.
 */
import { useCallback, useEffect, useState } from "react";
import { http } from "@/lib/api";
import { Card } from "@/components/vm3/Card";
import { SearchField } from "@/components/vm3/SearchField";
import { Select } from "@/components/vm3/Select";
import { IconButton } from "@/components/vm3/IconButton";
import { Button } from "@/components/vm3/Button";
import { Dialog } from "@/components/vm3/Dialog";
import { useSnackbar } from "@/components/vm3/Snackbar";

interface Regist {
  id: string;
  model: string;
  order_number: string;
  subline: string;
}
interface Record {
  id: string;
  sn: string;
  sn_motor: string | null;
  sn_box: string | null;
  pcb_idu: string | null;
  sn_carton: string | null;
  sn_accessories: string | null;
  timestamps: string;
}

export default function HistoryPage() {
  const { show } = useSnackbar();
  const [regists, setRegists] = useState<Regist[]>([]);
  const [registId, setRegistId] = useState<string | null>(null);
  const [rows, setRows] = useState<Record[]>([]);
  const [keyword, setKeyword] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    http
      .get<{ data: Regist[] }>("/registscan?limit=100")
      .then((res) => {
        setRegists(res.data ?? []);
        if (res.data?.length) setRegistId(res.data[0].id);
      })
      .catch((err) => show(`Gagal muat: ${(err as Error).message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!registId) return;
    setLoading(true);
    try {
      const res = await http.get<{ data: Record[]; total: number }>(
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

  const remove = async () => {
    if (!deleteId) return;
    try {
      await http.del(`/rdps/delete/${deleteId}`, { extraHeaders: { idregist: registId! } });
      show("Scan dihapus");
      setDeleteId(null);
      load();
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
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
            onChange={setRegistId}
            placeholder="Pilih registrasi"
          />
        </div>
      </div>

      <div className="max-w-sm">
        <SearchField value={keyword} onChange={setKeyword} placeholder="Cari SN, box, motor…" />
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                <th className="p-3">SN</th>
                <th className="p-3">Motor</th>
                <th className="p-3">Box</th>
                <th className="p-3">PCB</th>
                <th className="p-3">Waktu</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant last:border-0">
                  <td className="p-3 font-mono font-medium">{r.sn}</td>
                  <td className="p-3">{r.sn_motor ?? "-"}</td>
                  <td className="p-3">{r.sn_box ?? "-"}</td>
                  <td className="p-3">{r.pcb_idu ?? "-"}</td>
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
        description="Data scan akan dihapus permanen. Lanjutkan?"
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteId(null)}>
              Batal
            </Button>
            <Button onClick={remove}>Hapus</Button>
          </>
        }
      />
    </div>
  );
}
