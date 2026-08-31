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

interface BomRuleField {
  key: string;
  label: string;
  prefix: string;
  required: boolean;
}

interface BomRule {
  id: string;
  model: string;
  order_number: string;
  sn?: string | null;
  sn_carton?: string | null;
  pcb_idu?: string | null;
  sn_box?: string | null;
  sn_motor?: string | null;
  sn_accessories?: string | null;
  sn_odu?: string | null;
  components?: Record<string, { label?: string; prefix?: string; required?: boolean }> | null;
}

const FIXED_LABELS: Record<string, string> = {
  sn: "Serial Number Unit",
  sn_carton: "SN Carton",
  pcb_idu: "SN PCB",
  sn_box: "SN Electrical Box",
  sn_motor: "SN Motor",
  sn_accessories: "SN Accessories",
  sn_odu: "Serial Number (ODU)",
};

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
};

/** Field yang dideklarasikan BOM rule: kolom tetap terisi + kunci components JsonB */
function bomFields(rule: BomRule | null): BomRuleField[] {
  if (!rule) return [];
  const fields: BomRuleField[] = [];
  for (const [key, label] of Object.entries(FIXED_LABELS)) {
    const v = (rule as unknown as Record<string, unknown>)[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      fields.push({ key, label, prefix: String(v), required: true });
    }
  }
  const comps = rule.components && typeof rule.components === "object" ? rule.components : {};
  for (const [key, def] of Object.entries(comps)) {
    const d = def && typeof def === "object" ? def : {};
    fields.push({
      key,
      label: d.label || key,
      prefix: d.prefix ?? "",
      required: d.required !== false,
    });
  }
  return fields;
}

interface PostResult {
  result?: { id: string };
}

export default function RegistPage() {
  const { show } = useSnackbar();
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Regist[]>([]);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Batch belum tuntas (plan > scan) — "Harap lengkapi record berikut!"
  const [pending, setPending] = useState<{ id: string; model: string; plan: number; total: number }[]>([]);
  const loadPending = async () => {
    try {
      const res = await http.get<{ data: { id: string; model: string; plan: number; total: number }[] }>(
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
      .get<{ data: { id: string; model: string; plan: number; total: number }[] }>(
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
          const hit = (res.data ?? []).find(
            (b) => b.order_number === order && model.endsWith(b.model),
          );
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
  }, [form.model, form.order_number]);

  const fields = useMemo(() => bomFields(bomRule), [bomRule]);
  const requiredKeys = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.key),
    [fields],
  );
  const isFormValid =
    ["model", "order_number", "po_number"].every(
      (k) => String((form as Record<string, unknown>)[k] ?? "").trim() !== "",
    ) &&
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

  const submit = async () => {
    try {
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
              <div className="font-semibold text-amber-900">{pending.length} batch belum tuntas — harap lengkapi scan</div>
              <div className="truncate text-amber-800">
                {pending.map((p) => `${p.model} (${p.total}/${p.plan})`).join(" • ")}
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
                  Scan {p.model}
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
        description="Field SN mengikuti BOM rule untuk model + order number."
        actions={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={submit} disabled={!isFormValid}>Simpan</Button>
          </>
        }
      >
        <div className="mt-4 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Model — combobox: ketik untuk mencari, saran dari Model Master */}
            <div>
              <label htmlFor="regist-model" className="mb-1.5 block text-sm font-medium text-foreground">
                Model *
              </label>
              <input
                id="regist-model"
                list="regist-model-options"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="h-11 w-full rounded-[var(--vm3-shape-lg)] border border-[var(--vm3-color-outline-variant)] bg-[var(--vm3-color-surface-container-highest)] px-3 text-sm text-[var(--vm3-color-on-surface)] outline-none focus:border-[var(--vm3-color-primary)] focus:ring-2 focus:ring-[var(--vm3-color-primary)]/20"
                placeholder="Ketik untuk mencari model"
                autoComplete="off"
              />
              <datalist id="regist-model-options">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
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
