"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { http } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/vm3/Button";
import { Card } from "@/components/vm3/Card";
import { IconButton } from "@/components/vm3/IconButton";
import { Select } from "@/components/vm3/Select";
import { TextField } from "@/components/vm3/TextField";
import { useSnackbar } from "@/components/vm3/Snackbar";

type Model = { id: string; model: string; brand?: string | null; category?: { name?: string | null; slug?: string | null } | null };
type Process = { id: string; code: string; name: string };
type RouteStep = {
  id?: string;
  code: string;
  name: string;
  sequence: number;
  process_id: string;
  process?: Process | null;
  line_id: string | null;
  line_master?: { id: string; line: string | null } | null;
  is_required: boolean;
  requires_main_serial: boolean;
};
type Draft = Omit<RouteStep, "id" | "sequence" | "process">;

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  process_id: "",
  line_id: "",
  is_required: true,
  requires_main_serial: true,
};

export default function ProductionRoutesPage() {
  const { user, initializing } = useAuth();
  const { show } = useSnackbar();
  const router = useRouter();
  const isSuperuser = user?.roleuser?.toLowerCase() === "superuser";
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [lines, setLines] = useState<Array<{ id: string; line: string | null }>>([]);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initializing && (!user || !isSuperuser)) router.replace("/regist");
  }, [initializing, user, isSuperuser, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      http
        .get<{ data: Model[] }>("/model?limit=100")
        .then((response) => {
          const list = response.data ?? [];
          setModels(list);
          setModelId((current) => current ?? list[0]?.id ?? null);
        })
        .catch((error) => show(`Gagal memuat model: ${(error as Error).message}`))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [show]);

  useEffect(() => {
    if (!modelId) {
      const timer = setTimeout(() => {
        setSteps([]);
        setProcesses([]);
      }, 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      http
      .get<{ data: { model: { route_templates: RouteStep[] }; processes: Process[]; lines: Array<{ id: string; line: string | null }> } }>(
          `/model-route-templates?model_id=${encodeURIComponent(modelId)}`,
        )
        .then((response) => {
          if (cancelled) return;
        setSteps(response.data.model.route_templates ?? []);
        setProcesses(response.data.processes ?? []);
        setLines(response.data.lines ?? []);
          setEditingIndex(null);
          setDraft(EMPTY_DRAFT);
        })
        .catch((error) => {
          if (!cancelled) show(`Gagal memuat route template: ${(error as Error).message}`);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [modelId, show]);

  const selectedModel = models.find((model) => model.id === modelId);
  const processOptions = useMemo(
    () => processes.map((process) => ({ value: process.id, label: `${process.name} (${process.code})` })),
    [processes],
  );

  const editStep = (index: number) => {
    const step = steps[index];
    if (!step) return;
    setEditingIndex(index);
    setDraft({
      code: step.code,
      name: step.name,
      process_id: step.process_id,
      line_id: step.line_id ?? "",
      is_required: step.is_required,
      requires_main_serial: step.requires_main_serial,
    });
  };

  const resetDraft = () => {
    setEditingIndex(null);
    setDraft(EMPTY_DRAFT);
  };

  const applyDraft = () => {
    const code = draft.code.trim().toLowerCase();
    const name = draft.name.trim();
    if (!code || !name || !draft.process_id || !draft.line_id) {
      show("Code, nama, process, dan Line wajib diisi");
      return;
    }
    if (steps.some((step, index) => step.code === code && index !== editingIndex)) {
      show("Code route tidak boleh duplikat");
      return;
    }
    const next = { ...draft, code, name, sequence: editingIndex == null ? steps.length + 1 : steps[editingIndex].sequence };
    setSteps((current) => editingIndex == null
      ? [...current, next]
      : current.map((step, index) => (index === editingIndex ? { ...step, ...next } : step)));
    resetDraft();
  };

  const removeStep = (index: number) => {
    setSteps((current) => current.filter((_, currentIndex) => currentIndex !== index));
    if (editingIndex === index) resetDraft();
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (!modelId || steps.length === 0) {
      show("Minimal satu route step wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await http.put(`/model-route-templates/${modelId}`, {
        steps: steps.map((step, index) => ({
          code: step.code,
          name: step.name,
          process_id: step.process_id,
          line_id: step.line_id,
          sequence: index + 1,
          is_required: step.is_required,
          requires_main_serial: step.requires_main_serial,
        })),
      });
      show("Production route template disimpan");
      const response = await http.get<{ data: { model: { route_templates: RouteStep[] }; processes: Process[]; lines: Array<{ id: string; line: string | null }> } }>(
        `/model-route-templates?model_id=${encodeURIComponent(modelId)}`,
      );
      setSteps(response.data.model.route_templates ?? []);
      setProcesses(response.data.processes ?? []);
      setLines(response.data.lines ?? []);
    } catch (error) {
      show(`Gagal menyimpan route template: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  if (initializing || !user || !isSuperuser) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-on-surface-variant">Memeriksa akses…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IconButton icon="arrow_back" label="Kembali ke Master Data" onClick={() => router.push("/master")} />
        <div>
          <h1 className="text-2xl font-bold">Production Route Template</h1>
          <p className="text-sm text-on-surface-variant">Perubahan berlaku untuk BOM List baru. Route snapshot lama tidak diubah.</p>
        </div>
      </div>

      <Card variant="outlined" className="p-5">
        <div className="max-w-xl">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Model</label>
          <Select
            options={models.map((model) => ({ value: model.id, label: `${model.model}${model.category?.name ? ` · ${model.category.name}` : ""}` }))}
            value={modelId}
            onChange={setModelId}
            placeholder={loading ? "Memuat model…" : "Pilih model"}
            disabled={loading || models.length === 0}
            aria-label="Model"
          />
        </div>
      </Card>

      {selectedModel && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{selectedModel.model}</h2>
            <p className="text-sm text-on-surface-variant">{steps.length} route step terdaftar</p>
          </div>
          <Button onClick={save} loading={saving} disabled={loading || steps.length === 0}>Simpan Perubahan</Button>
        </div>
      )}

      <Card variant="outlined" className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Ordered Route Steps</h2>
            <p className="text-xs text-on-surface-variant">Urutan menentukan progression scan pada Production Unit.</p>
          </div>
        </div>
        <ol className="grid gap-3">
          {steps.map((step, index) => (
            <li key={step.id ?? step.code} className="rounded-lg border border-outline-variant p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-on-surface">{step.name}</h3>
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">{step.code}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{step.process?.name ?? processes.find((process) => process.id === step.process_id)?.name ?? step.process_id}</p>
                  <p className="text-sm text-on-surface-variant">Line: {step.line_master?.line ?? lines.find((line) => line.id === step.line_id)?.line ?? "Belum ditetapkan"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                    <span>{step.is_required ? "Required" : "Optional"}</span>
                    <span>•</span>
                    <span>{step.requires_main_serial ? "Main serial required" : "Component only"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton icon="arrow_upward" label="Naikkan" onClick={() => moveStep(index, -1)} disabled={index === 0} />
                  <IconButton icon="arrow_downward" label="Turunkan" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} />
                  <IconButton icon="edit" label="Edit" onClick={() => editStep(index)} />
                  <IconButton icon="delete" label="Hapus" onClick={() => removeStep(index)} />
                </div>
              </div>
            </li>
          ))}
          {steps.length === 0 && <li className="rounded-lg border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">Belum ada route step.</li>}
        </ol>
      </Card>

      <Card variant="outlined" className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{editingIndex == null ? "Tambah Route Step" : "Edit Route Step"}</h2>
            <p className="text-xs text-on-surface-variant">Code harus stabil karena dipakai sebagai identitas route.</p>
          </div>
          {editingIndex != null && <Button variant="text" onClick={resetDraft}>Batal Edit</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Code" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} placeholder="idu-testing-input" />
          <TextField label="Nama Route" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="LINE IDU TESTING INPUT" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Process</label>
            <Select options={processOptions} value={draft.process_id || null} onChange={(value) => setDraft((current) => ({ ...current, process_id: value ?? "" }))} placeholder="Pilih process" disabled={processes.length === 0} aria-label="Process" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Line</label>
            <Select options={lines.flatMap((line) => line.line ? [{ value: line.id, label: line.line }] : [])} value={draft.line_id || null} onChange={(value) => setDraft((current) => ({ ...current, line_id: value ?? "" }))} placeholder="Pilih Line" disabled={lines.length === 0} aria-label="Line" />
          </div>
          <div className="flex flex-col justify-end gap-3 pb-1 sm:col-span-2 sm:flex-row sm:justify-start">
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" checked={draft.is_required} onChange={(event) => setDraft((current) => ({ ...current, is_required: event.target.checked }))} className="size-4 accent-primary" />
              Required step
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" checked={draft.requires_main_serial} onChange={(event) => setDraft((current) => ({ ...current, requires_main_serial: event.target.checked }))} className="size-4 accent-primary" />
              Requires main serial
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={applyDraft}>{editingIndex == null ? "Tambah Step" : "Terapkan Perubahan"}</Button>
        </div>
      </Card>
    </div>
  );
}
