"use client";

/**
 * Master Data — CRUD Model, Line, BOM, Users, PIN (satu halaman, tab).
 */
import { useCallback, useEffect, useState } from "react";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { IconButton } from "@/components/vm3/IconButton";
import { TextField } from "@/components/vm3/TextField";
import { Card } from "@/components/vm3/Card";
import { Tabs } from "@/components/vm3/Navigation";
import { Dialog } from "@/components/vm3/Dialog";
import { useSnackbar } from "@/components/vm3/Snackbar";

/* ---------- Definisi entitas ---------- */
interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "password" | "date";
  required?: boolean;
  /** opsional untuk edit */
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
    getList: () => http.get<{ data: [] }>("/model?limit=100").then((r) => r.data ?? []),
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
    getList: () => http.get<{ data: [] }>("/line").then((r) => r.data ?? []),
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
    getList: () => http.get<{ data: [] }>("/bomlist?limit=100").then((r) => r.data ?? []),
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
      { key: "password", label: "Password", type: "password", required: true, editOnly: false },
      { key: "email", label: "Email", required: true },
      { key: "roleuser", label: "Role" },
      { key: "departement", label: "Departemen" },
      { key: "section", label: "Section" },
    ],
    rowKey: (r) => String(r.id),
    getList: () => http.get<{ data: [] }>("/users?limit=100").then((r) => r.data ?? []),
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
    getList: () => http.get<{ data: [] }>("/pin").then((r) => r.data ?? []),
    create: (d) => http.post("/pin/post", d),
    update: () => Promise.reject(new Error("Edit PIN belum didukung backend")),
    remove: (id) => http.del(`/pin/delete/${id}`),
  },
];

const EMPTY_FORM: Record<string, unknown> = {};

export default function MasterPage() {
  const { show } = useSnackbar();
  const [tab, setTab] = useState("model");
  const entity = ENTITIES.find((e) => e.key === tab)!;
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm({});
    setDialogOpen(true);
  };
  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    const next: Record<string, unknown> = {};
    for (const f of entity.fields) next[f.key] = row[f.key] ?? "";
    setForm(next);
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await entity.update(entity.rowKey(editing), form);
        show(`${entity.label} diperbarui`);
      } else {
        await entity.create(form);
        show(`${entity.label} ditambahkan`);
      }
      setDialogOpen(false);
      load();
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
    } catch (err) {
      show(`Gagal hapus: ${(err as Error).message}`);
    }
  };

  const canCreate = entity.create !== undefined;
  const canEdit = entity.update !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Master Data</h1>
      <Tabs
        tabs={ENTITIES.map((e) => ({ value: e.key, label: e.label }))}
        value={tab}
        onChange={(v) => setTab(v)}
      />

      <div className="flex justify-end">
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
                  <th key={f.key} className="p-3">{f.label}</th>
                ))}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={entity.rowKey(row)} className="border-b border-outline-variant last:border-0">
                  {entity.fields.map((f) => (
                    <td key={f.key} className="p-3">
                      {f.type === "password" ? "••••••" : String(row[f.key] ?? "-")}
                    </td>
                  ))}
                  <td className="p-1 text-right">
                    {canEdit && (
                      <IconButton icon="edit" label="Edit" onClick={() => openEdit(row)} />
                    )}
                    <IconButton icon="delete" label="Hapus" onClick={() => setDeleteId(entity.rowKey(row))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <div className="p-8 text-center text-on-surface-variant">Belum ada data</div>
          )}
        </div>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? `Edit ${entity.label}` : `Tambah ${entity.label}`}
        actions={
          <>
            <Button variant="text" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} loading={saving}>Simpan</Button>
          </>
        }
      >
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
                onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? e.target.value : e.target.value })}
              />
            ))}
        </div>
      </Dialog>

      <Dialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={`Hapus ${entity.label}`}
        description="Data akan dihapus permanen. Lanjutkan?"
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
