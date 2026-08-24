"use client";

/**
 * Scan — pilih registrasi (header idregist), scan SN via /rdps/post.
 * Fokus legacy: form tengah sempit, hanya 3 field (SN/MOTOR/BOX untuk ODU), Last Scan di atas, submit biru kanan, auto-focus berurutan.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { Card } from "@/components/vm3/Card";
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

  const snRef = useRef<HTMLInputElement>(null);
  const motorRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus pertama kali masuk window scan (kaya legacy langsung cursor di SN)
  useEffect(() => {
    const t = setTimeout(() => snRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [registId]);

  const scan = async () => {
    if (!registId) return show("Pilih registrasi dulu");
    if (!sn.trim()) {
      show("SN wajib diisi");
      snRef.current?.focus();
      return;
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
      show("Scan berhasil disimpan");
      const newSn = (res as unknown as { data?: { sn?: string } })?.data?.sn ?? sn.trim();
      setLastScan(newSn);
      setCount((c) => c + 1);
      setSn("");
      setSnOdu("");
      setSnMotor("");
      setSnBox("");
      setPcb("");
      setSnCarton("");
      setSnAcc("");
      // auto balik ke SN untuk unit berikutnya
      setTimeout(() => snRef.current?.focus(), 100);
    } catch (err) {
      show(`Scan ditolak: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header legacy — biru dongker */}
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

      {/* Pilih registrasi hanya tampil kalau tidak datang dari drill */}
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

      {/* Form tengah fokus — replikasi Image 2 legacy */}
      <Card variant="outlined" className="mx-auto w-full max-w-[560px] !bg-white p-8">
        <div className="flex flex-col gap-6">
          {/* Last Scan */}
          <div className="flex items-center gap-4">
            <div className="w-32 shrink-0 text-sm text-gray-700">Last Scan</div>
            <div className="flex-1">
              <div className="h-11 flex items-center rounded-md bg-gray-100 px-3 text-sm text-gray-600 border border-gray-200">
                {lastScan || "-"}
              </div>
            </div>
          </div>

          {/* Serial Number */}
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
                    else snRef.current?.blur();
                  }
                }}
                className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                placeholder=""
                autoComplete="off"
              />
            </div>
          </div>

          {/* Field dinamis: ODU = MOTOR/BOX, IDU = PCB/Accessories */}
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
                    value={pcb}
                    onChange={(e) => setPcb(e.target.value)}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 shrink-0 text-sm text-gray-900">SN Accessories</div>
                <div className="flex-1">
                  <input
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
                  />
                </div>
              </div>
            </>
          )}

          {/* Hidden fields tetap dikirim tapi tidak ditampilkan di mode fokus */}
          <input type="hidden" value={snOdu} readOnly />
          <input type="hidden" value={snCarton} readOnly />

          <div className="flex justify-end pt-2">
            <Button
              onClick={scan}
              loading={loading}
              className="!bg-[#2381c7] hover:!bg-[#1c6aa6] !text-white !rounded-md px-8"
            >
              submit
            </Button>
          </div>

          {/* Feedback kecil di bawah form, bukan panel kanan besar */}
          <div className="text-center text-xs text-gray-500 min-h-4">
            Tekan Enter di BOX untuk submit • Auto fokus kembali ke Serial Number setelah sukses
          </div>
        </div>
      </Card>
    </div>
  );
}
