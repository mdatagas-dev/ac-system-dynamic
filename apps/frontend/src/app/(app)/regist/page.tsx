"use client";

/**
 * Registrasi batch — daftar + buat registscan.
 * Replikasi legacy: kolom Action dengan drill untuk masuk window scan.
 * + Integrasi product_categories & component_definitions dinamis.
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
import { Select } from "@/components/vm3/Select";
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

interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  suffix_length?: number;
  created_at?: string;
}

interface ComponentDef {
  id: string;
  category_id: string;
  key: string;
  label: string;
  required: boolean;
  enabled: boolean;
  sort: number;
  regex?: string | null;
  created_at?: string;
}

const FALLBACK_CATEGORIES: ProductCategory[] = [
  { id: "fallback-ac_split", slug: "ac_split", name: "AC Split", suffix_length: 5 },
  { id: "fallback-ac_commercial", slug: "ac_commercial", name: "AC Commercial (HVAC)", suffix_length: 5 },
  { id: "fallback-ac_portable", slug: "ac_portable", name: "AC Portable", suffix_length: 5 },
  { id: "fallback-washing", slug: "washing", name: "Mesin Cuci", suffix_length: 5 },
];

const CATEGORY_LABEL_FALLBACK: Record<string, string> = {
  ac_split: "AC Split",
  ac_commercial: "AC Commercial (HVAC)",
  ac_portable: "AC Portable",
  washing: "Mesin Cuci",
};

const EMPTY: Record<string, string> = {
  product_category: "ac_split",
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
    if (isOdu) return [...base, "sn_odu", "sn_motor", "sn_box"] as const;
    if (isIdu) return [...base, "sn", "pcb_idu", "sn_accessories"] as const;
  }
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
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // product_categories & component_definitions
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [defs, setDefs] = useState<ComponentDef[]>([]);
  const [defsLoading, setDefsLoading] = useState(false);

  // Fetch product_categories saat mount
  useEffect(() => {
    let cancelled = false;
    http
      .get<{ data: ProductCategory[] }>("/product-categories")
      .then((res) => {
        if (cancelled) return;
        const data = res.data ?? [];
        if (data.length) setCategories(data);
        else setCategories(FALLBACK_CATEGORIES);
      })
      .catch(() => {
        if (!cancelled) setCategories(FALLBACK_CATEGORIES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch component_definitions ketika product_category berubah
  useEffect(() => {
    const slug = String(form.product_category ?? "ac_split").trim().toLowerCase();
    if (!slug) {
      setDefs([]);
      return;
    }
    let cancelled = false;
    setDefsLoading(true);
    http
      .get<{ data: ComponentDef[] }>(`/components?slug=${encodeURIComponent(slug)}`)
      .then((res) => {
        if (cancelled) return;
        const list = (res.data ?? []).filter((d) => d.enabled);
        list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.label.localeCompare(b.label));
        setDefs(list);
      })
      .catch(() => {
        if (!cancelled) setDefs([]);
      })
      .finally(() => {
        if (!cancelled) setDefsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.product_category]);

  const enabledDefs = defs.filter((d) => d.enabled);
  const hasDynamic = enabledDefs.length > 0;
  const dynamicRequiredKeys = enabledDefs.filter((d) => d.required).map((d) => d.key);

  // Tombol Simpan disabled logic ikut definisi dinamis jika ada, else fallback getRequired
  const fallbackRequired = getRequired(form.subline);
  const requiredKeys: readonly string[] = hasDynamic
    ? (["model", "order_number", "po_number", "subline", ...dynamicRequiredKeys] as const)
    : fallbackRequired;
  const requiredSet = new Set<string>(requiredKeys as unknown as string[]);
  const isFormValid = (requiredKeys as readonly string[]).every(
    (k) => String((form as Record<string, unknown>)[k] ?? "").trim() !== ""
  );

  const categoryOptions = (categories.length ? categories : FALLBACK_CATEGORIES).map((c) => ({
    value: c.slug,
    label: CATEGORY_LABEL_FALLBACK[c.slug] ?? c.name,
  }));
  const activeCategoryLabel =
    CATEGORY_LABEL_FALLBACK[String(form.product_category)] ??
    categories.find((c) => c.slug === form.product_category)?.name ??
    String(form.product_category ?? "");

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
        product_category: String(form.product_category ?? "ac_split").trim().toLowerCase(),
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
          {/* 1) Selector Produk di atas dialog — sebelum Subline */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface" htmlFor="produk-select">
              Produk
            </label>
            <Select
              options={categoryOptions}
              value={String(form.product_category ?? "ac_split")}
              onChange={(v) => setForm((prev) => ({ ...prev, product_category: v ?? "ac_split" }))}
              placeholder="Pilih produk"
              className="w-full"
            />
            {defsLoading ? (
              <div className="mt-1.5 text-xs text-on-surface-variant">Memuat komponen...</div>
            ) : hasDynamic ? (
              <div className="mt-1.5 text-xs text-on-surface-variant">
                {enabledDefs.length} komponen • {dynamicRequiredKeys.length} wajib
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            <TextField label="Order Number" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} required />
            <TextField label="PO Number" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} required />
            <TextField label="Subline" value={form.subline} onChange={(e) => setForm({ ...form, subline: e.target.value })} required />
            <TextField label="Shift" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} />
            <TextField label="Plan" type="number" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
          </div>

          {/* 5) Pill ODU/IDU cepat untuk AC Split; kategori lain → info dinamis / sembunyikan */}
          {hasDynamic ? (
            <div className="rounded-lg bg-surface-container p-3">
              <div className="text-xs font-medium text-on-surface-variant">
                Komponen untuk <span className="font-semibold text-on-surface">{activeCategoryLabel}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {enabledDefs.map((d) => (
                  <span
                    key={d.key}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${d.required ? "bg-[#0f1445] text-white border-[#0f1445]" : "bg-white text-gray-700 border-gray-300"}`}
                    title={d.key}
                  >
                    {d.label}
                    {d.required ? " *" : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : String(form.product_category) === "ac_split" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container p-3">
              <span className="text-sm font-medium">Pilih Subline:</span>
              <button
                type="button"
                onClick={() => setForm({ ...form, subline: "LINE ODU ASSY INPUT" })}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${form.subline.toUpperCase().includes("ODU") ? "bg-[#0f1445] text-white border-[#0f1445]" : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100"}`}
              >
                ODU
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, subline: "LINE IDU ASSY INPUT" })}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${form.subline.toUpperCase().includes("IDU") ? "bg-[#0f1445] text-white border-[#0f1445]" : "bg-white text-gray-900 border-gray-300 hover:bg-gray-100"}`}
              >
                IDU
              </button>
              <span className="text-xs text-on-surface-variant ml-1">atau ketik manual di field Subline</span>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant p-3 text-xs text-on-surface-variant">
              Belum ada definisi komponen untuk <span className="font-semibold">{activeCategoryLabel}</span> — menampilkan field fallback IDU/ODU
            </div>
          )}

          {/* 2) Field SN dinamis berdasarkan component_definitions, fallback ke logic lama */}
          {hasDynamic ? (
            <section aria-label="Komponen dinamis">
              <div className="mb-2 text-sm font-medium text-on-surface-variant">
                Komponen {dynamicRequiredKeys.length ? `— wajib isi ${dynamicRequiredKeys.length} field` : "(semua opsional)"}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {enabledDefs.map((def) => (
                  <TextField
                    key={def.key}
                    label={def.label}
                    value={String((form as Record<string, unknown>)[def.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [def.key]: e.target.value })}
                    required={def.required}
                  />
                ))}
              </div>
            </section>
          ) : !form.subline.trim() ? (
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
