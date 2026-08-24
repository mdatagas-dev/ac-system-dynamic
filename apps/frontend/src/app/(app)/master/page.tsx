"use client";

/**
 * Master Data — CRUD Model, Line, BOM, Users, PIN (satu halaman, tab)
 * + Produk (Kategori) + Komponen (Definisi) — admin eksperimen tambah kolom.
 *
 * Produk: slug (unique), name, suffix_length  -> base /product-categories
 * Komponen: category (Select dari product_categories), key, label, required, regex, sort, enabled
 *           -> base /components, GET ?category_id= atau ?slug=, POST butuh category_id/slug
 *           Filter: saat admin pilih kategori di atas, tabel filter ke kategori itu.
 *           Tombol "+ Tambah Kolom" buka Dialog dengan key auto snake_case dari label.
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
import { Switch } from "@/components/vm3/Switch";
import { useSnackbar } from "@/components/vm3/Snackbar";

/* ---------- helpers ---------- */
function toSnakeCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
}

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
      { key: "suffix_length", label: "Suffix Length", type: "number", required: true },
    ],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/product-categories").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/product-categories/post", d),
    update: (id, d) => http.put(`/product-categories/edit/${id}`, d),
    remove: (id) => http.del(`/product-categories/delete/${id}`),
  },
  {
    key: "components",
    label: "Komponen (Definisi)",
    base: "/components",
    fields: [
      { key: "key", label: "Key", required: true },
      { key: "label", label: "Label", required: true },
      { key: "required", label: "Wajib", type: "switch" },
      { key: "regex", label: "Regex" },
      { key: "sort", label: "Sort", type: "number" },
      { key: "enabled", label: "Aktif", type: "switch" },
    ],
    rowKey: (r) => String(r.id),
    // getList dioverride saat tab components (butuh filter by category)
    getList: () => http.get<{ data: Record<string, unknown>[] }>("/components").then((r) => (r.data ?? []) as Record<string, unknown>[]),
    create: (d) => http.post("/components/post", d),
    update: (id, d) => http.put(`/components/edit/${id}`, d),
    remove: (id) => http.del(`/components/delete/${id}`),
  },
];

const EMPTY_FORM: Record<string, unknown> = {};

type ProductCategoryRow = Record<string, unknown> & { id: string; slug: string; name: string; suffix_length?: number };

export default function MasterPage() {
  const { show } = useSnackbar();
  const [tab, setTab] = useState("model");
  const entity = useMemo(() => ENTITIES.find((e) => e.key === tab) ?? ENTITIES[0], [tab]);
  const isComponents = tab === "components";

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Khusus komponen: kategori + filter
  const [categories, setCategories] = useState<ProductCategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(""); // "" = semua
  const selectedCategorySlug = useMemo(() => {
    if (!selectedCategoryId) return "";
    const c = categories.find((x) => String(x.id) === selectedCategoryId);
    return c ? String(c.slug) : "";
  }, [categories, selectedCategoryId]);
  const [keyTouched, setKeyTouched] = useState(false);

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
      if (isComponents) {
        // GET /components?category_id=xxx atau ?slug=xxx
        // prioritas category_id (lebih stabil), fallback slug
        let path = "/components";
        if (selectedCategoryId) path = `/components?category_id=${encodeURIComponent(selectedCategoryId)}`;
        else if (selectedCategorySlug) path = `/components?slug=${encodeURIComponent(selectedCategorySlug)}`;
        const data = await http.get<{ data: Record<string, unknown>[] }>(path).then((r) => (r.data ?? []) as Record<string, unknown>[]);
        setRows(data);
      } else {
        setRows(await entity.getList());
      }
    } catch (err) {
      show(`Gagal memuat ${entity.label}: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [entity, isComponents, selectedCategoryId, selectedCategorySlug, show]);

  // load categories saat masuk tab components atau butuh select kategori
  useEffect(() => {
    if (tab === "components" || tab === "product_categories") {
      loadCategories();
    }
  }, [tab, loadCategories]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, tab, selectedCategoryId]);

  const openCreate = () => {
    setEditing(null);
    setKeyTouched(false);
    if (isComponents) {
      setForm({
        category_id: selectedCategoryId || "",
        key: "",
        label: "",
        required: false,
        regex: "",
        sort: 0,
        enabled: true,
      });
    } else if (entity.key === "product_categories") {
      setForm({ slug: "", name: "", suffix_length: 5 });
    } else {
      setForm({});
    }
    setDialogOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setKeyTouched(true);
    if (isComponents) {
      setForm({
        category_id: String(row.category_id ?? row.categoryId ?? selectedCategoryId ?? ""),
        key: String(row.key ?? ""),
        label: String(row.label ?? ""),
        required: Boolean(row.required),
        regex: String(row.regex ?? ""),
        sort: row.sort ?? 0,
        enabled: row.enabled !== false,
      });
    } else if (entity.key === "product_categories") {
      setForm({
        slug: String(row.slug ?? ""),
        name: String(row.name ?? ""),
        suffix_length: row.suffix_length ?? 5,
      });
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
      // normalisasi number fields
      const payload: Record<string, unknown> = { ...form };
      if (entity.key === "product_categories") {
        if (payload.slug) payload.slug = String(payload.slug).trim().toLowerCase();
        if (payload.name) payload.name = String(payload.name).trim();
        if (payload.suffix_length !== undefined && payload.suffix_length !== "") payload.suffix_length = Number(payload.suffix_length);
      }
      if (isComponents) {
        // key auto snake + lower
        if (payload.key) payload.key = String(payload.key).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
        if (payload.label) payload.label = String(payload.label).trim();
        if (payload.regex !== undefined) payload.regex = payload.regex ? String(payload.regex).trim() : null;
        if (payload.sort !== undefined && payload.sort !== "") payload.sort = Number(payload.sort);
        payload.required = !!payload.required;
        payload.enabled = payload.enabled !== false;
        // pastikan category_id atau slug terkirim
        if (!payload.category_id && selectedCategorySlug) payload.slug = selectedCategorySlug;
        if (!payload.category_id && payload.slug) {
          // biarkan slug
        } else if (payload.category_id) {
          // kirim category_id (backend prioritas ini), hapus slug duplikat jika ada agar tidak bingung
          // keep both okay, but ensure category_id valid
        }
        // edit: backend components PUT tidak butuh category_id
        if (editing) {
          delete payload.category_id;
          delete payload.slug;
        } else {
          if (!payload.category_id && !payload.slug) {
            show("Pilih kategori terlebih dahulu");
            setSaving(false);
            return;
          }
        }
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

  const categoryLabelForRow = (row: Record<string, unknown>) => {
    const cid = String(row.category_id ?? row.categoryId ?? "");
    if (!cid) return String(row.slug ?? "-");
    const found = categories.find((c) => String(c.id) === cid);
    if (found) return `${String(found.name)} (${String(found.slug)})`;
    return cid.slice(0, 8);
  };

  // Judul dialog
  const dialogTitle = editing
    ? isComponents
      ? "Edit Kolom"
      : `Edit ${entity.label}`
    : isComponents
      ? "Tambah Kolom"
      : `Tambah ${entity.label}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Master Data</h1>
      <Tabs
        tabs={ENTITIES.map((e) => ({ value: e.key, label: e.label }))}
        value={tab}
        onChange={(v) => setTab(v)}
      />

      {/* Filter khusus Komponen */}
      {isComponents && (
        <Card variant="outlined" className="p-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5 w-full sm:max-w-sm">
            <label className="text-xs font-medium text-on-surface-variant">Filter Kategori</label>
            <Select
              options={[{ value: "", label: "Semua kategori" }, ...categoryOptions]}
              value={selectedCategoryId || ""}
              onChange={(v) => setSelectedCategoryId(v ?? "")}
              placeholder={categoriesLoading ? "Memuat..." : "Pilih kategori"}
            />
            <span className="text-xs text-on-surface-variant">
              {selectedCategoryId ? `Menampilkan komponen untuk slug: ${selectedCategorySlug || "-"}` : "Menampilkan semua komponen"}
            </span>
          </div>
          <div className="text-xs text-on-surface-variant hidden sm:block">
            {categories.length} kategori tersedia
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        {isComponents ? (
          <Button
            icon="add"
            onClick={openCreate}
            disabled={categoriesLoading && categories.length === 0}
            title={!selectedCategoryId && categories.length > 0 ? "Pilih kategori dulu atau akan diminta di dialog" : undefined}
          >
            + Tambah Kolom
          </Button>
        ) : (
          <Button icon="add" onClick={openCreate}>
            Tambah {entity.label}
          </Button>
        )}
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          {/* Tabel Komponen custom */}
          {isComponents ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                  <th className="p-3">Label</th>
                  <th className="p-3">Key</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Wajib</th>
                  <th className="p-3">Regex</th>
                  <th className="p-3">Sort</th>
                  <th className="p-3">Aktif</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={entity.rowKey(row)} className="border-b border-outline-variant last:border-0">
                    <td className="p-3 font-medium">{String(row.label ?? "-")}</td>
                    <td className="p-3">
                      <code className="rounded bg-surface-container px-1.5 py-0.5 text-xs">{String(row.key ?? "-")}</code>
                    </td>
                    <td className="p-3 text-on-surface-variant">{categoryLabelForRow(row)}</td>
                    <td className="p-3">{row.required ? "Ya" : "Tidak"}</td>
                    <td className="p-3 max-w-[180px] truncate" title={String(row.regex ?? "")}>
                      {row.regex ? String(row.regex) : <span className="text-on-surface-variant">-</span>}
                    </td>
                    <td className="p-3 tabular-nums">{String(row.sort ?? 0)}</td>
                    <td className="p-3">{row.enabled === false ? "Tidak" : "Ya"}</td>
                    <td className="p-1 text-right whitespace-nowrap">
                      {canEdit && <IconButton icon="edit" label="Edit" onClick={() => openEdit(row)} />}
                      <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(entity.rowKey(row))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
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
                {rows.map((row) => (
                  <tr key={entity.rowKey(row)} className="border-b border-outline-variant last:border-0">
                    {entity.fields.map((f) => (
                      <td key={f.key} className="p-3">
                        {f.type === "password" ? "••••••" : f.type === "switch" ? (row[f.key] ? "Ya" : "Tidak") : String(row[f.key] ?? "-")}
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
          )}
          {rows.length === 0 && !loading && (
            <div className="p-8 text-center text-on-surface-variant">
              {isComponents
                ? selectedCategoryId
                  ? "Belum ada kolom untuk kategori ini"
                  : "Belum ada komponen"
                : "Belum ada data"}
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
        {/* Dialog Komponen: field khusus dengan Switch & Select */}
        {isComponents ? (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-on-surface-variant">Kategori *</label>
              <Select
                options={categoryOptions}
                value={String(form.category_id ?? selectedCategoryId ?? "") || null}
                onChange={(v) => setForm({ ...form, category_id: v ?? "" })}
                placeholder={categoriesLoading ? "Memuat kategori..." : "Pilih kategori"}
                disabled={!!editing}
              />
              {editing && <span className="text-xs text-on-surface-variant">Kategori tidak dapat diubah saat edit</span>}
            </div>
            <TextField
              label="Label *"
              required
              value={String(form.label ?? "")}
              onChange={(e) => {
                const nextLabel = e.target.value;
                setForm((prev) => {
                  const next: Record<string, unknown> = { ...prev, label: nextLabel };
                  if (!keyTouched) next.key = toSnakeCase(nextLabel);
                  return next;
                });
              }}
              helper="Contoh: No Mesin, Warna Body"
            />
            <TextField
              label="Key * (snake_case)"
              required
              value={String(form.key ?? "")}
              onChange={(e) => {
                setKeyTouched(true);
                setForm({ ...form, key: e.target.value });
              }}
              helper="Otomatis dari label, bisa diedit. Hanya a-z, 0-9, _"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Regex (opsional)"
                placeholder="mis: ^[A-Z0-9]{5,}$"
                value={String(form.regex ?? "")}
                onChange={(e) => setForm({ ...form, regex: e.target.value })}
              />
              <TextField
                label="Sort"
                type="number"
                value={String(form.sort ?? 0)}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-outline-variant p-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center justify-between gap-3 sm:justify-start">
                <span className="text-sm font-medium">Wajib (required)</span>
                <Switch
                  checked={Boolean(form.required)}
                  onChange={(e) => setForm({ ...form, required: (e.target as HTMLInputElement).checked })}
                  aria-label="Wajib"
                />
              </label>
              <label className="flex items-center justify-between gap-3 sm:justify-start">
                <span className="text-sm font-medium">Aktif (enabled)</span>
                <Switch
                  checked={form.enabled !== false}
                  onChange={(e) => setForm({ ...form, enabled: (e.target as HTMLInputElement).checked })}
                  aria-label="Aktif"
                />
              </label>
            </div>
          </div>
        ) : entity.key === "product_categories" ? (
          <div className="mt-4 grid gap-4">
            <TextField
              label="Slug *"
              required
              placeholder="mis: ac_split"
              value={String(form.slug ?? "")}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              helper="Unique, lower snake_case"
            />
            <TextField
              label="Nama Kategori *"
              required
              placeholder="mis: AC Split"
              value={String(form.name ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                setForm((prev) => {
                  // auto slug bila slug belum diisi manual atau masih kosong
                  const prevSlug = String(prev.slug ?? "");
                  const next: Record<string, unknown> = { ...prev, name: v };
                  if (!editing && (!prevSlug || toSnakeCase(String(prev.name ?? "")) === prevSlug)) {
                    next.slug = toSnakeCase(v);
                  }
                  return next;
                });
              }}
            />
            <TextField
              label="Suffix Length *"
              type="number"
              required
              value={String(form.suffix_length ?? 5)}
              onChange={(e) => setForm({ ...form, suffix_length: e.target.value })}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {entity.fields
              .filter((f) => !(editing && f.editOnly))
              .map((f) => (
                <TextField
                  key={f.key}
                  label={f.label}
                  type={f.type === "date" ? "date" : f.type === "number" ? "number" : f.type === "password" ? "password" : "text"}
                  required={f.required}
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ))}
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
