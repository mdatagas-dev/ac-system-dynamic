"use client";

/**
 * Registrasi batch — daftar + buat registscan.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { TextField } from "@/components/vm3/TextField";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { IconButton } from "@/components/vm3/IconButton";
import { useSnackbar } from "@/components/vm3/Snackbar";
import { useAuth } from "@/lib/auth";

interface Regist {
  id: string;
  model: string;
  order_number: string;
  po_number: string;
  subline: string;
  plan: number | null;
  total?: number;
  timestamps: string;
}

const EMPTY = {
  model: "",
  order_number: "",
  po_number: "",
  subline: "",
  shift: "1",
  plan: "10",
  sn: "",
  sn_odu: "",
  sn_motor: "",
  sn_box: "",
  pcb_idu: "",
  sn_carton: "",
  sn_accessories: "",
};

/** Field wajib — backend 400 reject bila kosong (sn_carton opsional) */
const REQUIRED = [
  "model", "order_number", "po_number", "subline",
  "sn", "sn_odu", "pcb_idu", "sn_accessories", "sn_motor", "sn_box",
] as const;

interface PostResult {
  result?: { id: string };
}

export default function RegistPage() {
  const { show } = useSnackbar();
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Regist[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await http.get<{ data: Regist[] }>("/registscan?limit=50");
      setRows(res.data ?? []);
    } catch (err) {
      show(`Gagal memuat: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const submit = async () => {
    try {
      const res = await http.post<PostResult>("/registscan/post", {
        ...form,
        plan: Number(form.plan),
        userid: user?.username ?? "",
      });
      show("Registrasi berhasil ditambahkan");
      setDialogOpen(false);
      setForm(EMPTY);
      if (res.result?.id) {
        router.replace(`/scan?idregist=${res.result.id}`);
      } else {
        load();
      }
    } catch (err) {
      show(`Gagal: ${(err as Error).message}`);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await http.del(`/registscan/delete/${deleteId}`);
      show("Data dihapus");
      setDeleteId(null);
      load();
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registrasi Batch</h1>
        <Button icon="add" onClick={() => setDialogOpen(true)}>
          Registrasi Baru
        </Button>
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                <th className="p-3">Model</th>
                <th className="p-3">Order</th>
                <th className="p-3">PO</th>
                <th className="p-3">Subline</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Scan</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant last:border-0">
                  <td className="p-3 font-medium">{r.model}</td>
                  <td className="p-3">{r.order_number}</td>
                  <td className="p-3">{r.po_number}</td>
                  <td className="p-3">{r.subline}</td>
                  <td className="p-3">{r.plan}</td>
                  <td className="p-3">{r.total ?? 0}</td>
                  <td className="p-1 text-right">
                    <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(r.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <div className="p-8 text-center text-on-surface-variant">Belum ada registrasi</div>
          )}
        </div>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Registrasi Baru"
        description="Model akan dicocokkan dengan BOM list (5 karakter terakhir dipisah)."
        actions={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={!REQUIRED.every((k) => String(form[k]).trim())}>Simpan</Button>
          </>
        }
      >
        <div className="mt-4 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            <TextField label="Order Number" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} required />
            <TextField label="PO Number" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} required />
            <TextField label="Subline" value={form.subline} onChange={(e) => setForm({ ...form, subline: e.target.value })} required />
            <TextField label="Shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} />
            <TextField label="Plan" type="number" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
          </div>

          <section aria-label="IDU">
            <div className="mb-2 text-sm font-medium text-on-surface-variant">IDU</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Serial Number Unit" value={form.sn} onChange={(e) => setForm({ ...form, sn: e.target.value })} required />
              <TextField label="SN PCB" value={form.pcb_idu} onChange={(e) => setForm({ ...form, pcb_idu: e.target.value })} required />
              <TextField label="SN Accessories" value={form.sn_accessories} onChange={(e) => setForm({ ...form, sn_accessories: e.target.value })} required />
            </div>
          </section>

          <section aria-label="ODU">
            <div className="mb-2 text-sm font-medium text-on-surface-variant">ODU</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Serial Number" value={form.sn_odu} onChange={(e) => setForm({ ...form, sn_odu: e.target.value })} required />
              <TextField label="SN Motor" value={form.sn_motor} onChange={(e) => setForm({ ...form, sn_motor: e.target.value })} required />
              <TextField label="SN Electrical Box" value={form.sn_box} onChange={(e) => setForm({ ...form, sn_box: e.target.value })} required />
              <TextField label="SN Carton" value={form.sn_carton} onChange={(e) => setForm({ ...form, sn_carton: e.target.value })} />
            </div>
          </section>
        </div>
      </Dialog>

      <Dialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Registrasi"
        description="Data registrasi beserta scan terkait? Tindakan ini tidak dapat dibatalkan."
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button onClick={remove}>Hapus</Button>
          </>
        }
      />
    </div>
  );
}
