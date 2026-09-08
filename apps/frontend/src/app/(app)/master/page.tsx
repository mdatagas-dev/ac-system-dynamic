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
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/lib/auth";

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
      { key: "product_category", label: "Kategori" },
      // Kolom prefix material (paritas dengan tabel bomlist lama) — nilai
      // diambil dari row.fields[] karena rule baru disimpan di tabel typed.
      { key: "sn", label: "SN Unit" },
      { key: "sn_carton", label: "SN Carton" },
      { key: "pcb_idu", label: "PCB IDU" },
      { key: "pcb_odu", label: "PCB ODU" },
      { key: "sn_motor", label: "SN Motor" },
      { key: "sn_accessories", label: "SN Accessories" },
      { key: "sn_drum", label: "SN Drum" },
      { key: "sn_pump", label: "SN Pump" },
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

const BOM_FIELDS = {
  ac: [
    { key: "sn", label: "Serial Number", scope: "IDU & ODU" },
    { key: "sn_carton", label: "SN Carton", scope: "IDU & ODU" },
    { key: "sn_accessories", label: "SN Accessories", scope: "IDU" },
    { key: "pcb_idu", label: "PCB IDU", scope: "IDU" },
    { key: "pcb_odu", label: "PCB ODU", scope: "ODU" },
    { key: "sn_motor", label: "SN Motor", scope: "ODU" },
  ],
  wm: [
    { key: "sn", label: "Serial Number", scope: "Washing Machine" },
    { key: "sn_drum", label: "SN Drum", scope: "Washing Machine" },
    { key: "sn_pump", label: "SN Pump", scope: "Washing Machine" },
  ],
} as const;

type ProductCategoryRow = Record<string, unknown> & { id: string; slug: string; name: string; suffix_length?: number };
// Kolom tabel BOM yang isinya prefix material dari row.fields[] (bukan kolom row)
const BOM_PREFIX_KEYS = new Set(["sn", "sn_carton", "pcb_idu", "pcb_odu", "sn_motor", "sn_accessories", "sn_drum", "sn_pump"]);
function bomPrefixOf(row: Record<string, unknown>, key: string): string {
  const meta = Array.isArray(row.fields) ? (row.fields as Array<Record<string, unknown>>) : [];
  const hit = meta.find((f) => String(f.key ?? "") === key);
  if (!hit) return "-";
  const prefix = String(hit.prefix ?? "").trim();
  return prefix ? (hit.required === true ? `${prefix} *` : prefix) : "-";
}


export default function MasterPage() {
  const { show } = useSnackbar();
  const { user, initializing } = useAuth();
  const router = useRouter();
  const isSuperuser = user?.roleuser?.toLowerCase() === "superuser";

  useEffect(() => {
    if (!initializing && (!user || !isSuperuser)) router.replace("/regist");
  }, [initializing, user, isSuperuser, router]);

  const [tab, setTab] = useState("model");
  const entity = useMemo(() => ENTITIES.find((e) => e.key === tab) ?? ENTITIES[0], [tab]);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(EMPTY_FORM);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Kategori (root hierarki) — untuk combobox model + filter
  const [categories, setCategories] = useState<ProductCategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Model master — category determines the typed BOM fields shown in this form.
  const [models, setModels] = useState<string[]>([]);
  const [modelCategories, setModelCategories] = useState<Record<string, string>>({});
  useEffect(() => {
    if (tab !== "bomlist") return;
    let cancelled = false;
    http
      .get<{ data: Record<string, unknown>[] }>("/model?limit=100")
      .then((r) => {
        if (cancelled) return;
        const rows = (r.data ?? []) as Record<string, unknown>[];
        setModels(rows.map((m) => String(m.model ?? "")).filter(Boolean));
        setModelCategories(Object.fromEntries(rows.map((m) => {
          const category = String(m.product_category ?? "").toLowerCase();
          return [String(m.model ?? ""), category === "ai" || category === "an" ? "ac" : category === "washing" ? "wm" : category];
        })));
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
      if (entity.key === "bomlist") {
        // prefix material baru disimpan di row.fields[], ikutkan dalam pencarian
        const meta = Array.isArray(row.fields) ? (row.fields as Array<Record<string, unknown>>) : [];
        if (meta.some((f) => String(f.prefix ?? "").toLowerCase().includes(q))) return true;
      }
      return entity.fields.some((f) =>
        String(row[f.key] ?? "").toLowerCase().includes(q),
      );
    });
  }, [rows, search, categoryFilter, entity]);

  const openCreate = () => {
    setEditing(null);
    if (entity.key === "product_categories") {
      setForm({ slug: "", name: "" });
    } else if (entity.key === "model") {
      setForm({ category_id: "" });
    } else {
      setForm({});
    }
    setDialogOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    if (entity.key === "product_categories") {
      setForm({ slug: String(row.slug ?? ""), name: String(row.name ?? "") });
    } else if (entity.key === "bomlist") {
      const next: Record<string, unknown> = {
        model: row.model ?? "",
        order_number: row.order_number ?? "",
      };
      const fieldMetadata = Array.isArray(row.fields) ? row.fields as Array<Record<string, unknown>> : [];
      for (const field of fieldMetadata) {
        const key = String(field.key ?? "");
        if (!key) continue;
        next[key] = field.prefix ?? "";
        next[`${key}_required`] = field.required === true;
      }
      setForm(next);
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
      }
      if (entity.key === "bomlist") {
        const category = selectedBomCategory;
        if (!category || !(category in BOM_FIELDS)) throw new Error("Pilih model dengan kategori AC atau Washing Machine");
        const allowed = new Set<string>(BOM_FIELDS[category as keyof typeof BOM_FIELDS].map((field) => field.key));
        for (const key of Object.keys(payload)) {
          if (key !== "model" && key !== "order_number" && key !== "product_category" && !allowed.has(key.replace(/_required$/, ""))) {
            delete payload[key];
          }
        }
        for (const key of allowed) {
          const prefix = String(payload[key] ?? "").trim();
          payload[key] = prefix;
          payload[`${key}_required`] = prefix !== "" && payload[`${key}_required`] === true;
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

  // filter dropdown pakai slug sebagai value: baris model & bomlist membawa
  // product_category sebagai slug (lihat header komentar di atas).
  const categoryFilterOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.slug), label: `${String(c.name)} (${String(c.slug)})` })),
    [categories],
  );


  const selectedBomCategory = entity.key === "bomlist" ? modelCategories[String(form.model ?? "")] : undefined;
  const bomFields = selectedBomCategory && selectedBomCategory in BOM_FIELDS
    ? BOM_FIELDS[selectedBomCategory as keyof typeof BOM_FIELDS]
    : [];

  // Judul dialog
  const dialogTitle = editing ? `Edit ${entity.label}` : `Tambah ${entity.label}`;

  if (initializing || !user || !isSuperuser) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-on-surface-variant">Memeriksa akses…</div>;
  }

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
                        : entity.key === "bomlist" && BOM_PREFIX_KEYS.has(f.key)
                          ? bomPrefixOf(row, f.key)
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
        className={entity.key === "bomlist" ? "sm:!max-w-4xl" : undefined}
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
        {entity.key === "bomlist" ? (
          <div className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Combobox
                label="Model"
                options={models}
                value={String(form.model ?? "")}
                onChange={(value) => setForm((current) => ({ ...current, model: value }))}
                placeholder="Ketik untuk mencari model"
              />
              <TextField
                label="Order Number"
                required
                value={String(form.order_number ?? "")}
                onChange={(event) => setForm((current) => ({ ...current, order_number: event.target.value }))}
              />
            </div>
            {selectedBomCategory ? (
              <>
                <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                  Kategori model: <strong className="text-on-surface">{selectedBomCategory === "ac" ? "Air Conditioner" : "Washing Machine"}</strong>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <h2 className="text-sm font-semibold text-on-surface sm:col-span-2">Material dan aturan registrasi</h2>
                  {bomFields.map((field) => {
                    const prefix = String(form[field.key] ?? "");
                    const requiredKey = `${field.key}_required`;
                    return (
                      <div key={field.key} className="grid gap-2 rounded-lg border border-outline-variant p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <TextField
                          label={`${field.label} · ${field.scope}`}
                          value={prefix}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                            ...(event.target.value.trim() ? {} : { [requiredKey]: false }),
                          }))}
                          placeholder="Prefix material (opsional)"
                        />
                        <label className="flex h-11 items-center gap-2 text-sm text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={form[requiredKey] === true}
                            disabled={!prefix.trim()}
                            onChange={(event) => setForm((current) => ({ ...current, [requiredKey]: event.target.checked }))}
                            className="size-4 accent-primary disabled:cursor-not-allowed"
                          />
                          Wajib diisi
                        </label>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">Pilih model untuk menampilkan field material sesuai kategori.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {entity.fields
            .filter((f) => !(editing && f.editOnly))
            .map((f) =>
              entity.key === "model" && f.key === "category_id" ? (
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
