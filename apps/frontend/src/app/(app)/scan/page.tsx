"use client";

/**
 * Scan — pilih registrasi (header idregist), scan SN via /rdps/post.
 * Replikasi legacy Image 1: header Model/PO/Line/Plan/Count + Last Scan field.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { http } from "@/lib/api";
import { Button } from "@/components/vm3/Button";
import { TextField } from "@/components/vm3/TextField";
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
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [snFocused, setSnFocused] = useState(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [count, setCount] = useState<number>(0);

  const selected = regists.find((r) => r.id === registId) ?? null;

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

  // Fetch Last Scan + Count untuk header kayak legacy Image 1
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
        // Sinkron plan/total dari validation jika ada
        if (res.validation) {
          setRegists((prev) => prev.map((r) => r.id === registId ? { ...r, ...res.validation } : r));
        }
      })
      .catch(() => {
        // fallback: hitung dari history atau diam
        setLastScan("");
      });
  }, [registId]);

  // Fallback count dari total di regists
  useEffect(() => {
    if (selected?.total != null) setCount(selected.total);
  }, [selected?.total]);

  const scan = async () => {
    if (!registId) return show("Pilih registrasi dulu");
    if (!sn.trim()) return show("SN wajib diisi");
    setLoading(true);
    setResult(null);
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
      setResult(res);
      show("Scan berhasil disimpan");
      const newSn = res.data?.sn ?? sn.trim();
      setLastScan(newSn);
      setCount((c) => c + 1);
      setSn("");
      setSnOdu("");
      setSnMotor("");
      setSnBox("");
      setPcb("");
      setSnCarton("");
      setSnAcc("");
      setSnFocused(true);
    } catch (err) {
      show(`Scan ditolak: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Scan Unit</h1>

      {/* Header legacy Image 1: Model (ODU) | PO | Line | Plan/Count */}
      {selected && (
        <Card variant="filled" className="p-4 bg-[#0f1445] text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold tracking-wide">{selected.model}</div>
              <div className="text-sm opacity-80">PO NUMBER: {selected.po_number}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{selected.subline}</div>
              <div className="text-xs opacity-80">Plan: {selected.plan ?? "-"}</div>
              <div className="text-xs opacity-80">Count: {count}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form scan */}
        <Card variant="elevated" className="p-5">
          <div className="mb-4">
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

          <div className="flex flex-col gap-4">
            {/* Last Scan — replikasi Image 1 */}
            <TextField label="Last Scan" value={lastScan} disabled placeholder="-" />

            <TextField
              label="Serial Number"
              icon="qr_code_scanner"
              value={sn}
              onChange={(e) => setSn(e.target.value)}
              autoFocus={snFocused}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  scan();
                }
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Serial Number ODU" value={snOdu} onChange={(e) => setSnOdu(e.target.value)} />
              <TextField label="SN Motor" value={snMotor} onChange={(e) => setSnMotor(e.target.value)} />
              <TextField label="SN Box" value={snBox} onChange={(e) => setSnBox(e.target.value)} />
              <TextField label="PCB IDU" value={pcb} onChange={(e) => setPcb(e.target.value)} />
              <TextField label="SN Carton" value={snCarton} onChange={(e) => setSnCarton(e.target.value)} />
              <TextField label="SN Accessories" value={snAcc} onChange={(e) => setSnAcc(e.target.value)} />
            </div>
            <Button onClick={scan} loading={loading} fullWidth>
              submit
            </Button>
          </div>
        </Card>

        {/* Hasil scan */}
        <Card variant="outlined" className="p-5">
          <div className="mb-4 text-lg font-semibold">Hasil Scan</div>
          {result ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between border-b border-outline-variant pb-2">
                <span className="text-on-surface-variant">Status</span>
                <span className="font-medium text-primary">{result.message ?? "Berhasil"}</span>
              </div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Model</span><span>{result.model}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Brand</span><span>{result.brand ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">PO</span><span>{result.po}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Order</span><span>{result.odf}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">SN</span><span className="font-mono">{result.data?.sn}</span></div>
            </div>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center text-on-surface-variant">
              Belum ada scan — isi SN lalu simpan.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
