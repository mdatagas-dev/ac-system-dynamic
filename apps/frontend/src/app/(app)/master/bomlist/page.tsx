"use client";

/**
 * BOM List (Production Order) — halaman tersendiri, bukan dialog.
 * Create/edit memakai form satu halaman penuh: identitas order + component
 * requirements dari template model + preview production route.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { IconButton } from "@/components/vm3/IconButton";
import { TextField } from "@/components/vm3/TextField";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { Select } from "@/components/vm3/Select";
import { Combobox } from "@/components/vm3/Combobox";
import { useSnackbar } from "@/components/vm3/Snackbar";
import { useAuth } from "@/lib/auth";

type BomComponent = { key: string; label: string; prefix: string; required: boolean };
type RouteStep = {
  id: string;
  code: string;
  name: string;
  sequence: number;
  is_required: boolean;
  requires_main_serial: boolean;
  process?: { code: string; name: string } | null;
};
type BomTemplate = {
  model_id: string;
  model: string;
  product_category: string;
  category_name: string | null;
  fields: BomComponent[];
  route_steps: RouteStep[];
};
type BomRow = Record<string, unknown> & { id: string };

const EMPTY_FORM: Record<string, unknown> = {
  model: "",
  order_number: "",
  po_number: "",
  order_quantity: "",
};

export default function BomListPage() {
  const { show } = useSnackbar();
  const { user, initializing } = useAuth();
  const router = useRouter();
  const isSuperuser = user?.roleuser?.toLowerCase() === "superuser";

  useEffect(() => {
    if (!initializing && (!user || !isSuperuser)) router.replace("/regist");
  }, [initializing, user, isSuperuser, router]);

  const [rows, setRows] = useState<BomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<Record<string, unknown>>>([]);

  // Form satu halaman: null = daftar, object = form (create atau edit)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BomRow | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [models, setModels] = useState<string[]>([]);
  const [bomTemplate, setBomTemplate] = useState<BomTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get<{ data: Record<string, unknown>[] }>("/bomlist?limit=100");
      setRows((res.data ?? []) as BomRow[]);
    } catch (err) {
      show(`Gagal memuat BOM List: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      http.get<{ data: Record<string, unknown>[] }>("/model?limit=100")
        .then((r) => setModels(((r.data ?? []) as Record<string, unknown>[]).map((m) => String(m.model ?? "")).filter(Boolean)))
        .catch(() => setModels([]));
      http.get<{ data: Record<string, unknown>[] }>("/product-categories")
        .then((r) => setCategories(r.data ?? []))
        .catch(() => setCategories([]));
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Template komponen + route dari model — prefill prefix saat create.
  useEffect(() => {
    const model = String(form.model ?? "").trim();
    let cancelled = false;
    const t = setTimeout(() => {
      if (!formOpen || !model) {
        setBomTemplate(null);
        setTemplateError("");
        return;
      }
      setTemplateLoading(true);
      setTemplateError("");
      http
        .get<{ data: BomTemplate }>(`/bomlist/template?model=${encodeURIComponent(model)}`)
        .then((response) => {
          if (cancelled) return;
          setBomTemplate(response.data);
          if (!editing) {
            setForm((current) => {
              const next = { ...current };
              for (const field of response.data.fields) {
                next[field.key] = field.prefix;
                next[`${field.key}_required`] = field.required;
              }
              return next;
            });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setBomTemplate(null);
            setTemplateError((error as Error).message);
          }
        })
        .finally(() => {
          if (!cancelled) setTemplateLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [formOpen, editing, form.model]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter && String(row.product_category ?? row.category_slug ?? "") !== categoryFilter) return false;
      if (!q) return true;
      const meta = Array.isArray(row.fields) ? (row.fields as Array<Record<string, unknown>>) : [];
      if (meta.some((f) => String(f.prefix ?? "").toLowerCase().includes(q))) return true;
      return ["model", "order_number", "po_number", "order_status"].some((key) =>
        String(row[key] ?? "").toLowerCase().includes(q),
      );
    });
  }, [rows, search, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (row: BomRow) => {
    setEditing(row);
    const next: Record<string, unknown> = {
      model: row.model ?? "",
      order_number: row.order_number ?? "",
      po_number: row.po_number ?? "",
      order_quantity: row.order_quantity ?? "",
    };
    const fieldMetadata = Array.isArray(row.fields) ? (row.fields as Array<Record<string, unknown>>) : [];
    for (const field of fieldMetadata) {
      const key = String(field.key ?? "");
      if (!key) continue;
      next[key] = field.prefix ?? "";
      next[`${key}_required`] = field.required === true;
    }
    setForm(next);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setBomTemplate(null);
    setTemplateError("");
  };

  const save = async () => {
    if (!bomTemplate) {
      show("Template komponen dan route model belum tersedia");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      const allowed = new Set<string>(bomTemplate.fields.map((field) => field.key));
      for (const key of Object.keys(payload)) {
        if (
          !["model", "order_number", "po_number", "order_quantity"].includes(key) &&
          !allowed.has(key.replace(/_required$/, ""))
        ) {
          delete payload[key];
        }
      }
      for (const key of allowed) {
        const prefix = String(payload[key] ?? "").trim();
        payload[key] = prefix;
        payload[`${key}_required`] = prefix !== "" && payload[`${key}_required`] === true;
      }
      if (editing) {
        await http.put(`/bomlist/edit/${editing.id}`, payload);
        show("BOM List diperbarui");
      } else {
        await http.post("/bomlist/post", payload);
        show("BOM List ditambahkan");
      }
      closeForm();
      void load();
    } catch (err) {
      show(`Gagal simpan: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await http.del(`/bomlist/delete/${deleteId}`);
      show("BOM List diarsipkan");
      setDeleteId(null);
      void load();
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
    }
  };

  if (initializing || !user || !isSuperuser) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-on-surface-variant">Memeriksa akses…</div>;
  }

  if (formOpen) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <IconButton icon="arrow_back" label="Kembali ke daftar" onClick={closeForm} />
          <h1 className="text-2xl font-bold">{editing ? "Edit BOM List" : "BOM List Baru"}</h1>
        </div>

        <Card variant="outlined" className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {editing ? (
              <TextField label="Model" value={String(form.model ?? "")} readOnly />
            ) : (
              <Combobox
                label="Model"
                options={models}
                value={String(form.model ?? "")}
                onChange={(value) => setForm((current) => ({ ...current, model: value }))}
                placeholder="Ketik untuk mencari model"
              />
            )}
            <TextField
              label="Order Number"
              required
              value={String(form.order_number ?? "")}
              onChange={(event) => setForm((current) => ({ ...current, order_number: event.target.value }))}
            />
            <TextField
              label="PO Number"
              value={String(form.po_number ?? "")}
              onChange={(event) => setForm((current) => ({ ...current, po_number: event.target.value }))}
            />
            <TextField
              label="Order Quantity"
              type="number"
              required
              min={1}
              value={String(form.order_quantity ?? "")}
              onChange={(event) => setForm((current) => ({ ...current, order_quantity: event.target.value }))}
            />
          </div>
        </Card>

        {templateLoading ? (
          <Card variant="outlined" className="p-5 text-sm text-on-surface-variant">Memuat template model…</Card>
        ) : templateError ? (
          <Card variant="outlined" className="border-error/40 bg-error-container/40 p-5 text-sm text-on-error-container">{templateError}</Card>
        ) : bomTemplate ? (
          <>
            <Card variant="outlined" className="p-5">
              <p className="mb-4 rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                Kategori model: <strong className="text-on-surface">{bomTemplate.category_name ?? bomTemplate.product_category.toUpperCase()}</strong>
              </p>
              <h2 className="mb-3 text-sm font-semibold text-on-surface">Component Requirements</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {bomTemplate.fields.map((field) => {
                  const prefix = String(form[field.key] ?? "");
                  const requiredKey = `${field.key}_required`;
                  return (
                    <div key={field.key} className="grid gap-2 rounded-lg border border-outline-variant p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <TextField
                        label={field.label}
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
            </Card>
            <Card variant="outlined" className="p-5">
              <h2 className="text-sm font-semibold text-on-surface">Production Route</h2>
              <p className="mb-3 text-xs text-on-surface-variant">Route disalin dari template model saat BOM List dibuat.</p>
              <ol className="grid gap-2">
                {(editing && Array.isArray(editing.route_steps)
                  ? editing.route_steps as RouteStep[]
                  : bomTemplate.route_steps
                ).map((step) => (
                  <li key={step.id} className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {step.sequence}. {step.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">{step.process?.name ?? step.code}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${step.requires_main_serial ? "bg-primary-container text-on-primary-container" : "bg-tertiary-container text-on-tertiary-container"}`}>
                      {step.requires_main_serial ? "Main SN required" : "Component only"}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </>
        ) : (
          <Card variant="outlined" className="p-5 text-sm text-on-surface-variant">Pilih model untuk menampilkan component requirements dan production route.</Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="text" onClick={closeForm}>Batal</Button>
          <Button onClick={save} loading={saving} disabled={!bomTemplate}>Simpan</Button>
        </div>
      </div>
    );
  }

  const categoryFilterOptions = categories.map((c) => ({ value: String(c.slug), label: `${String(c.name)} (${String(c.slug)})` }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">BOM List</h1>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Cari"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari order / PO / prefix…"
            className="w-64"
          />
          <div className="w-56">
            <label className="mb-1.5 block text-sm font-medium text-foreground">Kategori</label>
            <Select
              options={[{ value: "", label: "Semua kategori" }, ...categoryFilterOptions]}
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v)}
              placeholder="Semua kategori"
            />
          </div>
        </div>
        <Button icon="add" onClick={openCreate}>Tambah BOM List</Button>
      </div>

      <Card variant="outlined" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                <th className="p-3">Model</th>
                <th className="p-3">Order Number</th>
                <th className="p-3">PO Number</th>
                <th className="p-3">Order Quantity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Components</th>
                <th className="p-3 text-center">Route Steps</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-outline-variant last:border-0">
                  <td className="p-3 font-medium whitespace-nowrap">{String(row.model ?? "-")}</td>
                  <td className="p-3">{String(row.order_number ?? "-")}</td>
                  <td className="p-3">{String(row.po_number ?? "-")}</td>
                  <td className="p-3">{String(row.order_quantity ?? "-")}</td>
                  <td className="p-3">{String(row.order_status ?? "-")}</td>
                  <td className="p-3 text-center">{Array.isArray(row.fields) ? row.fields.length : 0}</td>
                  <td className="p-3 text-center">{Array.isArray(row.route_steps) ? row.route_steps.length : 0}</td>
                  <td className="p-1 text-right whitespace-nowrap">
                    <IconButton icon="edit" label="Edit" onClick={() => openEdit(row)} />
                    <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(row.id)} />
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
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus BOM List"
        description="BOM List akan diarsipkan dan tidak dapat dipakai untuk registrasi baru. Lanjutkan?"
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
