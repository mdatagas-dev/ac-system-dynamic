"use client";

/**
 * Master Data — CRUD Model, Line, BOM, Users, PIN (satu halaman, tab)
 * + Produk (Kategori) — admin eksperimen tambah kolom.
 *
 * Produk: slug (unique), name  -> base /product-categories
 * Setiap tab punya pencarian teks (client-side) + filter kategori
 * (tab Model & BOM List) yang memfilter baris yang sudah dimuat.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { IconButton } from "@/components/vm3/IconButton";
import { TextField } from "@/components/vm3/TextField";
import { Card } from "@/components/vm3/Card";
import { Tabs } from "@/components/vm3/Navigation";
import { Dialog } from "@/components/vm3/Dialog";
import { Select } from "@/components/vm3/Select";
import { Combobox } from "@/components/vm3/Combobox";
import { useSnackbar } from "@/components/vm3/Snackbar";

/* ---------- Definisi entitas ---------- */
interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "password" | "date" | "switch" | "select";
  required?: boolean;
  editOnly?: boolean;
  createOnly?: boolean;
}

interface Entity {
  key: string;
  label: string;
  base: string; // path API
  fields: Field[];
  rowKey: (row: Record<string, unknown>) => string;
  getList: () => Promise<Record<string, unknown>[]>;
  create: (data: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

const ENTITIES: Entity[] = [
  {
    key: "model",
    label: "Model",
    base: "/model",
    fields: [
      { key: "brand", label: "Brand", required: true },
      { key: "model", label: "Model", required: true },
      { key: "category_id", label: "Kategori", required: true },
      { key: "product", label: "Produk (ODU/IDU)" },
      { key: "pk", label: "PK", type: "number" },
      { key: "linkimage", label: "Link Image" },
    ],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/model?limit=100").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/model/post", d),
    update: (id, d) => http.put(`/model/edit/${id}`, d),
    remove: (id) => http.del(`/model/delete/${id}`),
  },
  {
    key: "line",
    label: "Line",
    base: "/line",
    fields: [{ key: "line", label: "Line", required: true }],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/line").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/line/post", d),
    update: () => Promise.reject(new Error("Edit line belum didukung backend")),
    remove: (id) => http.del(`/line/${id}`),
  },
  {
    key: "bomlist",
    label: "BOM List",
    base: "/bomlist",
    fields: [
      { key: "model", label: "Model", required: true },
      { key: "order_number", label: "Order Number", required: true },
      { key: "sn", label: "SN" },
      { key: "sn_carton", label: "SN Carton" },
      { key: "sn_box", label: "SN Box" },
      { key: "sn_motor", label: "SN Motor" },
      { key: "pcb_idu", label: "PCB IDU" },
      { key: "sn_accessories", label: "SN Accessories" },
    ],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/bomlist?limit=100").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/bomlist/post", d),
    update: (id, d) => http.put(`/bomlist/edit/${id}`, d),
    remove: (id) => http.del(`/bomlist/delete/${id}`),
  },
  {
    key: "users",
    label: "Users",
    base: "/users",
    fields: [
      { key: "username", label: "Username", required: true },
      { key: "password", label: "Password", type: "password", required: true },
      { key: "email", label: "Email", required: true },
      { key: "roleuser", label: "Role" },
      { key: "departement", label: "Departemen" },
      { key: "section", label: "Section" },
    ],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/users?limit=100").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/users/regist", d),
    update: (id, d) => http.put(`/users/update/${id}`, d),
    remove: (id) => http.del(`/users/delete/${id}`),
  },
  {
    key: "pin",
    label: "PIN Harian",
    base: "/pin",
    fields: [
      { key: "date", label: "Tanggal", type: "date", required: true },
      { key: "pin", label: "PIN", type: "number", required: true },
    ],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/pin").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/pin/post", d),
    update: () => Promise.reject(new Error("Edit PIN belum didukung backend")),
    remove: (id) => http.del(`/pin/delete/${id}`),
  },
  {
    key: "product_categories",
    label: "Produk (Kategori)",
    base: "/product-categories",
    fields: [
      { key: "slug", label: "Slug", required: true },
      { key: "name", label: "Nama Kategori", required: true },
    ],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/product-categories").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/product-categories/post", d),
    update: (id, d) => http.put(`/product-categories/edit/${id}`, d),
    remove: (id) => http.del(`/product-categories/delete/${id}`),
  },
];

const EMPTY_FORM: Record<string, unknown> = {};

type ProductCategoryRow = Record<string, unknown> & { id: string; slug: string; name: string; suffix_length?: number };

// 7 kolom material yang bisa dideklarasikan template kategori
const MATERIAL_FIELDS = [
  { key: "sn", label: "Serial Number" },
  { key: "sn_carton", label: "SN Carton" },
  { key: "pcb_idu", label: "SN PCB" },
  { key: "sn_box", label: "SN Electrical Box" },
  { key: "sn_motor", label: "SN Motor" },
  { key: "sn_accessories", label: "SN Accessories" },
  { key: "sn_odu", label: "Serial Number (ODU)" },
] as const;
interface TemplateField { key: string; enabled: boolean; label: string; unit: string }
type CatTemplate = { key: string; label?: string; unit?: string | null };
type CatListResponse = { data: Array<{ slug: string; fields: CatTemplate[] | null }> };

export default function MasterPage() {
  const { show } = useSnackbar();
  const [tab, setTab] = useState("model");
  const entity = useMemo(() => ENTITIES.find((e) => e.key === tab) ?? ENTITIES[0], [tab]);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(EMPTY_FORM);
  // BOM: field key → unit AC ("ODU"/"IDU"/"") — dipakai validasi scan per subline
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  // Template kategori (struktur field material): key → { enabled, label, unit }
  const [template, setTemplate] = useState<TemplateField[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Kategori (root hierarki) — untuk combobox model + filter
  const [categories, setCategories] = useState<ProductCategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Model master — untuk Combobox di form BOM List
  const [models, setModels] = useState<string[]>([]);
  // Template kategori yang berlaku untuk model terpilih di form BOM (template-is-law:
  // hanya field yang dideklarasikan kategori yang bisa diisi prefix-nya).
  const [bomTemplate, setBomTemplate] = useState<Array<{ key: string; label?: string; unit?: string | null }> | null>(null);
  useEffect(() => {
    const slug = tab === "bomlist" && entity.key === "bomlist" && editing ? String(editing.product_category ?? "") : "";
    let cancelled = false;
    const lookup = slug
      ? http
          .get<CatListResponse>("/product-categories")
          .then((r) => (r.data ?? []).find((c) => c.slug === slug)?.fields ?? null)
          .catch(() => null)
      : Promise.resolve(null);
    lookup.then((fields) => {
      if (!cancelled) setBomTemplate(fields);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, editing, entity.key]);
  useEffect(() => {
    if (tab !== "bomlist") return;
    let cancelled = false;
    http
      .get<{ data: Record<string, unknown>[] }>("/model?limit=100")
      .then((r) => {
        if (cancelled) return;
        setModels(
          ((r.data ?? []) as Record<string, unknown>[])
            .map((m) => String(m.model ?? ""))
            .filter(Boolean),
        );
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  // Line master — datalist untuk Section user (subline registrasi)
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    if (tab !== "users") return;
    let cancelled = false;
    http
      .get<{ data: Record<string, unknown>[] }>("/line")
      .then((r) => {
        if (cancelled) return;
        setLines(
          ((r.data ?? []) as Record<string, unknown>[])
            .map((l) => String(l.line ?? ""))
            .filter(Boolean),
        );
      })
      .catch(() => {
        if (!cancelled) setLines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const list = await http.get<{ data: ProductCategoryRow[] }>("/product-categories").then((r) => r.data ?? []);
      setCategories(list as ProductCategoryRow[]);
    } catch {
      // silent - biar komponen tetap bisa load tanpa filter
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await entity.getList());
    } catch (err) {
      show(`Gagal memuat ${entity.label}: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [entity, show]);

  // load kategori untuk tab model (combobox) / product_categories / bomlist (template)
  useEffect(() => {
    if (tab !== "model" && tab !== "product_categories" && tab !== "bomlist") return;
    http
      .get<{ data: ProductCategoryRow[] }>("/product-categories")
      .then((r) => setCategories((r.data ?? []) as ProductCategoryRow[]))
      .catch(() => {
        /* silent */
      });
  }, [tab]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, tab]);

  // pencarian + filter kategori dilakukan di sisi klien: tiap tab memuat
  // maksimal 100 baris, jadi memfilter hasil yang sudah ada lebih murah
  // daripada menambah endpoint filter per entitas. Filter di-reset saat tab
  // berganti lewat key pada kontainer di bawah, bukan setState dalam effect.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter) {
        const slug = String(row.product_category ?? row.category_slug ?? "");
        if (slug !== categoryFilter) return false;
      }
      if (!q) return true;
      return entity.fields.some((f) =>
        String(row[f.key] ?? "").toLowerCase().includes(q),
      );
    });
  }, [rows, search, categoryFilter, entity]);

  const openCreate = () => {
    setEditing(null);
    if (entity.key === "product_categories") {
      setForm({ slug: "", name: "" });
      // default template: sn saja (identitas unit) — sn tidak boleh dimatikan
      setTemplate([{ key: "sn", enabled: true, label: MATERIAL_FIELDS[0].label, unit: "" }]);
    } else if (entity.key === "model") {
      setForm({ category_id: "" });
    } else {
      setForm({});
    }
    setUnitMap({});
    setDialogOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setUnitMap({});
    if (entity.key === "product_categories") {
      setForm({
        slug: String(row.slug ?? ""),
        name: String(row.name ?? ""),
      });
      // pulihkan template tersimpan; field tak ada di template = nonaktif
      const saved = Array.isArray(row.fields) ? (row.fields as Array<{ key: string; label?: string; unit?: string | null }>) : [];
      setTemplate(
        MATERIAL_FIELDS.map((mf) => {
          const s = saved.find((t) => t.key === mf.key);
          return { key: mf.key, enabled: Boolean(s), label: s?.label || mf.label, unit: s?.unit ?? "" };
        }),
      );
    } else if (entity.key === "bomlist") {
      const next: Record<string, unknown> = {};
      for (const f of entity.fields) next[f.key] = row[f.key] ?? "";
      setForm(next);
      const um = row.unit_map && typeof row.unit_map === "object" ? (row.unit_map as Record<string, unknown>) : {};
      setUnitMap(
        Object.fromEntries(
          Object.entries(um).map(([k, v]) => [k, String(v)]),
        ),
      );
    } else {
      const next: Record<string, unknown> = {};
      for (const f of entity.fields) next[f.key] = row[f.key] ?? "";
      setForm(next);
    }
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      // normalisasi
      const payload: Record<string, unknown> = { ...form };
      if (entity.key === "product_categories") {
        if (payload.slug) payload.slug = String(payload.slug).trim().toLowerCase();
        if (payload.name) payload.name = String(payload.name).trim();
        // template: field aktif saja — server memvalidasi (≥1 field, wajib sn)
        const fields = template
          .filter((t) => t.enabled)
          .map((t) => ({ key: t.key, label: t.label.trim() || undefined, unit: t.unit || null }));
        payload.fields = fields;
      }
      if (entity.key === "bomlist") {
        // hanya simpan unit yang terisi (ODU/IDU)
        const um = Object.fromEntries(
          Object.entries(unitMap).filter(([, v]) => v === "ODU" || v === "IDU"),
        );
        if (Object.keys(um).length) payload.unit_map = um;
      }

      if (editing) {
        await entity.update(entity.rowKey(editing), payload);
        show(`${entity.label} diperbarui`);
      } else {
        await entity.create(payload);
        show(`${entity.label} ditambahkan`);
      }
      setDialogOpen(false);
      load();
      // refresh kategori bila baru tambah kategori
      if (entity.key === "product_categories" && !editing) loadCategories();
    } catch (err) {
      show(`Gagal simpan: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await entity.remove(deleteId);
      show("Data dihapus");
      setDeleteId(null);
      load();
      if (entity.key === "product_categories") loadCategories();
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
    }
  };

  const canEdit = entity.update !== undefined;

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: `${String(c.name)} (${String(c.slug)})` })),
    [categories],
  );

  // Produk ODU/IDU: opsi dari unit field di template kategori yang dipilih
  const productOptions = useMemo(() => {
    const cat = categories.find((c) => c.id === form.category_id);
    const fields = Array.isArray(cat?.fields) ? (cat.fields as Array<{ unit?: string }>) : [];
    const units = [...new Set(fields.map((f) => f.unit).filter(Boolean))] as string[];
    // ponytail: fallback ke IDU/ODU bila kategori tak punya template field dengan unit
    return units.length ? units.map((u) => ({ value: u, label: u })) : [{ value: "IDU", label: "IDU" }, { value: "ODU", label: "ODU" }];
  }, [form.category_id, categories]);

  // filter dropdown pakai slug sebagai value: baris model & bomlist membawa
  // product_category sebagai slug (lihat header komentar di atas).
  const categoryFilterOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.slug), label: `${String(c.name)} (${String(c.slug)})` })),
    [categories],
  );


  // Judul dialog
  const dialogTitle = editing ? `Edit ${entity.label}` : `Tambah ${entity.label}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Master Data</h1>
      <Tabs
        tabs={ENTITIES.map((e) => ({ value: e.key, label: e.label }))}
        value={tab}
        onChange={(v) => setTab(v)}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Cari"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari ${entity.label.toLowerCase()}…`}
            className="w-64"
          />
          {(entity.key === "model" || entity.key === "bomlist") && (
            <div className="w-56" key={tab}>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Kategori</label>
              <Select
                options={[{ value: "", label: "Semua kategori" }, ...categoryFilterOptions]}
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(v)}
                placeholder="Semua kategori"
              />
            </div>
          )}
        </div>
        <Button icon="add" onClick={openCreate}>
          Tambah {entity.label}
        </Button>
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                {entity.fields.map((f) => (
                  <th key={f.key} className="p-3">
                    {f.label}
                  </th>
                ))}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={entity.rowKey(row)} className="border-b border-outline-variant last:border-0">
                  {entity.fields.map((f) => (
                    <td key={f.key} className="p-3">
                      {f.type === "password"
                        ? "••••••"
                        : entity.key === "model" && f.key === "category_id"
                          ? String(row.category_name ?? "-")
                          : f.type === "switch"
                            ? row[f.key]
                              ? "Ya"
                              : "Tidak"
                            : String(row[f.key] ?? "-")}
                    </td>
                  ))}
                  <td className="p-1 text-right whitespace-nowrap">
                    {canEdit && <IconButton icon="edit" label="Edit" onClick={() => openEdit(row)} />}
                    <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(entity.rowKey(row))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && !loading && (
            <div className="p-8 text-center text-on-surface-variant">
              {rows.length === 0 ? "Belum ada data" : "Tidak ada hasil yang cocok"}
            </div>
          )}
          {loading && <div className="p-8 text-center text-on-surface-variant">Memuat...</div>}
        </div>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        actions={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={save} loading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {entity.fields
            .filter((f) => !(editing && f.editOnly))
            // template-is-law: BOM hanya menampilkan field yang dideklarasikan kategori
            .filter((f) => {
              if (entity.key !== "bomlist" || f.key === "model" || f.key === "order_number") return true;
              return Boolean(bomTemplate?.some((t) => t.key === f.key));
            })
            .map((f) =>
              entity.key === "bomlist" && f.key === "model" ? (
                <Combobox
                  key={f.key}
                  label={f.label}
                  options={models}
                  value={String(form[f.key] ?? "")}
                  onChange={(v) => setForm({ ...form, [f.key]: v })}
                  placeholder="Ketik untuk mencari model"
                />
              ) : entity.key === "bomlist" && f.key !== "order_number" ? (
                <div key={f.key} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={f.label}
                      value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder="Prefix SN (opsional)"
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Unit AC</label>
                    <Select
                      options={[
                        { value: "", label: "Semua" },
                        { value: "IDU", label: "IDU" },
                        { value: "ODU", label: "ODU" },
                      ]}
                      value={unitMap[f.key] ?? ""}
                      onChange={(v) => setUnitMap({ ...unitMap, [f.key]: v ?? "" })}
                      placeholder="Semua"
                    />
                  </div>
                </div>
              ) : entity.key === "model" && f.key === "product" ? (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">{f.label}</label>
                  <Select
                    options={productOptions}
                    value={String(form.product ?? "")}
                    onChange={(v) => setForm({ ...form, product: v ?? "" })}
                    placeholder="Pilih produk"
                  />
                </div>
              ) : entity.key === "model" && f.key === "category_id" ? (
                <div key={f.key}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Kategori *</label>
                  <Select
                    options={categoryOptions}
                    value={String(form.category_id ?? "") || ""}
                    onChange={(v) => setForm({ ...form, category_id: v ?? "" })}
                    placeholder={categoriesLoading ? "Memuat kategori..." : "Pilih kategori"}
                  />
                </div>
              ) : entity.key === "users" && f.key === "section" ? (
                <div key={f.key}>
                  <label htmlFor="users-section" className="mb-1.5 block text-sm font-medium text-foreground">
                    Section (Line) *
                  </label>
                  <input
                    id="users-section"
                    list="users-section-options"
                    required
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="h-11 w-full rounded-[var(--vm3-shape-lg)] border border-[var(--vm3-color-outline-variant)] bg-[var(--vm3-color-surface-container-highest)] px-3 text-sm text-[var(--vm3-color-on-surface)] outline-none focus:border-[var(--vm3-color-primary)] focus:ring-2 focus:ring-[var(--vm3-color-primary)]/20"
                    placeholder="Ketik untuk mencari line"
                    autoComplete="off"
                  />
                  <datalist id="users-section-options">
                    {lines.map((l) => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dipakai otomatis sebagai subline saat registrasi
                  </p>
                </div>
              ) : (
                <TextField
                  key={f.key}
                  label={f.label}
                  type={f.type === "date" ? "date" : f.type === "number" ? "number" : f.type === "password" ? "password" : "text"}
                  required={f.required}
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ),
            )}
        </div>

        {/* Editor template kategori: field material mana yang di-scan untuk kategori ini */}
        {entity.key === "product_categories" && (
          <div className="mt-5 border-t border-outline-variant pt-4">
            <p className="text-sm font-medium text-foreground">Field Material</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Menentukan field yang di-scan untuk semua BOM kategori ini. Minimal 1 field, Serial Number wajib.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {template.map((t, i) => (
                <div key={t.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container px-3 py-2">
                  <label className="flex flex-1 min-w-0 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      disabled={t.key === "sn"}
                      onChange={(e) => setTemplate(template.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
                    />
                    <span className="truncate">{MATERIAL_FIELDS.find((m) => m.key === t.key)?.label ?? t.key}</span>
                  </label>
                  <div className="w-36 min-w-0">
                    <input
                      aria-label={`Label ${t.key}`}
                      value={t.label}
                      onChange={(e) => setTemplate(template.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      placeholder="Label"
                      className="h-11 w-full rounded-[var(--vm3-shape-lg)] border border-[var(--vm3-color-outline-variant)] bg-[var(--vm3-color-surface-container-highest)] px-3 text-sm text-[var(--vm3-color-on-surface)] outline-none focus:border-[var(--vm3-color-primary)] focus:ring-2 focus:ring-[var(--vm3-color-primary)]/20"
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <Select
                      aria-label={`Unit ${t.key}`}
                      options={[
                        { value: "", label: "Semua" },
                        { value: "IDU", label: "IDU" },
                        { value: "ODU", label: "ODU" },
                      ]}
                      value={t.unit}
                      onChange={(v) => setTemplate(template.map((x, j) => (j === i ? { ...x, unit: v ?? "" } : x)))}
                      placeholder="Semua"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={`Hapus ${entity.label}`}
        description="Data akan dihapus permanen. Lanjutkan?"
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
