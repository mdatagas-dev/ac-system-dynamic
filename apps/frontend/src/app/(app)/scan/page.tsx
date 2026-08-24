"use client";

/**
 * Scan — dinamis per product_category. Auto-scan saat field terakhir terisi / Enter.
 * - product_category diambil dari regist terpilih (regists[].product_category) atau /rdps/scan validation.
 * - Jika ada, fetch GET /components?slug=product_category → enabled+sort → render dinamis.
 * - Fallback ke isOdu (MOTOR/BOX vs PCB/Accessories) bila tidak ada kategori/definisi kosong.
 * - Auto pindah generik via array refs sesuai urutan sort; terakhir auto submit.
 * - POST /rdps/post kirim product_category + field individual + components JSONB.
 * - Popup hijau/merah tetap.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { http } from "@/lib/api";
import { Card } from "@/components/vm3/Card";
import { Dialog } from "@/components/vm3/Dialog";
import { Button } from "@/components/vm3/Button";
import { Select } from "@/components/vm3/Select";
import { useSnackbar } from "@/components/vm3/Snackbar";

interface Regist {
  id: string;
  model: string;
  order_number: string;
  po_number: string;
  subline: string;
  plan: number | null;
  total?: number;
  product_category?: string | null;
  productCategory?: string | null;
  components?: Record<string, unknown> | null;
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

interface ScanResult {
  message?: string;
  brand?: string | null;
  po?: string;
  odf?: string;
  model?: string;
  data?: { id: string; sn: string };
}

interface ScanSummary {
  validation?: Regist & { product_category?: string | null; productCategory?: string | null };
  total?: number;
  last?: { sn?: string; sn_odu?: string } | null;
  bomlist?: unknown[];
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
  const [defs, setDefs] = useState<ComponentDef[]>([]);
  const [defsLoading, setDefsLoading] = useState(false);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const selected = regists.find((r) => r.id === registId) ?? null;
  const isOdu = (selected?.subline ?? "").toUpperCase().includes("ODU");

  const resolvedCategory = useMemo(() => {
    const candidates: unknown[] = [
      (selected as unknown as Record<string, unknown> | null)?.product_category,
      (selected as unknown as Record<string, unknown> | null)?.productCategory,
      (scanSummary?.validation as unknown as Record<string, unknown> | null)?.product_category,
      (scanSummary?.validation as unknown as Record<string, unknown> | null)?.productCategory,
    ];
    for (const c of candidates) {
      if (c == null) continue;
      const s = String(c).trim().toLowerCase();
      if (s) return s;
    }
    return null;
  }, [selected, scanSummary]);

  const enabledDefs = useMemo(() => {
    const list = defs.filter((d) => d.enabled);
    list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.label.localeCompare(b.label));
    return list;
  }, [defs]);

  const hasDynamic = enabledDefs.length > 0;

  const orderedFields = useMemo(() => {
    if (hasDynamic) {
      const snDef = enabledDefs.find((d) => d.key === "sn");
      const snLabel = snDef?.label ?? "Serial Number";
      const snRequired = snDef ? !!snDef.required : true;
      const others = enabledDefs.filter((d) => d.key !== "sn");
      const fields: { key: string; label: string; required: boolean }[] = [
        { key: "sn", label: snLabel, required: snRequired },
      ];
      for (const d of others) fields.push({ key: d.key, label: d.label, required: !!d.required });
      return fields;
    }
    if (isOdu) {
      return [
        { key: "sn", label: "Serial Number", required: true },
        { key: "sn_motor", label: "MOTOR", required: true },
        { key: "sn_box", label: "BOX", required: true },
      ] as const as { key: string; label: string; required: boolean }[];
    }
    return [
      { key: "sn", label: "Serial Number", required: true },
      { key: "pcb_idu", label: "PCB IDU", required: true },
      { key: "sn_accessories", label: "SN Accessories", required: true },
    ] as const as { key: string; label: string; required: boolean }[];
  }, [hasDynamic, enabledDefs, isOdu]);

  // Keep fieldValues keys in sync with orderedFields (generik reset saat kategori berubah)
  useEffect(() => {
    setFieldValues((prev) => {
      const next: Record<string, string> = {};
      for (const f of orderedFields) next[f.key] = prev[f.key] ?? "";
      // also keep legacy hidden keys if they existed (sn_odu/sn_carton) but not in orderedFields → drop them
      return next;
    });
    inputRefs.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedFields.map((f) => f.key).join("|"), hasDynamic]);

  useEffect(() => {
    http
      .get<{ data: Regist[] }>("/registscan?limit=100")
      .then((res) => {
        setRegists(res.data ?? []);
        if (res.data?.length) setRegistId((prev) => prev ?? res.data![0]!.id);
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

  // Fetch component_definitions untuk kategori terdeteksi
  useEffect(() => {
    if (!resolvedCategory) {
      setDefs([]);
      setDefsLoading(false);
      return;
    }
    let cancelled = false;
    setDefsLoading(true);
    http
      .get<{ data: ComponentDef[] }>(`/components?slug=${encodeURIComponent(resolvedCategory)}`)
      .then((res) => {
        if (cancelled) return;
        const list = (res.data ?? []).filter((d) => d.enabled);
        // keep original sort but ensure stable sort already handled in enabledDefs memo; we just store raw
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
  }, [resolvedCategory]);

  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, [registId, hasDynamic, resolvedCategory, defsLoading]);

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
    // validasi dinamis / fallback
    if (hasDynamic) {
      const missing = orderedFields.filter((f) => f.required && !(fieldValues[f.key] ?? "").trim());
      if (missing.length) {
        setPopupType("error");
        setPopupMsg(`Wajib isi: ${missing.map((m) => m.label).join(", ")}`);
        setPopupOpen(true);
        const idx = orderedFields.findIndex((f) => f.required && !(fieldValues[f.key] ?? "").trim());
        if (idx >= 0) inputRefs.current[idx]?.focus();
        return;
      }
    } else {
      if (!(fieldValues.sn ?? "").trim()) {
        setPopupType("error");
        setPopupMsg("SN wajib diisi");
        setPopupOpen(true);
        inputRefs.current[0]?.focus();
        return;
      }
      if (isOdu) {
        if (!(fieldValues.sn_motor ?? "").trim() || !(fieldValues.sn_box ?? "").trim()) {
          setPopupType("error");
          setPopupMsg("MOTOR dan BOX wajib diisi untuk ODU");
          setPopupOpen(true);
          return;
        }
      } else {
        if (!(fieldValues.pcb_idu ?? "").trim() || !(fieldValues.sn_accessories ?? "").trim()) {
          setPopupType("error");
          setPopupMsg("PCB IDU dan SN Accessories wajib diisi untuk IDU");
          setPopupOpen(true);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        id_regist: registId,
        sn: (fieldValues.sn ?? "").trim(),
      };
      const components: Record<string, string> = {};
      for (const f of orderedFields) {
        if (f.key === "sn") continue;
        const v = (fieldValues[f.key] ?? "").trim();
        if (v) {
          payload[f.key] = v;
          components[f.key] = v.toUpperCase();
        }
      }
      // Hidden legacy compat: jika ada sn_odu/sn_carton yang kebetulan masih di fieldValues (tidak dirender dinamis) ikut kirim bila terisi
      for (const k of ["sn_odu", "sn_carton"] as const) {
        const v = (fieldValues as Record<string, string>)[k]?.trim();
        if (v) {
          payload[k] = v;
          // sn_carton tidak wajib, tapi ikut components bila ada
          if (!components[k]) components[k] = v.toUpperCase();
        }
      }
      if (resolvedCategory) {
        payload.product_category = resolvedCategory;
        payload.productCategory = resolvedCategory;
      }
      if (Object.keys(components).length) {
        payload.components = components;
      }
      // Backend juga menerima penyebaran key individual — sudah di payload
      const res = await http.post<ScanResult>("/rdps/post", payload, { extraHeaders: { idregist: registId } });
      const newSn = (res as unknown as { data?: { sn?: string } })?.data?.sn ?? (fieldValues.sn ?? "").trim();
      setLastScan(newSn);
      setCount((c) => c + 1);
      setPopupType("success");
      setPopupMsg((res as unknown as { message?: string })?.message ?? "Scan berhasil");
      setPopupOpen(true);
      // reset semua field sesuai orderedFields
      setFieldValues(() => {
        const next: Record<string, string> = {};
        for (const f of orderedFields) next[f.key] = "";
        // keep hidden compat keys reset juga
        for (const k of ["sn_odu", "sn_carton"] as const) next[k] = "";
        return next;
      });
      setTimeout(() => setPopupOpen(false), 1200);
    } catch (err) {
      setPopupType("error");
      setPopupMsg((err as Error).message || "Scan gagal");
      setPopupOpen(true);
    } finally {
      setLoading(false);
    }
  }, [registId, fieldValues, hasDynamic, isOdu, orderedFields, resolvedCategory, show]);

  // Auto pindah generik: field ke-i terisi (len >=6 untuk i=0, >=4 lainnya) → focus i+1
  useEffect(() => {
    if (loading || popupOpen) return;
    if (!orderedFields.length) return;
    if (defsLoading) return;
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
  }, [fieldValues, orderedFields, loading, popupOpen, defsLoading]);

  // Auto submit generik: semua required terisi + field terakhir >=4 (atau >=6 bila hanya 1 field) → scan()
  useEffect(() => {
    if (loading || popupOpen) return;
    if (!orderedFields.length) return;
    if (defsLoading) return;
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
  }, [fieldValues, orderedFields, loading, popupOpen, defsLoading]);

  return (
    <div className="flex flex-col gap-6">
      {selected && (
        <div className="rounded-xl bg-[#0f1445] p-4 text-white flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold tracking-wide">{selected.model}</div>
            <div className="text-sm opacity-80">PO NUMBER: {selected.po_number}</div>
            {resolvedCategory && (
              <div className="mt-1 text-xs opacity-70">Kategori: {resolvedCategory}{hasDynamic ? ` • ${enabledDefs.length} komponen` : " • fallback"}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{selected.subline}</div>
            <div className="text-xs opacity-80">Plan: {selected.plan ?? "-"} &nbsp; Count: {count}</div>
          </div>
        </div>
      )}

      {!idRegistParam && (
        <div className="max-w-xs">
          <div className="mb-2 text-sm font-medium text-on-surface-variant">Registrasi Aktif</div>
          <Select
            options={regists.map((r) => ({
              value: r.id,
              label: `${r.model} · ${r.order_number} · ${r.subline}`,
            }))}
            value={registId}
            onChange={setRegistId}
            placeholder="Pilih registrasi"
          />
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

          {defsLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">Memuat definisi komponen...</div>
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
            {hasDynamic && resolvedCategory ? ` • ${resolvedCategory}` : ""}
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
            ? "!bg-green-600 !text-white [&_.vm3-dialog-title]:!text-white [&_.vm3-dialog-description]:!text-white/90"
            : "!bg-red-600 !text-white [&_.vm3-dialog-title]:!text-white [&_.vm3-dialog-description]:!text-white/90"
        }
      />
    </div>
  );
}
