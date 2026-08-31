/**
 * Mock data cerita — model AN05CDG, line indoor (IDU), plan 100,
 * produksi berjalan 5 jam (07.00–12.00): 96 unit dari SUPH 20/jam.
 * Hanya dipakai bila NEXT_PUBLIC_MOCK=1.
 */

export const MODEL = "AN05CDG";
export const BRAND = "SHARP";
export const ORDER = "ORD-260823";
export const PO = "PO-2608001";

export const SUB_ASSY = "LINE IDU ASSY OUTPUT";
export const SUB_TEST = "LINE IDU TESTING OUTPUT";
export const SUB_PACK = "LINE IDU PACKING INPUT";

/** Produksi per jam 07–11 per tahap; sisanya 0 */
export const BATCH_ASSY = [17, 19, 20, 21, 19]; // 96
export const BATCH_TEST = [14, 16, 15, 15]; // 60
export const BATCH_PACK = [4, 5, 3]; // 12
export const TOTAL_ALL = [...BATCH_ASSY, ...BATCH_TEST, ...BATCH_PACK].reduce((a, b) => a + b, 0);
export const SUPH = "20";
/** Siklus jam penuh seperti backend (validUph) */
export const UPH_TIMES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 1, 2, 3, 4, 5, 6];

const pad = (n: number, len = 4) => String(n).padStart(len, "0");

export interface MockRegist {
  id: string;
  model: string;
  order_number: string;
  po_number: string;
  subline: string;
  shift: string;
  plan: number;
  userid: string;
  timestamps: string;
}

export interface MockRecord {
  id: string;
  id_regist: string;
  sn: string;
  sn_odu: string | null;
  sn_motor: string | null;
  sn_box: string | null;
  pcb_idu: string | null;
  sn_carton: string | null;
  sn_accessories: string | null;
  timestamps: string;
}

function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h % 24, m, 0, 0);
  return d.toISOString();
}

export const SEED_REGISTS: MockRegist[] = [
  { id: "rg-001", model: MODEL, order_number: ORDER, po_number: PO, subline: SUB_ASSY, shift: "1", plan: 100, userid: "operator.idu", timestamps: todayAt(7, 2) },
  { id: "rg-002", model: MODEL, order_number: ORDER, po_number: PO, subline: SUB_TEST, shift: "1", plan: 100, userid: "operator.test", timestamps: todayAt(7, 15) },
  { id: "rg-003", model: MODEL, order_number: "ORD-260824", po_number: "PO-2608002", subline: SUB_PACK, shift: "1", plan: 80, userid: "operator.pack", timestamps: todayAt(8, 0) },
];

function seedRecords(): MockRecord[] {
  const out: MockRecord[] = [];
  let seq = 1;
  const pushBatch = (idRegist: string, counts: number[]) => {
    counts.forEach((count, i) => {
      for (let k = 1; k <= count; k++) {
        const n = seq++;
        out.push({
          id: `rc-${pad(n, 5)}`,
          id_regist: idRegist,
          sn: `${MODEL}-${pad(i * 60 + k + 300)}`,
          sn_odu: `ODU-4B00-${pad((n * 13) % 10000)}`,
          sn_motor: `MTR-4A00-${pad((n * 7) % 10000)}`,
          sn_box: `BOX-B${pad((n * 3) % 10000)}`,
          pcb_idu: `PCB-IDU-${pad((n * 11) % 100000, 5)}`,
          sn_carton: idRegist === "rg-003" ? `CTN-C${pad((n * 5) % 10000)}` : null,
          sn_accessories: null,
          timestamps: todayAt(7 + i, (k * 57) % 60),
        });
      }
    });
  };
  pushBatch("rg-001", BATCH_ASSY); // assy: 96 (5 jam)
  pushBatch("rg-002", BATCH_TEST); // testing: 60
  pushBatch("rg-003", BATCH_PACK); // packing: 12
  return out.sort((a, b) => b.timestamps.localeCompare(a.timestamps));
}

export const SEED_RECORDS: MockRecord[] = seedRecords();

export const SEED_MASTER: Record<string, Record<string, unknown>[]> = {
  model: [
    { id: "md-1", brand: BRAND, model: MODEL, pk: 0.5, linkimage: "" },
    { id: "md-2", brand: BRAND, model: "AN09CDG", pk: 0.9, linkimage: "" },
    { id: "md-3", brand: BRAND, model: "AN12CDG", pk: 1.2, linkimage: "" },
  ],
  line: [
    { id: "ln-1", line: SUB_ASSY },
    { id: "ln-2", line: SUB_TEST },
    { id: "ln-3", line: SUB_PACK },
    { id: "ln-4", line: "LINE ODU ASSY OUTPUT" },
  ],
  bomlist: [
    { id: "bm-1", model: MODEL, order_number: ORDER },
    { id: "bm-2", model: MODEL, order_number: "ORD-260824" },
    { id: "bm-3", model: "AN09CDG", order_number: "ORD-260901" },
  ],
  users: [
    { id: "us-1", username: "supervisor.qa", password: "", email: "supervisor@ac.local", roleuser: "superuser", departement: "QA", section: "INDOOR" },
    { id: "us-2", username: "operator.idu", password: "", email: "idu@ac.local", roleuser: "operator", departement: "PRODUCTION", section: "INDOOR" },
    { id: "us-3", username: "operator.pack", password: "", email: "pack@ac.local", roleuser: "operator", departement: "PRODUCTION", section: "PACKING" },
  ],
  pin: [
    { id: "pn-today", date: new Date().toISOString().slice(0, 10), pin: 4821 },
    { id: "pn-yesterday", date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), pin: 1350 },
  ],
  "product-categories": [
    { id: "pc-1", slug: "ac_split", name: "AC Split" },
    { id: "pc-2", slug: "ac_window", name: "AC Window" },
    { id: "pc-3", slug: "ac_commercial", name: "AC Commercial (HVAC)" },
    { id: "pc-4", slug: "ac_portable", name: "AC Portable" },
    { id: "pc-5", slug: "washing", name: "Mesin Cuci" },
  ],
};
