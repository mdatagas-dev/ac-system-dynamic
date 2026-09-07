"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadFile, http } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/vm3/Button";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { SearchField } from "@/components/vm3/SearchField";
import { TextField } from "@/components/vm3/TextField";
import { useSnackbar } from "@/components/vm3/Snackbar";

type Scan = {
  id: string;
  id_regist: string;
  source: "typed" | "legacy";
  product_category: string | null;
  timestamps: string;
  model: string;
  order_number: string;
  po_number: string | null;
  subline: string;
  sn: string | null;
  sn_carton: string | null;
  pcb_idu: string | null;
  pcb_odu: string | null;
  sn_motor: string | null;
  sn_accessories: string | null;
  sn_drum: string | null;
  sn_pump: string | null;
};

const AC_COLUMNS: Array<[keyof Scan, string]> = [
  ["sn", "SN Unit"],
  ["pcb_idu", "PCB IDU"],
  ["pcb_odu", "PCB ODU"],
  ["sn_motor", "SN Motor"],
  ["sn_accessories", "SN Accessories"],
  ["sn_carton", "SN Carton"],
];
const WM_COLUMNS: Array<[keyof Scan, string]> = [["sn", "SN Unit"], ["sn_drum", "SN Drum"], ["sn_pump", "SN Pump"]];

function displayCategory(category: string | null) {
  return category === "wm" || category === "washing" ? "WM" : "AC";
}

export default function DataExportPage() {
  const { show } = useSnackbar();
  const { user } = useAuth();
  const [rows, setRows] = useState<Scan[]>([]);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Scan | null>(null);
  const [editing, setEditing] = useState<Scan | null>(null);
  const [pinTarget, setPinTarget] = useState<Scan | null>(null);
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "20" });
      if (keyword.trim()) query.set("keyword", keyword.trim());
      const result = await http.get<{ data: Scan[]; total: number }>(`/rdps/data-export?${query}`);
      setRows(result.data ?? []);
      setTotal(result.total ?? 0);
    } catch (error) {
      show(`Gagal memuat Data Export: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [keyword, page, show]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const beginEdit = (scan: Scan) => {
    if (scan.source === "legacy") {
      show("Data legacy hanya dapat dilihat; edit tersedia untuk scan typed baru.");
      return;
    }
    if (user?.roleuser.toLowerCase() === "ppc") {
      setPin("");
      setPinTarget(scan);
      return;
    }
    setEditing(scan);
  };

  const verifyPin = async () => {
    if (!pinTarget || !pin.trim()) return;
    setPinLoading(true);
    try {
      await http.post("/pin/compare", { pin });
      setPinTarget(null);
      setEditing(pinTarget);
    } catch (error) {
      show(`PIN tidak dapat diverifikasi: ${(error as Error).message}`);
    } finally {
      setPinLoading(false);
    }
  };

  const editFields = useMemo(() => {
    if (!editing) return [];
    return (displayCategory(editing.product_category) === "WM" ? WM_COLUMNS : AC_COLUMNS).map(([key, label]) => ({ key, label }));
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    setEditValues(Object.fromEntries(editFields.map(({ key }) => [key, String(editing[key] ?? "")])));
  }, [editing, editFields]);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await http.put(`/rdps/edit/${editing.id}`, { id_regist: editing.id_regist, ...editValues }, {
        extraHeaders: {
          idregist: editing.id_regist,
          ...(user?.roleuser.toLowerCase() === "ppc" ? { "X-PIN": pin } : {}),
        },
      });
      show("Scan diperbarui");
      setEditing(null);
      load();
    } catch (error) {
      show(`Gagal memperbarui scan: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const downloadXlsx = async () => {
    setExporting(true);
    try {
      const query = new URLSearchParams();
      if (keyword.trim()) query.set("keyword", keyword.trim());
      await downloadFile(`/rdps/data-export.xlsx?${query}`, "data-produksi.xlsx");
    } catch (error) {
      show(`Gagal mengunduh XLSX: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const columnsFor = (scan: Scan) => displayCategory(scan.product_category) === "WM" ? WM_COLUMNS : AC_COLUMNS;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Data Export</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Riwayat seluruh scan produksi.</p>
        </div>
        <div className="flex w-full max-w-xl flex-wrap gap-2 sm:flex-nowrap">
          <SearchField value={keyword} onChange={(value) => { setKeyword(value); setPage(1); }} placeholder="Cari model, batch, PO, atau line…" />
          <Button icon="download" loading={exporting} onClick={downloadXlsx}>Unduh XLSX</Button>
        </div>
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead><tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
              <th className="p-3">Waktu</th><th className="p-3">Kategori</th><th className="p-3">Model</th><th className="p-3">Batch</th><th className="p-3">PO</th><th className="p-3">Line</th><th className="p-3">Action</th>
            </tr></thead>
            <tbody>{rows.map((scan) => (
              <tr key={`${scan.source}-${scan.id}`} className="border-b border-outline-variant last:border-0 align-top">
                <td className="whitespace-nowrap p-3 text-on-surface-variant">{new Date(scan.timestamps).toLocaleString("id-ID")}</td>
                <td className="p-3">{displayCategory(scan.product_category)}</td>
                <td className="p-3 font-medium">{scan.model}</td>
                <td className="p-3">{scan.order_number}</td>
                <td className="p-3">{scan.po_number ?? "-"}</td>
                <td className="p-3">{scan.subline}</td>
                <td className="p-2 whitespace-nowrap"><Button className="h-9 px-3" variant="outlined" onClick={() => setDetail(scan)}>Detail</Button>{scan.source === "typed" && <Button className="ml-2 h-9 px-3" onClick={() => beginEdit(scan)}>Edit</Button>}</td>
              </tr>
            ))}</tbody>
          </table>
          {!loading && rows.length === 0 && <div className="p-8 text-center text-on-surface-variant">Tidak ada data scan.</div>}
          {loading && <div className="p-8 text-center text-on-surface-variant">Memuat…</div>}
        </div>
        <div className="flex items-center justify-between border-t border-outline-variant p-3 text-sm"><span className="text-on-surface-variant">Total {total}</span><div className="flex items-center gap-2"><Button className="h-9 px-3" variant="text" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><span>{page}/{totalPages}</span><Button className="h-9 px-3" variant="text" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></div></div>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} title="Detail Scan">
        {detail && <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{[["Waktu", new Date(detail.timestamps).toLocaleString("id-ID")], ["Kategori", displayCategory(detail.product_category)], ["Model", detail.model], ["Batch", detail.order_number], ["PO", detail.po_number], ["Line", detail.subline], ...columnsFor(detail).map(([key, label]) => [label, String(detail[key] ?? "-")])].map(([label, value]) => <div key={String(label)}><dt className="text-on-surface-variant">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>}
      </Dialog>

      <Dialog open={pinTarget !== null} onOpenChange={(open) => !open && setPinTarget(null)} title="Verifikasi PIN" description="PPC wajib memasukkan PIN harian sebelum mengubah data scan." actions={<><Button variant="text" onClick={() => setPinTarget(null)}>Batal</Button><Button loading={pinLoading} onClick={verifyPin}>Verifikasi</Button></>}>
        <div className="mt-4"><TextField label="PIN Harian" type="password" value={pin} onChange={(event) => setPin(event.target.value)} /></div>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title="Edit Scan" actions={<><Button variant="text" onClick={() => setEditing(null)}>Batal</Button><Button loading={saving} onClick={saveEdit}>Simpan</Button></>}>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{editFields.map(({ key, label }) => <TextField key={String(key)} label={label} value={editValues[String(key)] ?? ""} onChange={(event) => setEditValues((values) => ({ ...values, [key]: event.target.value }))} />)}</div>
      </Dialog>
    </div>
  );
}
