"use client";

/**
 * Scan — universal: field mengikuti BOM rule batch (dari /rdps/scan → bomlist).
 * Auto-scan saat field terakhir terisi / Enter. Popup hijau/merah.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { http } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { bomFields, bomFieldsForUnit, unitFromSubline } from "@/lib/bom";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { Button } from "@/components/vm3/Button";
import { Select } from "@/components/vm3/Select";
import { TextArea } from "@/components/vm3/TextArea";
import { useSnackbar } from "@/components/vm3/Snackbar";

interface Regist {
  id: string;
  model: string;
  order_number: string;
  po_number: string;
  subline: string;
  plan: number | null;
  total?: number;
}

interface ScanResult {
  message?: string;
  brand?: string | null;
  po?: string;
  odf?: string;
  model?: string;
  data?: { id: string; sn: string };
}

interface ScanSummary {
  validation?: Regist | null;
  total?: number;
  last?: { sn?: string; sn_odu?: string } | null;
  bomlist?: Array<Record<string, unknown>>;
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanContent />
    </Suspense>
  );
}

function ScanContent() {
  const { show } = useSnackbar();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const idRegistParam = searchParams.get("idregist");
  const [regists, setRegists] = useState<Regist[]>([]);
  const [registId, setRegistId] = useState<string | null>(idRegistParam);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({ sn: "" });
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [count, setCount] = useState<number>(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [popupMsg, setPopupMsg] = useState("");
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  const isSuperuser = user?.roleuser?.toLowerCase() === "superuser";

  const doImport = async () => {
    if (!registId) {
      show("Pilih registrasi dulu");
      return;
    }
    let rows: unknown[];
    try {
      rows = JSON.parse(importText);
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("rows kosong");
    } catch (err) {
      show("Format tidak valid — isi array JSON baris scan: [{sn:\"...\"}, ...]");
      return;
    }
    setImporting(true);
    try {
      const res = await http.post<{ message?: string; created?: number }>("/rdps/import", {
        id_regist: registId,
        rows,
      });
      show(`${res.message ?? "Import selesai"}${res.created != null ? ` (${res.created} baris)` : ""}`);
      setImportOpen(false);
      setImportText("");
      // refresh total
      http
        .get<ScanSummary>("/rdps/scan", { extraHeaders: { idregist: registId } })
        .then((s) => {
          if (typeof s.total === "number") setCount(s.total);
        })
        .catch(() => {
          /* abaikan */
        });
    } catch (err) {
      show(`Import gagal: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // nilai form yang terakhir gagal scan — mencegah auto-submit mengulang scan yang sama
  const failedValuesRef = useRef<string | null>(null);

  const selected = regists.find((r) => r.id === registId) ?? null;

  const orderedFields = useMemo(() => {
    const all = bomFields(scanSummary?.bomlist?.[0]);
    const unit = unitFromSubline(scanSummary?.validation?.subline ?? null);
    const forUnit = bomFieldsForUnit(all, unit);
    // operator hanya scan field yang diisi saat registrasi batch ini —
    // field kosong di registrasi berarti bukan bagian dari alur line mereka
    const regist = scanSummary?.validation as unknown as
      | (Record<string, unknown> & { components?: Record<string, unknown> | null })
      | null
      | undefined;
    const comps = regist?.components && typeof regist.components === "object" ? regist.components : {};
    return forUnit.filter((f) => String(regist?.[f.key] ?? comps[f.key] ?? "").trim() !== "");
  }, [scanSummary?.bomlist, scanSummary?.validation]);

  // Keep fieldValues keys in sync with orderedFields (generik reset saat BOM berubah)
  useEffect(() => {
    setFieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const f of orderedFields) next[f.key] = prev[f.key] ?? "";
      return next;
    });
    inputRefs.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedFields.map((f) => f.key).join("|")]);

  useEffect(() => {
    http
      .get<{ data: Regist[] }>("/registscan?limit=100")
      .then((res) => {
        setRegists(res.data ?? []);
      })
      .catch((err) => show(`Gagal muat registrasi: ${(err as Error).message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!registId) {
      setLastScan("");
      setCount(0);
      setScanSummary(null);
      return;
    }
    http
      .get<ScanSummary>("/rdps/scan", { extraHeaders: { idregist: registId } })
      .then((res) => {
        setScanSummary(res);
        setLastScan(res.last?.sn ?? res.last?.sn_odu ?? "");
        if (typeof res.total === "number") setCount(res.total);
        if (res.validation) {
          setRegists((prev) => prev.map((r) => (r.id === registId ? ({ ...r, ...res.validation } as Regist) : r)));
        }
      })
      .catch(() => {
        setLastScan("");
        setScanSummary(null);
      });
  }, [registId]);

  useEffect(() => {
    if (selected?.total != null) setCount(selected.total);
  }, [selected?.total]);

  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, [registId, orderedFields.map((f) => f.key).join("|")]);

  // tutup popup -> auto fokus balik ke SN untuk unit berikutnya
  useEffect(() => {
    if (!popupOpen) {
      const t = setTimeout(() => inputRefs.current[0]?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [popupOpen]);

  const scan = useCallback(async () => {
    if (!registId) {
      show("Pilih registrasi dulu");
      return;
    }
    const missing = orderedFields.filter((f) => f.required && !(fieldValues[f.key] ?? "").trim());
    if (missing.length) {
      setPopupType("error");
      setPopupMsg(`Wajib isi: ${missing.map((m) => m.label).join(", ")}`);
      setPopupOpen(true);
      const idx = orderedFields.findIndex((f) => f.required && !(fieldValues[f.key] ?? "").trim());
      if (idx >= 0) inputRefs.current[idx]?.focus();
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        id_regist: registId,
      };
      const components: Record<string, string> = {};
      for (const f of orderedFields) {
        const v = (fieldValues[f.key] ?? "").trim();
        if (v) {
          payload[f.key] = v;
          components[f.key] = v.toUpperCase();
        }
      }
      if (Object.keys(components).length) {
        payload.components = components;
      }
      const res = await http.post<ScanResult>("/rdps/post", payload, { extraHeaders: { idregist: registId } });
      const newSn = (res as unknown as { data?: { sn?: string } })?.data?.sn ?? (fieldValues.sn ?? "").trim();
      setLastScan(newSn);
      setCount((c) => c + 1);
      setPopupType("success");
      setPopupMsg((res as unknown as { message?: string })?.message ?? "Scan berhasil");
      setPopupOpen(true);
      failedValuesRef.current = null;
      // reset semua field sesuai orderedFields
      setFieldValues(() => {
        const next: Record<string, string> = {};
        for (const f of orderedFields) next[f.key] = "";
        return next;
      });
      setTimeout(() => setPopupOpen(false), 1200);
    } catch (err) {
      setPopupType("error");
      setPopupMsg((err as Error).message || "Scan gagal");
      setPopupOpen(true);
      // catat nilai yang gagal — auto-submit dilarang mengulang scan yang sama persis
      failedValuesRef.current = JSON.stringify(fieldValues);
    } finally {
      setLoading(false);
    }
  }, [registId, fieldValues, orderedFields, show]);

  // Auto pindah generik: field ke-i terisi (len >=6 untuk i=0, >=4 lainnya) → focus i+1
  useEffect(() => {
    if (loading || popupOpen) return;
    if (!orderedFields.length) return;
    for (let i = 0; i < orderedFields.length - 1; i++) {
      const curKey = orderedFields[i]!.key;
      const nextKey = orderedFields[i + 1]!.key;
      const curVal = (fieldValues[curKey] ?? "").trim();
      const nextVal = (fieldValues[nextKey] ?? "").trim();
      const threshold = i === 0 ? 6 : 4;
      if (curVal.length >= threshold && nextVal === "") {
        let prevFilled = true;
        for (let k = 0; k <= i; k++) {
          if (!(fieldValues[orderedFields[k]!.key] ?? "").trim()) {
            prevFilled = false;
            break;
          }
        }
        if (!prevFilled) continue;
        const t = setTimeout(() => inputRefs.current[i + 1]?.focus(), 280);
        return () => clearTimeout(t);
      }
    }
  }, [fieldValues, orderedFields, loading, popupOpen]);

  // Auto submit generik: semua required terisi + field terakhir >=4 (atau >=6 bila hanya 1 field) → scan()
  useEffect(() => {
    if (loading || popupOpen) return;
    if (!orderedFields.length) return;
    // jangan kirim ulang nilai yang barusan gagal — tunggu operator mengubah input
    if (failedValuesRef.current && JSON.stringify(fieldValues) === failedValuesRef.current) return;
    const allRequiredFilled = orderedFields.every((f) => !f.required || (fieldValues[f.key] ?? "").trim().length > 0);
    if (!allRequiredFilled) return;
    const lastIdx = orderedFields.length - 1;
    const lastKey = orderedFields[lastIdx]!.key;
    const lastVal = (fieldValues[lastKey] ?? "").trim();
    const thLast = orderedFields.length === 1 ? 6 : 4;
    if (lastVal.length < thLast) return;
    for (let i = 0; i < orderedFields.length; i++) {
      const f = orderedFields[i]!;
      if (!f.required) continue;
      const v = (fieldValues[f.key] ?? "").trim();
      const th = i === 0 ? 6 : 4;
      if (v.length < th) return;
    }
    const t = setTimeout(() => {
      void scan();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValues, orderedFields, loading, popupOpen]);

  return (
    <div className="flex flex-col gap-6">
      {selected && (
        <div className="rounded-xl bg-[#0f1445] p-4 text-white flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold tracking-wide">{selected.model}</div>
            <div className="text-sm opacity-80">PO NUMBER: {selected.po_number}</div>
            {orderedFields.length > 0 && (
              <div className="mt-1 text-xs opacity-70">BOM: {orderedFields.length} field • {orderedFields.filter((f) => f.required).length} wajib</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{selected.subline}</div>
            <div className="text-xs opacity-80">Plan: {selected.plan ?? "-"} &nbsp; Count: {count}</div>
          </div>
          {unitFromSubline(selected.subline) && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Unit: {unitFromSubline(selected.subline)}
            </span>
          )}
        </div>
      )}

      {isSuperuser && (
        <div className="flex justify-end">
          <Button icon="upload" variant="outlined" onClick={() => setImportOpen(true)}>
            Import Scan
          </Button>
        </div>
      )}

      <Card variant="outlined" className="mx-auto w-full max-w-[560px] !bg-white p-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="w-32 shrink-0 text-sm text-gray-700">Last Scan</div>
            <div className="flex-1">
              <div className="h-11 flex items-center rounded-md bg-gray-100 px-3 text-sm text-gray-600 border border-gray-200">
                {lastScan || "-"}
              </div>
            </div>
          </div>

          {orderedFields.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">BOM rule tidak ditemukan untuk batch ini</div>
          ) : (
            orderedFields.map((f, idx) => (
              <div key={f.key} className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm text-gray-900">
                  {f.label}
                  {f.required ? "" : <span className="text-gray-400 font-normal"> </span>}
                </div>
                <div className="flex-1">
                  <input
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    aria-label={f.label}
                    value={fieldValues[f.key] ?? ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (idx < orderedFields.length - 1) inputRefs.current[idx + 1]?.focus();
                        else void scan();
                      }
                    }}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    placeholder=""
                    autoComplete="off"
                    disabled={loading}
                  />
                </div>
              </div>
            ))
          )}

          <div className="text-center text-xs text-gray-500 min-h-4">
            Auto pindah saat kolom terisi — tidak perlu Enter • Scan terakhir auto submit
          </div>
        </div>
      </Card>

      {/* Popup hijau/merah auto — tanpa tombol submit */}
      <Dialog
        open={popupOpen}
        onOpenChange={setPopupOpen}
        title={popupType === "success" ? "Scan Berhasil" : "Scan Gagal"}
        description={popupMsg}
        actions={
          popupType === "error" ? (
            <Button onClick={() => setPopupOpen(false)} className={popupType === "error" ? "!bg-red-600 hover:!bg-red-700 !text-white" : ""}>
              OK
            </Button>
          ) : null
        }
        className={
          popupType === "success"
            ? "[&_[data-slot=dialog-overlay]]:bg-black/50 [&_[data-slot=dialog-content]]:bg-green-600 [&_[data-slot=dialog-content]]:text-white [&_[data-slot=dialog-title]]:text-white [&_[data-slot=dialog-description]]:text-white/90"
            : "[&_[data-slot=dialog-overlay]]:bg-black/50 [&_[data-slot=dialog-content]]:bg-red-600 [&_[data-slot=dialog-content]]:text-white [&_[data-slot=dialog-title]]:text-white [&_[data-slot=dialog-description]]:text-white/90"
        }
      />

      {/* Import scan massal (superuser) */}
      <Dialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Scan"
        description={`Baris scan untuk registrasi: ${selected?.model ?? ""} (${selected?.order_number ?? "-"}) — divalidasi BOM, ` + "admin only."}
        actions={
          <>
            <Button variant="text" onClick={() => setImportOpen(false)}>Batal</Button>
            <Button onClick={() => void doImport()} loading={importing}>Import</Button>
          </>
        }
      >
        <TextArea
          className="mt-4 w-full"
          label="Baris scan (JSON array)"
          rows={10}
          placeholder='[{"sn":"AC1001"},{"sn":"AC1002","sn_motor":"MTR01"}]'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
      </Dialog>
    </div>
  );
}
