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
import { Select } from "@/components/vm3/Select";
import { SearchField } from "@/components/vm3/SearchField";
import { IconButton } from "@/components/vm3/IconButton";
import { Combobox } from "@/components/vm3/Combobox";
import { useSnackbar } from "@/components/vm3/Snackbar";
import { useAuth } from "@/lib/auth";
import { bomFields, type BomRule } from "@/lib/bom";

interface Line {
  id: string;
  line: string | null;
}

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
  sn_drum: "",
  sn_pump: "",
};

interface PostResult {
  result?: { id: string };
}

export default function RegistPage() {
  const { show } = useSnackbar();
  const { user } = useAuth();
  const router = useRouter();
  const isPpc = user?.roleuser.toLowerCase() === "ppc";
  const [rows, setRows] = useState<Regist[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [lineLoading, setLineLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  // batch yang sedang diedit (null = mode create)
  const [editing, setEditing] = useState<Regist | null>(null);
  // batch yang sedang dilihat detailnya (dialog read-only)
  const [detail, setDetail] = useState<Regist | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pinAction, setPinAction] = useState<"delete" | null>(null);
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;
    http
      .get<{ data: Line[] }>("/line")
      .then((res) => {
        if (!cancelled) setLines(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setLines([]);
          show("Gagal memuat daftar line");
        }
      })
      .finally(() => {
        if (!cancelled) setLineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show]);

  const lineOptions = useMemo(() => {
    const options = lines.flatMap(({ line }) => {
      const value = line?.trim();
      return value ? [{ value, label: value }] : [];
    });
    if (form.subline && !options.some((option) => option.value === form.subline)) {
      options.unshift({ value: form.subline, label: form.subline });
    }
    return options;
  }, [form.subline, lines]);

  // Batch belum tuntas (plan > scan) — operator harus menyelesaikannya dulu.
  const [pending, setPending] = useState<{ id: string; model: string; order_number: string; plan: number; total: number }[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const res = await http.get<{ data: { id: string; model: string; order_number: string; plan: number; total: number }[] }>(
        "/registscan/checkregist",
        { extraHeaders: { iduser: user?.id ?? "" } },
      );
      setPending(res.data ?? []);
    } catch {
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    http
      .get<{ data: { id: string; model: string; order_number: string; plan: number; total: number }[] }>(
        "/registscan/checkregist",
        { extraHeaders: { iduser: user?.id ?? "" } },
      )
      .then((res) => setPending(res.data ?? []))
      .catch(() => setPending([]))
      .finally(() => setPendingLoading(false));
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
          // Satu BOM rule berlaku universal untuk semua unit dan line.
          const candidates = (res.data ?? []).filter(
            (b) => b.order_number === order && model.startsWith(b.model),
          );
          const hit = candidates[0];
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
  }, [form.model, form.order_number, form.subline]);

  // Satu template BOM dipakai oleh semua unit.
  const fields = useMemo(() => bomFields(bomRule), [bomRule]);
  const requiredKeys = useMemo(
    () => fields.filter((f) => f.required).map((f) => f.key),
    [fields],
  );
  const isFormValid =
    ["model", "order_number", "po_number", "subline"].every(
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

  const openCreate = () => {
    if (isPpc && pending.length > 0) {
      show("Selesaikan scan yang masih terbuka sebelum membuat registrasi baru");
      return;
    }
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  // Edit memakai dialog create: prefill form, BOM probe jalan otomatis dari model+order
  const openEdit = (r: Regist) => {
    setEditing(r);
    setForm({
      model: r.model ?? "",
      order_number: r.order_number ?? "",
      po_number: r.po_number ?? "",
      subline: r.subline ?? "",
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

  const remove = async (verifiedPin?: string) => {
    if (!deleteId) return;
    if (user?.roleuser.toLowerCase() === "ppc" && !verifiedPin) {
      setPin("");
      setPinAction("delete");
      return;
    }
    try {
      await http.del(`/registscan/delete/${deleteId}`, { extraHeaders: verifiedPin ? { "X-PIN": verifiedPin } : undefined });
      show("Data dihapus");
      setDeleteId(null);
      load(keyword, page);
      void loadPending();
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
    }
  };

  const verifyPin = async () => {
    if (!pinAction || !pin.trim()) return;
    setPinLoading(true);
    try {
      await http.post("/pin/compare", { pin });
      setPinAction(null);
      await remove(pin);
    } catch (err) {
      show(`PIN tidak dapat diverifikasi: ${(err as Error).message}`);
    } finally {
      setPinLoading(false);
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
          <Button variant="filled" onClick={handleSearch} className="!bg-primary !text-on-primary">
            Search
          </Button>
        </div>
        <div className="ml-auto">
          <Button icon="add" onClick={openCreate} disabled={pendingLoading || (isPpc && pending.length > 0)} className="!bg-primary !text-on-primary">
            {isPpc && pending.length > 0 ? "Selesaikan scan dulu" : "Create"}
          </Button>
        </div>
      </div>

      {/* Batch belum tuntas — operator diminta melengkapinya dulu */}
      {pending.length > 0 && (
        <Card variant="outlined" className="border-warning/40 bg-warning/10 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="material-symbols-rounded text-warning" aria-hidden>warning</span>
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-warning">{pending.length} batch belum tuntas — lanjutkan scan. Batch yang selesai harus dibuatkan registrasi baru.</div>
              <div className="truncate text-on-surface-variant">
                {pending.map((p) => `${p.order_number} (${p.total}/${p.plan})`).join(" • ")}
              </div>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {pending.map((p) => (
                <Button
                  key={p.id}
                  variant="filled"
                  className="!bg-primary !text-on-primary"
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
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary/90"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-md bg-warning px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-warning/90"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label="Scan"
                        onClick={() => router.push(`/scan?idregist=${r.id}`)}
                        className="flex h-9 w-12 items-center justify-center rounded-md bg-surface-container-high transition-colors hover:bg-surface-container-highest"
                      >
                        <span className="material-symbols-rounded text-[24px] text-on-surface-variant" aria-hidden>barcode_scanner</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Riwayat"
                        onClick={() => router.push(`/history?idregist=${r.id}`)}
                        className="flex h-9 w-12 items-center justify-center rounded-md bg-surface-container-high transition-colors hover:bg-surface-container-highest"
                      >
                        <span className="material-symbols-rounded text-[24px] text-on-surface-variant" aria-hidden>history</span>
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
                <button key={p} type="button" onClick={() => setPage(p)} className={`min-w-7 rounded px-2 py-1 text-sm ${page === p ? "bg-surface-container-highest font-semibold" : "hover:bg-surface-container"}`}>{p}</button>
              );
            })}
            {totalPages > 5 && <span className="px-2 text-sm text-on-surface-variant">...</span>}
            {totalPages > 5 && (
              <button type="button" onClick={() => setPage(totalPages)} className={`min-w-7 rounded px-2 py-1 text-sm ${page === totalPages ? "bg-surface-container-highest font-semibold" : "hover:bg-surface-container"}`}>{totalPages}</button>
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
        className="sm:!max-w-4xl"
        description="Masukkan Model, Batch, PO Number sesuai dengan plan"
        actions={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={() => submit()} disabled={!isFormValid}>{editing ? "Simpan Perubahan" : "Simpan"}</Button>
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
                <p className="mt-1 text-xs text-warning">Model tidak ada di Model Master</p>
              )}
            </div>
            <TextField label="Order Number" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} required />
            <TextField label="PO Number" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} required />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Line *</label>
              <Select
                options={lineOptions}
                value={form.subline || null}
                onChange={(value) => setForm({ ...form, subline: value ?? "" })}
                placeholder={lineLoading ? "Memuat line..." : "Pilih line produksi"}
                disabled={lineLoading || lineOptions.length === 0}
                aria-label="Line produksi"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {lineLoading ? "Memuat daftar line..." : lineOptions.length ? "Pilih line yang akan menjalankan batch ini." : "Belum ada line tersedia."}
              </p>
            </div>
            <TextField label="Shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} />
            <TextField label="Plan" type="number" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
          </div>

          {/* Status BOM rule — sumber field SN */}
          {ruleLoading ? (
            <div className="rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">
              Memuat BOM rule...
            </div>
          ) : ruleError ? (
            <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-xs text-error">
              {ruleError} — minta admin membuat BOM rule untuk model + order ini.
            </div>
          ) : bomRule ? (
            <section aria-label="Field sesuai BOM rule">
              {/* <div className="mb-2 text-sm font-medium text-on-surface-variant">
                Field BOM ({fields.length} dideklarasikan • {requiredKeys.length} wajib) — nilai harus
                mengandung prefix dari BOM
              </div> */}
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
              {/* Isi <b>Model</b> dan <b>Batch</b> untuk memuat field SN dari BOM rule. */}
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
        open={pinAction != null}
        onOpenChange={(open) => !open && setPinAction(null)}
        title="Verifikasi PIN"
        description="PPC wajib memasukkan PIN harian sebelum menghapus registrasi."
        actions={<><Button variant="text" onClick={() => setPinAction(null)}>Batal</Button><Button loading={pinLoading} onClick={verifyPin}>Verifikasi</Button></>}
      >
        <div className="mt-4"><TextField label="PIN Harian" type="password" value={pin} onChange={(event) => setPin(event.target.value)} /></div>
      </Dialog>

      <Dialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Registrasi"
        description="Data registrasi beserta scan terkait? Tindakan ini tidak dapat dibatalkan."
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button onClick={() => remove()}>Hapus</Button>
          </>
        }
      />
    </div>
  );
}
