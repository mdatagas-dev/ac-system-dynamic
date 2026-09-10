"use client";

/**
 * Scan — universal: field mengikuti BOM rule batch (dari /rdps/scan → bomlist).
 * Auto-scan saat field terakhir terisi / Enter. Popup hijau/merah.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { http } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { bomFields, unitFromSubline } from "@/lib/bom";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { Button } from "@/components/vm3/Button";
import { TextArea } from "@/components/vm3/TextArea";
import { useSnackbar } from "@/components/vm3/Snackbar";
import { toast } from "sonner";

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

// Toast notifikasi scan: hijau sukses / merah gagal, keduanya ada tombol OK utk tutup.
const scanToast = {
  success: (msg: string) => {
    const id = toast.success(msg, {
      duration: 2000,
      classNames: {
        toast: "!bg-success !border-success !text-black !w-[640px] !min-h-14 !text-base",
        title: "!text-black !text-base",
        description: "!text-black/75",
        actionButton: "!bg-white !text-on-surface !text-sm !px-3 !py-1.5",
      },
      action: { label: "OK", onClick: () => toast.dismiss(id) },
    });
  },
  error: (msg: string) => {
    const id = toast.error(msg, {
      duration: 2000,
      classNames: {
        toast: "!bg-error !border-error !text-black !w-[640px] !min-h-14 !text-base",
        title: "!text-black !text-base",
        description: "!text-black/75",
        actionButton: "!bg-white !text-on-surface !text-sm !px-3 !py-1.5",
      },
      action: { label: "OK", onClick: () => toast.dismiss(id) },
    });
  },
};

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
  const router = useRouter();
  const idRegistParam = searchParams.get("idregist");
  const [regists, setRegists] = useState<Regist[]>([]);
  const registId = idRegistParam;
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({ sn: "" });
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [count, setCount] = useState<number>(0);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  // counter kedip merah saat scan gagal — kunci overlay agar animasi jalan ulang
  const [blink, setBlink] = useState(0);

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
    } catch {
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
  const isComplete = selected?.plan != null && count >= selected.plan;

  const orderedFields = useMemo(() => {
    const all = bomFields(scanSummary?.bomlist?.[0]);
    // operator hanya scan field yang diisi saat registrasi batch ini —
    // field kosong di registrasi berarti bukan bagian dari alur line mereka
    const registration = scanSummary?.validation as unknown as Record<string, unknown> | null | undefined;
    return all.filter((field) => String(registration?.[field.key] ?? "").trim() !== "");
  }, [scanSummary?.bomlist, scanSummary?.validation]);

  const fieldKeys = orderedFields.map((field) => field.key).join("|");

  // Keep field values in sync after the server has resolved a different BOM.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFieldValues((prev) => {
        const next: Record<string, string> = {};
        for (const field of orderedFields) next[field.key] = prev[field.key] ?? "";
        return next;
      });
      inputRefs.current = [];
    }, 0);
    return () => clearTimeout(timer);
  }, [fieldKeys, orderedFields]);

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
      const timer = setTimeout(() => {
        setLastScan("");
        setCount(0);
        setScanSummary(null);
      }, 0);
      return () => clearTimeout(timer);
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
    if (selected?.total == null) return;
    const timer = setTimeout(() => setCount(selected.total!), 0);
    return () => clearTimeout(timer);
  }, [selected?.total]);

  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, [registId, fieldKeys]);

  // toast scan selesai (sukses/gagal) -> auto fokus balik ke SN untuk unit berikutnya
  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 150);
    return () => clearTimeout(t);
  }, [lastScan, count]);

  const scan = useCallback(async () => {
    if (!registId) {
      show("Pilih registrasi dulu");
      return;
    }
    if (isComplete) {
      scanToast.error("Batch sudah selesai. Buat registrasi baru untuk melanjutkan produksi.");
      return;
    }
    const missing = orderedFields.filter((f) => f.required && !(fieldValues[f.key] ?? "").trim());
    if (missing.length) {
      scanToast.error(`Wajib isi: ${missing.map((m) => m.label).join(", ")}`);
      const idx = orderedFields.findIndex((f) => f.required && !(fieldValues[f.key] ?? "").trim());
      if (idx >= 0) inputRefs.current[idx]?.focus();
      return;
    }
    // Aturan lama: SN Carton harus sama dengan SN Unit
    const sn = (fieldValues.sn ?? "").trim();
    const carton = (fieldValues.sn_carton ?? "").trim();
    if (sn && carton && carton !== sn) {
      scanToast.error("SN Carton tidak sama dengan SN Unit");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        id_regist: registId,
      };
      for (const f of orderedFields) {
        const v = (fieldValues[f.key] ?? "").trim();
        if (v) payload[f.key] = v;
      }
      const res = await http.post<ScanResult>("/rdps/post", payload, { extraHeaders: { idregist: registId } });
      const newSn = (res as unknown as { data?: { sn?: string } })?.data?.sn ?? (fieldValues.sn ?? "").trim();
      setLastScan(newSn);
      setCount((c) => c + 1);
      scanToast.success((res as unknown as { message?: string })?.message ?? "Scan berhasil");
      failedValuesRef.current = null;
      // reset semua field sesuai orderedFields
      setFieldValues(() => {
        const next: Record<string, string> = {};
        for (const f of orderedFields) next[f.key] = "";
        return next;
      });
    } catch (err) {
      scanToast.error((err as Error).message || "Scan gagal");
      // kedip merah: overlay muncul lalu auto-hilang (animasi blink ~0.8s)
      setBlink((n) => n + 1);
      // catat nilai yang gagal — auto-submit dilarang mengulang scan yang sama persis
      failedValuesRef.current = JSON.stringify(fieldValues);
    } finally {
      setLoading(false);
    }
  }, [registId, fieldValues, isComplete, orderedFields, show]);

  // Auto pindah generik: field ke-i terisi (len >=6 untuk i=0, >=4 lainnya) → focus i+1
  useEffect(() => {
    if (loading) return;
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
  }, [fieldValues, orderedFields, loading]);

  // Auto submit generik: semua required terisi + field terakhir >=4 (atau >=6 bila hanya 1 field) → scan()
  useEffect(() => {
    if (loading) return;
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
  }, [fieldValues, orderedFields, loading]);

  return (
    <div className="flex flex-col gap-6">
      {selected && (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-primary-container p-4 text-on-primary-container">
          <div>
            <div className="text-lg font-bold tracking-wide">{selected.model}</div>
            <div className="text-sm opacity-80">PO NUMBER: {selected.po_number}</div>
            {/* {orderedFields.length > 0 && (
              <div className="mt-1 text-xs opacity-70">BOM: {orderedFields.length} field • {orderedFields.filter((f) => f.required).length} wajib</div>
            )} */}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{selected.subline}</div>
            <div className="text-xs opacity-80">Plan: {selected.plan ?? "-"} &nbsp; Count: {count}</div>
          </div>
          {unitFromSubline(selected.subline) && (
            <span className="rounded-full bg-on-primary-container/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
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

      {isComplete ? (
        <Card variant="outlined" className="mx-auto w-full max-w-[560px] border-success/40 bg-success/10 p-8 text-center">
          <div className="text-lg font-bold text-success">Batch selesai</div>
          <p className="mt-2 text-sm text-on-surface">{count} / {selected?.plan} unit telah discan. Buat registrasi baru bila produksi berikutnya dimulai.</p>
          <Button className="mt-5" onClick={() => router.push("/regist")}>Kembali ke registrasi</Button>
        </Card>
      ) : (
      <Card variant="outlined" className="mx-auto w-full max-w-3xl p-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <div className="w-40 shrink-0 text-base font-medium text-on-surface-variant">Last Scan</div>
            <div className="flex-1">
              <div className="flex h-14 items-center rounded-md border border-outline bg-surface-container-high px-4 text-base text-on-surface-variant">
                {lastScan || "-"}
              </div>
            </div>
          </div>

          {orderedFields.length === 0 ? (
            <div className="py-8 text-center text-sm text-on-surface-variant">BOM rule tidak ditemukan untuk batch ini</div>
          ) : (
            orderedFields.map((f, idx) => (
              <div key={f.key} className="flex items-center gap-4">
                <div className="w-40 shrink-0 text-base font-medium text-on-surface">
                  {f.label}
                  {f.required ? "" : <span className="text-on-surface-variant/60 font-normal"> </span>}
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
                    className="h-14 w-full rounded-md border border-outline bg-card px-4 text-lg text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder=""
                    name={f.key}
                    autoComplete="off"
                    disabled={loading || isComplete}
                  />
                </div>
              </div>
            ))
          )}

          {/* <div className="text-center text-xs text-gray-500 min-h-4">
            Auto pindah saat kolom terisi — tidak perlu Enter • Scan terakhir auto submit
          </div> */}
        </div>
      </Card>
      )}

      {/* Kedip merah layar saat scan gagal — overlay non-interaktif, animasi 0.8s */}
      {blink > 0 && (
        <div
          key={blink}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] animate-[scan-blink_0.8s_ease-out_forwards]"
        />
      )}

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
