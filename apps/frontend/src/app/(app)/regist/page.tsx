"use client";

/**
 * Registrasi batch — daftar + buat registscan.
 * Universal: field SN ditentukan oleh BOM rule (model + order_number).
 * Admin mendaftarkan BOM rule; operator registrasi batch mengikuti field-nya.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { TextField } from "@/components/vm3/TextField";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { SearchField } from "@/components/vm3/SearchField";
import { IconButton } from "@/components/vm3/IconButton";
import { Combobox } from "@/components/vm3/Combobox";
import { useSnackbar } from "@/components/vm3/Snackbar";
import { useAuth } from "@/lib/auth";
import { bomFields, bomFieldsForUnit, unitFromSubline, type BomRule } from "@/lib/bom";

interface Regist {
  id: string;
  model: string;
  order_number: string;
  po_number: string;
  subline: string;
  plan: number | null;
  shift?: string | null;
  sn?: string | null;
  sn_odu?: string | null;
  sn_motor?: string | null;
  sn_box?: string | null;
  pcb_idu?: string | null;
  sn_carton?: string | null;
  sn_accessories?: string | null;
  sn_drum?: string | null;
  sn_pump?: string | null;
  total?: number;
  timestamps: string;
  index?: number;
}

const EMPTY: Record<string, string> = {
  model: "",
  order_number: "",
  po_number: "",
  shift: "1",
  plan: "10",
  sn: "",
  sn_odu: "",
  sn_motor: "",
  sn_box: "",
  pcb_idu: "",
  sn_carton: "",
  sn_accessories: "",
  sn_drum: "",
  sn_pump: "",
};

interface PostResult {
  result?: { id: string };
}

// True bila rule cocok dengan unit operator: template tanpa field ber-unit
// berlaku untuk kedua unit (IDU+ODU); bila ada unit, rule milik unit itu.
function bomlistForUnit(rule: BomRule | undefined, unit: string | null): boolean {
  if (!rule) return false;
  const fields = Array.isArray(rule.fields) ? rule.fields : [];
  const units = new Set(fields.map((f) => f.unit).filter(Boolean));
  if (units.size === 0) return true;
  return unit != null && units.has(unit);
}

export default function RegistPage() {
  const { show } = useSnackbar();
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Regist[]>([]);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  // batch yang sedang diedit (null = mode create)
  const [editing, setEditing] = useState<Regist | null>(null);
  // batch yang sedang dilihat detailnya (dialog read-only)
  const [detail, setDetail] = useState<Regist | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Batch belum tuntas (plan > scan) — "Harap lengkapi record berikut!"
  const [pending, setPending] = useState<{ id: string; model: string; order_number: string; plan: number; total: number }[]>([]);
  const loadPending = async () => {
    try {
      const res = await http.get<{ data: { id: string; model: string; order_number: string; plan: number; total: number }[] }>(
        "/registscan/checkregist",
        { extraHeaders: { iduser: user?.id ?? "" } },
      );
      setPending(res.data ?? []);
    } catch {
      setPending([]);
    }
  };

  useEffect(() => {
    http
      .get<{ data: { id: string; model: string; order_number: string; plan: number; total: number }[] }>(
        "/registscan/checkregist",
        { extraHeaders: { iduser: user?.id ?? "" } },
      )
      .then((res) => setPending(res.data ?? []))
      .catch(() => setPending([]));
  }, [user?.id]);

  // BOM rule (sumber field SN) — dicari dari order_number yang unik per rule
  const [bomRule, setBomRule] = useState<BomRule | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Model master — saran datalist untuk input Model
  const [models, setModels] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    http
      .get<{ data: BomRule[] }>("/model?limit=100")
      .then((res) => {
        if (cancelled) return;
        setModels(((res.data ?? []) as unknown[]).map((m) => String((m as { model?: unknown }).model ?? "")).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const modelKnown = useMemo(
    () => !form.model.trim() || models.includes(form.model.trim()),
    [form.model, models],
  );

  // Ambil BOM rule ketika model + order_number terisi
  useEffect(() => {
    const model = String(form.model ?? "").trim();
    const order = String(form.order_number ?? "").trim();
    let cancelled = false;
    const t = setTimeout(() => {
      if (!model || !order) {
        setBomRule(null);
        setRuleError(null);
        setRuleLoading(false);
        return;
      }
      setRuleLoading(true);
      setRuleError(null);
      http
        .get<{ data: BomRule[] }>(`/bomlist?keyword=${encodeURIComponent(order)}`)
        .then((res) => {
          if (cancelled) return;
          // BOM rule bisa lebih dari satu per model+order (baris ODU & IDU terpisah).
          // Operator di line tertentu hanya boleh memakai rule yang unitnya cocok.
          const candidates = (res.data ?? []).filter(
            (b) => b.order_number === order && model.startsWith(b.model),
          );
          const opUnit = unitFromSubline(user?.section ?? null);
          const hit =
            candidates.find((b) => bomlistForUnit(b, opUnit)) ?? candidates[0];
          if (hit) {
            setBomRule(hit);
          } else {
            setBomRule(null);
            setRuleError("BOM rule tidak ditemukan untuk model + order ini");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBomRule(null);
            setRuleError("Gagal memuat BOM rule");
          }
        })
        .finally(() => {
          if (!cancelled) setRuleLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.model, form.order_number, user?.section]);

  // field form = template BOM difilter per unit line operator (IDU/ODU)
  const fields = useMemo(
    () => bomFieldsForUnit(bomFields(bomRule), unitFromSubline(user?.section ?? null)),
    [bomRule, user?.section],
  );
  const requiredKeys = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.key),
    [fields],
  );
  const isFormValid =
    ["model", "order_number", "po_number"].every(
      (k) => String((form as Record<string, unknown>)[k] ?? "").trim() !== "",
    ) &&
    // BOM rule wajib ada — tanpa rule, backend menolak ("Batch tidak ada di bomlist")
    bomRule !== null &&
    requiredKeys.every((k) => String((form as Record<string, unknown>)[k] ?? "").trim() !== "");

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

  // Edit memakai dialog create: prefill form, BOM probe jalan otomatis dari model+order
  const openEdit = (r: Regist) => {
    setEditing(r);
    setForm({
      model: r.model ?? "",
      order_number: r.order_number ?? "",
      po_number: r.po_number ?? "",
      shift: r.shift ?? "1",
      plan: String(r.plan ?? ""),
      sn: r.sn ?? "",
      sn_odu: r.sn_odu ?? "",
      sn_motor: r.sn_motor ?? "",
      sn_box: r.sn_box ?? "",
      pcb_idu: r.pcb_idu ?? "",
      sn_carton: r.sn_carton ?? "",
      sn_accessories: r.sn_accessories ?? "",
      sn_drum: r.sn_drum ?? "",
      sn_pump: r.sn_pump ?? "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    try {
      if (editing) {
        await http.put(`/registscan/edit/${editing.id}`, {
          ...form,
          plan: Number(form.plan),
        });
        show("Registrasi diperbarui");
        setDialogOpen(false);
        setEditing(null);
        setForm(EMPTY);
        load(keyword, page);
        void loadPending();
        return;
      }
      const res = await http.post<PostResult>("/registscan/post", {
        ...form,
        plan: Number(form.plan),
        userid: user?.id ?? "",
      });
      show("Registrasi berhasil ditambahkan");
      setDialogOpen(false);
      setForm(EMPTY);
      void loadPending();
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

      {/* Batch belum tuntas — operator diminta melengkapinya dulu */}
      {pending.length > 0 && (
        <Card variant="outlined" className="border-amber-400 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="material-symbols-rounded text-amber-600" aria-hidden>warning</span>
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-amber-900">{pending.length} batch belum tuntas — lanjutkan scan. Batch yang selesai harus dibuatkan registrasi baru.</div>
              <div className="truncate text-amber-800">
                {pending.map((p) => `${p.order_number} (${p.total}/${p.plan})`).join(" • ")}
              </div>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {pending.map((p) => (
                <Button
                  key={p.id}
                  variant="filled"
                  className="!bg-[#0d7ea7] !text-white"
                  onClick={() => router.push(`/scan?idregist=${p.id}`)}
                >
                  Scan {p.order_number}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                <th className="p-3 text-center font-medium">No</th>
                <th className="p-3 font-medium">Timestamps</th>
                <th className="p-3 font-medium">Model</th>
                <th className="p-3 text-center font-medium">Order Number</th>
                <th className="p-3 text-center font-medium">PO Number</th>
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
                        onClick={() => setDetail(r)}
                        className="rounded-md bg-[#0d7ea7] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b6a97] transition-colors"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-md bg-[#facc15] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#eab308] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label="Scan"
                        onClick={() => router.push(`/scan?idregist=${r.id}`)}
                        className="flex h-9 w-12 items-center justify-center rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
                      >
                        <span className="material-symbols-rounded text-[24px] text-gray-700" aria-hidden>barcode_scanner</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Riwayat"
                        onClick={() => router.push(`/history?idregist=${r.id}`)}
                        className="flex h-9 w-12 items-center justify-center rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
                      >
                        <span className="material-symbols-rounded text-[24px] text-gray-700" aria-hidden>history</span>
                      </button>
                      <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(r.id)} className="!h-9 !w-9" />
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
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Edit Registrasi" : "Registrasi Baru"}
        description="Field SN mengikuti BOM rule untuk model + order number."
        actions={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={!isFormValid}>{editing ? "Simpan Perubahan" : "Simpan"}</Button>
          </>
        }
      >
        <div className="mt-4 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Model — combobox: ketik untuk mencari, saran dari Model Master */}
            <div>
              <Combobox
                label="Model *"
                options={models}
                value={form.model}
                onChange={(v) => setForm({ ...form, model: v })}
                placeholder="Ketik untuk mencari model"
              />
              {!modelKnown && form.model.trim() && (
                <p className="mt-1 text-xs text-amber-700">Model tidak ada di Model Master</p>
              )}
            </div>
            <TextField label="Order Number" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} required />
            <TextField label="PO Number" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} required />
            <TextField label="Shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} />
            <TextField label="Plan" type="number" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
          </div>

          {/* Subline otomatis dari section user */}
          <div className="rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
            Subline otomatis dari section Anda:{" "}
            <span className="font-semibold">{user?.section || "—"}</span>
          </div>

          {/* Status BOM rule — sumber field SN */}
          {ruleLoading ? (
            <div className="rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">
              Memuat BOM rule...
            </div>
          ) : ruleError ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {ruleError} — minta admin membuat BOM rule untuk model + order ini.
            </div>
          ) : bomRule ? (
            <section aria-label="Field sesuai BOM rule">
              <div className="mb-2 text-sm font-medium text-on-surface-variant">
                Field BOM ({fields.length} dideklarasikan • {requiredKeys.length} wajib) — nilai harus
                mengandung prefix dari BOM
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((f) => (
                  <TextField
                    key={f.key}
                    label={f.label}
                    value={String((form as Record<string, unknown>)[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    required={f.required}
                    helper={f.prefix ? `Prefix BOM: ${f.prefix}` : undefined}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant p-4 text-xs text-on-surface-variant">
              Isi <b>Model</b> dan <b>Order Number</b> untuk memuat field SN dari BOM rule.
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={detail != null}
        onOpenChange={(open) => !open && setDetail(null)}
        title="Detail Registrasi"
      >
        {detail && (
          <dl className="mt-2 grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
            {(
              [
                ["Model", detail.model],
                ["Order Number", detail.order_number],
                ["PO Number", detail.po_number],
                ["Line", detail.subline],
                ["Shift", detail.shift],
                ["Plan", detail.plan != null ? String(detail.plan) : null],
                ["Scan", detail.total != null ? String(detail.total) : null],
                ["Waktu", detail.timestamps ? new Date(detail.timestamps).toLocaleString("id-ID") : null],
                ["SN Unit", detail.sn],
                ["SN ODU", detail.sn_odu],
                ["SN Motor", detail.sn_motor],
                ["SN Box", detail.sn_box],
                ["PCB IDU", detail.pcb_idu],
                ["SN Carton", detail.sn_carton],
                ["SN Accessories", detail.sn_accessories],
                ["SN Drum", detail.sn_drum],
                ["SN Pump", detail.sn_pump],
              ] as const
            )
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-on-surface-variant">{k}</dt>
                  <dd className="break-all font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        )}
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
