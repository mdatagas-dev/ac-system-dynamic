"use client";

/**
 * Registrasi batch — daftar + buat registscan.
 * Replikasi legacy: kolom Action dengan drill untuk masuk window scan.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { TextField } from "@/components/vm3/TextField";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { SearchField } from "@/components/vm3/SearchField";
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
  index?: number;
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

/** Field wajib — dinamis per subline (sn_carton selalu opsional) */
function getRequired(subline: string) {
  const u = subline.toUpperCase();
  const isOdu = u.includes("ODU");
  const isIdu = u.includes("IDU");
  const base = ["model", "order_number", "po_number", "subline"] as const;
  if (isOdu && !isIdu) return [...base, "sn_odu", "sn_motor", "sn_box"] as const;
  if (isIdu && !isOdu) return [...base, "sn", "pcb_idu", "sn_accessories"] as const;
  if (subline.trim() === "" || subline.trim().toUpperCase() === "ODU" || subline.trim().toUpperCase() === "IDU") {
    // fallback untuk input singkat "ODU"/"IDU" — treat sama
    if (isOdu) return [...base, "sn_odu", "sn_motor", "sn_box"] as const;
    if (isIdu) return [...base, "sn", "pcb_idu", "sn_accessories"] as const;
  }
  // kalau subline generic / tidak jelas (mis. kosong), wajib semua biar tidak lolos setengah
  return [...base, "sn", "sn_odu", "pcb_idu", "sn_accessories", "sn_motor", "sn_box"] as const;
}

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
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const requiredKeys = getRequired(form.subline);
  const requiredSet = new Set<string>(requiredKeys as unknown as string[]);
  const isFormValid = requiredKeys.every((k) => String((form as Record<string, unknown>)[k] ?? "").trim() !== "");

  const load = useCallback(async (kw = keyword, pg = page) => {
    try {
      setLoading(true);
      const q = new URLSearchParams({ limit: "10", page: String(pg) });
      if (kw.trim()) q.set("keyword", kw.trim());
      const res = await http.get<{ data: Regist[]; totalPages?: number; total?: number }>(`/registscan?${q.toString()}`);
      setRows(res.data ?? []);
      if (res.totalPages) setTotalPages(res.totalPages);
      else if (res.total != null) setTotalPages(Math.max(1, Math.ceil(res.total / 10)));
    } catch (err) {
      show(`Gagal memuat: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [keyword, page, show]);

  useEffect(() => {
    const t = setTimeout(() => load(keyword, page), 0);
    return () => clearTimeout(t);
  }, [load, keyword, page]);

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

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
      const newId = res.result?.id ?? (res as unknown as { data?: { id: string } })?.data?.id;
      if (newId) {
        router.push(`/scan?idregist=${newId}`);
      } else {
        load(keyword, 1);
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
      load(keyword, page);
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar: Search + Create — replikasi Image 2 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-64">
            <SearchField value={searchInput} onChange={setSearchInput} placeholder="searching..." />
          </div>
          <Button variant="filled" onClick={handleSearch} className="!bg-[#0d7ea7] !text-white">
            Search
          </Button>
        </div>
        <div className="ml-auto">
          <Button icon="add" onClick={() => setDialogOpen(true)} className="!bg-[#0d7ea7] !text-white">
            Create
          </Button>
        </div>
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                <th className="p-3 font-medium">No</th>
                <th className="p-3 font-medium">Timestamps</th>
                <th className="p-3 font-medium">Model</th>
                <th className="p-3 font-medium">Order Number</th>
                <th className="p-3 font-medium">PO Number</th>
                <th className="p-3 font-medium">Line</th>
                <th className="p-3 font-medium text-center">Plan</th>
                <th className="p-3 font-medium text-center">Scan</th>
                <th className="p-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container">
                  <td className="p-3 text-center">{r.index ?? (page - 1) * 10 + i + 1}</td>
                  <td className="p-3 whitespace-nowrap text-xs">
                    {r.timestamps ? new Date(r.timestamps).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="p-3 font-medium whitespace-nowrap">{r.model}</td>
                  <td className="p-3 text-center">{r.order_number}</td>
                  <td className="p-3 text-center">{r.po_number}</td>
                  <td className="p-3 whitespace-nowrap text-xs">{r.subline}</td>
                  <td className="p-3 text-center">{r.plan}</td>
                  <td className="p-3 text-center font-medium">{r.total ?? 0}</td>
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => show("Detail: " + r.model)}
                        className="rounded-md bg-[#0d7ea7] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b6a97] transition-colors"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => show("Edit belum tersedia")}
                        className="rounded-md bg-[#facc15] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#eab308] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label="Scan"
                        onClick={() => router.push(`/scan?idregist=${r.id}`)}
                        className="flex h-7 w-8 items-center justify-center rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
                      >
                        <span className="material-symbols-rounded text-[18px] text-gray-700" aria-hidden>precision_manufacturing</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Riwayat"
                        onClick={() => router.push(`/history?idregist=${r.id}`)}
                        className="flex h-7 w-8 items-center justify-center rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
                      >
                        <span className="material-symbols-rounded text-[18px] text-gray-700" aria-hidden>history</span>
                      </button>
                      <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(r.id)} className="!h-7 !w-7" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <div className="p-8 text-center text-on-surface-variant">Belum ada registrasi</div>
          )}
        </div>
        {/* Pagination — replikasi Image 2 */}
        <div className="flex items-center justify-between border-t border-outline-variant p-3">
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded px-2 py-1 text-sm disabled:opacity-40 hover:bg-surface-container">«</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
              const p = idx + 1;
              return (
                <button key={p} type="button" onClick={() => setPage(p)} className={`min-w-7 rounded px-2 py-1 text-sm ${page === p ? "bg-gray-200 font-semibold" : "hover:bg-surface-container"}`}>{p}</button>
              );
            })}
            {totalPages > 5 && <span className="px-2 text-sm text-on-surface-variant">...</span>}
            {totalPages > 5 && (
              <button type="button" onClick={() => setPage(totalPages)} className={`min-w-7 rounded px-2 py-1 text-sm ${page === totalPages ? "bg-gray-200 font-semibold" : "hover:bg-surface-container"}`}>{totalPages}</button>
            )}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded px-2 py-1 text-sm disabled:opacity-40 hover:bg-surface-container">»</button>
          </div>
          <span className="text-xs text-on-surface-variant">Page {page} / {totalPages}</span>
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
            <Button onClick={submit} disabled={!isFormValid}>Simpan</Button>
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

          {/* Pilihan cepat ODU/IDU — jangan tampilkan semua field di awal */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container p-3">
            <span className="text-sm font-medium">Pilih Subline:</span>
            <button type="button" onClick={() => setForm({ ...form, subline: "LINE ODU ASSY INPUT" })} className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${form.subline.toUpperCase().includes("ODU") ? "bg-[#0f1445] text-white border-[#0f1445]" : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100"}`}>ODU</button>
            <button type="button" onClick={() => setForm({ ...form, subline: "LINE IDU ASSY INPUT" })} className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${form.subline.toUpperCase().includes("IDU") ? "bg-[#0f1445] text-white border-[#0f1445]" : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100"}`}>IDU</button>
            <span className="text-xs text-on-surface-variant ml-1">atau ketik manual di field Subline</span>
          </div>

          {!form.subline.trim() ? (
            <div className="rounded-lg border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
              Pilih <b>ODU</b> atau <b>IDU</b> di atas untuk menampilkan field SN yang relevan
            </div>
          ) : form.subline.toUpperCase().includes("ODU") && !form.subline.toUpperCase().includes("IDU") ? (
            <section aria-label="ODU">
              <div className="mb-2 text-sm font-medium text-on-surface-variant">ODU — wajib isi 3 field</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Serial Number" value={form.sn_odu} onChange={(e) => setForm({ ...form, sn_odu: e.target.value })} required />
                <TextField label="SN Motor" value={form.sn_motor} onChange={(e) => setForm({ ...form, sn_motor: e.target.value })} required />
                <TextField label="SN Electrical Box" value={form.sn_box} onChange={(e) => setForm({ ...form, sn_box: e.target.value })} required />
                <TextField label="SN Carton" value={form.sn_carton} onChange={(e) => setForm({ ...form, sn_carton: e.target.value })} />
              </div>
            </section>
          ) : form.subline.toUpperCase().includes("IDU") && !form.subline.toUpperCase().includes("ODU") ? (
            <section aria-label="IDU">
              <div className="mb-2 text-sm font-medium text-on-surface-variant">IDU — wajib isi 3 field</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Serial Number Unit" value={form.sn} onChange={(e) => setForm({ ...form, sn: e.target.value })} required />
                <TextField label="SN PCB" value={form.pcb_idu} onChange={(e) => setForm({ ...form, pcb_idu: e.target.value })} required />
                <TextField label="SN Accessories" value={form.sn_accessories} onChange={(e) => setForm({ ...form, sn_accessories: e.target.value })} required />
              </div>
            </section>
          ) : (
            <>
              <section aria-label="IDU">
                <div className="mb-2 text-sm font-medium text-on-surface-variant">IDU {requiredSet.has("sn") ? "" : "(opsional untuk ODU)"}</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Serial Number Unit" value={form.sn} onChange={(e) => setForm({ ...form, sn: e.target.value })} required={requiredSet.has("sn")} />
                  <TextField label="SN PCB" value={form.pcb_idu} onChange={(e) => setForm({ ...form, pcb_idu: e.target.value })} required={requiredSet.has("pcb_idu")} />
                  <TextField label="SN Accessories" value={form.sn_accessories} onChange={(e) => setForm({ ...form, sn_accessories: e.target.value })} required={requiredSet.has("sn_accessories")} />
                </div>
              </section>
              <section aria-label="ODU">
                <div className="mb-2 text-sm font-medium text-on-surface-variant">ODU {requiredSet.has("sn_odu") ? "" : "(opsional untuk IDU)"}</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Serial Number" value={form.sn_odu} onChange={(e) => setForm({ ...form, sn_odu: e.target.value })} required={requiredSet.has("sn_odu")} />
                  <TextField label="SN Motor" value={form.sn_motor} onChange={(e) => setForm({ ...form, sn_motor: e.target.value })} required={requiredSet.has("sn_motor")} />
                  <TextField label="SN Electrical Box" value={form.sn_box} onChange={(e) => setForm({ ...form, sn_box: e.target.value })} required={requiredSet.has("sn_box")} />
                  <TextField label="SN Carton" value={form.sn_carton} onChange={(e) => setForm({ ...form, sn_carton: e.target.value })} />
                </div>
              </section>
            </>
          )}
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
