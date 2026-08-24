"use client";

/**
 * Scan — fokus legacy tanpa tombol submit. Auto-scan saat field terakhir di-Enter.
 * Popup hijau (pass) / merah (fail) sebagai feedback.
 */
import { Suspense, useEffect, useRef, useState } from "react";
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
  validation?: Regist;
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
  const [sn, setSn] = useState("");
  const [snOdu, setSnOdu] = useState("");
  const [snMotor, setSnMotor] = useState("");
  const [snBox, setSnBox] = useState("");
  const [pcb, setPcb] = useState("");
  const [snCarton, setSnCarton] = useState("");
  const [snAcc, setSnAcc] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [count, setCount] = useState<number>(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [popupMsg, setPopupMsg] = useState("");

  const snRef = useRef<HTMLInputElement>(null);
  const motorRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLInputElement>(null);
  const pcbRef = useRef<HTMLInputElement>(null);
  const accRef = useRef<HTMLInputElement>(null);

  const selected = regists.find((r) => r.id === registId) ?? null;
  const isOdu = (selected?.subline ?? "").toUpperCase().includes("ODU");

  useEffect(() => {
    http
      .get<{ data: Regist[] }>("/registscan?limit=100")
      .then((res) => {
        setRegists(res.data ?? []);
        if (res.data?.length) setRegistId((prev) => prev ?? res.data![0].id);
      })
      .catch((err) => show(`Gagal muat registrasi: ${(err as Error).message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!registId) {
      setLastScan("");
      setCount(0);
      return;
    }
    http
      .get<ScanSummary>("/rdps/scan", { extraHeaders: { idregist: registId } })
      .then((res) => {
        setLastScan(res.last?.sn ?? res.last?.sn_odu ?? "");
        if (typeof res.total === "number") setCount(res.total);
        if (res.validation) {
          setRegists((prev) => prev.map((r) => (r.id === registId ? { ...r, ...res.validation } : r)));
        }
      })
      .catch(() => setLastScan(""));
  }, [registId]);

  useEffect(() => {
    if (selected?.total != null) setCount(selected.total);
  }, [selected?.total]);

  useEffect(() => {
    const t = setTimeout(() => snRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [registId]);

  // tutup popup -> auto fokus balik ke SN untuk unit berikutnya
  useEffect(() => {
    if (!popupOpen) {
      const t = setTimeout(() => snRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [popupOpen]);

  const scan = async () => {
    if (!registId) {
      show("Pilih registrasi dulu");
      return;
    }
    if (!sn.trim()) {
      setPopupType("error");
      setPopupMsg("SN wajib diisi");
      setPopupOpen(true);
      snRef.current?.focus();
      return;
    }
    // ODU wajib: MOTOR & BOX; IDU wajib: PCB & Accessories
    if (isOdu) {
      if (!snMotor.trim() || !snBox.trim()) {
        setPopupType("error");
        setPopupMsg("MOTOR dan BOX wajib diisi untuk ODU");
        setPopupOpen(true);
        return;
      }
    } else {
      if (!pcb.trim() || !snAcc.trim()) {
        setPopupType("error");
        setPopupMsg("PCB IDU dan SN Accessories wajib diisi untuk IDU");
        setPopupOpen(true);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await http.post<ScanResult>(
        "/rdps/post",
        {
          id_regist: registId,
          sn: sn.trim(),
          sn_odu: snOdu.trim(),
          sn_motor: snMotor.trim(),
          sn_box: snBox.trim(),
          pcb_idu: pcb.trim(),
          sn_carton: snCarton.trim(),
          sn_accessories: snAcc.trim(),
        },
        { extraHeaders: { idregist: registId } },
      );
      const newSn = (res as unknown as { data?: { sn?: string } })?.data?.sn ?? sn.trim();
      setLastScan(newSn);
      setCount((c) => c + 1);
      setPopupType("success");
      setPopupMsg((res as unknown as { message?: string })?.message ?? "Scan berhasil");
      setPopupOpen(true);
      setSn("");
      setSnOdu("");
      setSnMotor("");
      setSnBox("");
      setPcb("");
      setSnCarton("");
      setSnAcc("");
      // auto-close hijau setelah 1.2s
      setTimeout(() => setPopupOpen(false), 1200);
    } catch (err) {
      setPopupType("error");
      setPopupMsg((err as Error).message || "Scan gagal");
      setPopupOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {selected && (
        <div className="rounded-xl bg-[#0f1445] p-4 text-white flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold tracking-wide">{selected.model}</div>
            <div className="text-sm opacity-80">PO NUMBER: {selected.po_number}</div>
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

          <div className="flex items-center gap-4">
            <div className="w-32 shrink-0 text-sm text-gray-900">Serial Number</div>
            <div className="flex-1">
              <input
                ref={snRef}
                value={sn}
                onChange={(e) => setSn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (isOdu) motorRef.current?.focus();
                    else pcbRef.current?.focus();
                  }
                }}
                className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                placeholder=""
                autoComplete="off"
                disabled={loading}
              />
            </div>
          </div>

          {isOdu ? (
            <>
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm text-gray-900">MOTOR</div>
                <div className="flex-1">
                  <input
                    ref={motorRef}
                    value={snMotor}
                    onChange={(e) => setSnMotor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        boxRef.current?.focus();
                      }
                    }}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    autoComplete="off"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm text-gray-900">BOX</div>
                <div className="flex-1">
                  <input
                    ref={boxRef}
                    value={snBox}
                    onChange={(e) => setSnBox(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        scan();
                      }
                    }}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    autoComplete="off"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm text-gray-900">PCB IDU</div>
                <div className="flex-1">
                  <input
                    ref={pcbRef}
                    value={pcb}
                    onChange={(e) => setPcb(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        accRef.current?.focus();
                      }
                    }}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    autoComplete="off"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm text-gray-900">SN Accessories</div>
                <div className="flex-1">
                  <input
                    ref={accRef}
                    value={snAcc}
                    onChange={(e) => setSnAcc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        scan();
                      }
                    }}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    autoComplete="off"
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <input type="hidden" value={snOdu} readOnly />
          <input type="hidden" value={snCarton} readOnly />

          <div className="text-center text-xs text-gray-500 min-h-4">
            Scan SN → Enter → {isOdu ? "MOTOR → Enter → BOX → Enter" : "PCB → Enter → Accessories → Enter"} = auto submit (tanpa tombol)
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
