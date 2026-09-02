/**
 * Mock API — AKTIF hanya bila NEXT_PUBLIC_MOCK=1 (lihat lib/api.ts).
 * State CRUD hidup di memori module (reset saat reload) — tidak menyentuh DB.
 */
import {
  BATCH_ASSY, BATCH_PACK, BATCH_TEST, MODEL, SEED_MASTER, SEED_RECORDS,
  SEED_REGISTS, SUB_ASSY, SUB_PACK, SUB_TEST, SUPH, UPH_TIMES,
  type MockRecord, type MockRegist,
} from "./mock-data";

export const MOCK_ENABLED = process.env.NEXT_PUBLIC_MOCK === "1";

const MOCK_USER = { id: "us-2", username: "operator", roleuser: "superuser", depart: "PRODUCTION", section: "INDOOR" };

let REGISTS: MockRegist[] = structuredClone(SEED_REGISTS);
let RECORDS: MockRecord[] = structuredClone(SEED_RECORDS);
const MASTER: Record<string, Record<string, unknown>[]> = structuredClone(SEED_MASTER);
let nextId = 1000;
const uid = () => `m${nextId++}`;

class MockError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function dashboard(keyword: string) {
  const kw = keyword.trim().toUpperCase();
  const sublines = [SUB_ASSY, SUB_TEST, SUB_PACK];
  if (kw && !MODEL.toUpperCase().includes(kw) && !sublines.some((s) => s.includes(kw)) && kw !== "INDOOR") {
    return { data: [], subline: [] };
  }
  // agregasi semua tahap per jam (seperti backend yang join semua subline)
  const hourly = UPH_TIMES.map((_, i) =>
    (BATCH_ASSY[i] ?? 0) + (BATCH_TEST[i] ?? 0) + (BATCH_PACK[i] ?? 0),
  );
  return {
    data: [{
      model: MODEL,
      suph: SUPH,
      total: hourly.reduce((a, b) => a + b, 0), // 168 unit hari ini
      uph: UPH_TIMES.map((time, i) => ({ time, record: String(hourly[i]) })),
    }],
    subline: sublines.map((s) => ({ subline: s })),
  };
}

function totalPoScan(url: URL) {
  const rows = [
    { model: MODEL, order_number: "ORD-260823", po_number: "PO-2608001", subline: SUB_ASSY, countsubline: BATCH_ASSY.reduce((a, b) => a + b, 0) },
    { model: MODEL, order_number: "ORD-260823", po_number: "PO-2608001", subline: SUB_TEST, countsubline: BATCH_TEST.reduce((a, b) => a + b, 0) },
    { model: MODEL, order_number: "ORD-260824", po_number: "PO-2608002", subline: SUB_PACK, countsubline: BATCH_PACK.reduce((a, b) => a + b, 0) },
  ];
  const limit = Number(url.searchParams.get("limit") ?? 10) || 10;
  return { data: rows, total: rows.length, currentPages: 1, totalPages: Math.max(1, Math.ceil(rows.length / limit)) };
}

/**
 * Return payload bila path cocok; undefined bila tidak ditangani
 * (pemanggil lanjut ke fetch asli).
 */
export function mockRequest(
  path: string,
  method: string,
  body: unknown,
  headers?: Record<string, string>,
): unknown | undefined {
  const url = new URL(path, "http://mock.local");
  const p = url.pathname;
  const m = method.toUpperCase();
  const b = (body ?? {}) as Record<string, unknown>;

  /* ---- Auth (session) ---- */
  if (p === "/auth/login" && m === "POST") {
    const username = String(b.username ?? "").trim();
    if (!username || !b.password) throw new MockError("Username atau password salah", 401);
    if (String(b.password) !== "admin") throw new MockError("Username atau password salah", 401);
    return { message: "login successful", user: MOCK_USER };
  }
  if (p === "/auth/logout" && m === "POST") {
    return { message: "logout successful" };
  }
  if (p === "/auth/me" && m === "GET") {
    return { user: MOCK_USER };
  }

  /* ---- Scan summary (header Last Scan) ---- */
  if (p === "/rdps/scan" && m === "GET") {
    const idRegist = headers?.idregist ?? "";
    const reg = REGISTS.find((r) => r.id === idRegist) ?? null;
    const list = RECORDS.filter((r) => r.id_regist === idRegist);
    return { validation: reg, total: list.length, last: list[0] ?? null, bomlist: [] };
  }

  /* ---- Dashboard ---- */
  if (p === "/rdps/dashboard" && m === "GET") return dashboard(url.searchParams.get("keyword") ?? "");
  if (p === "/rdps/total-po-scan" && m === "GET") return totalPoScan(url);

  /* ---- Registscan ---- */
  if (p === "/registscan" && m === "GET") {
    return {
      data: REGISTS.map((r) => ({
        ...r,
        total: RECORDS.filter((x) => x.id_regist === r.id).length,
      })),
    };
  }
  if (p === "/registscan/post" && m === "POST") {
    for (const k of ["model", "order_number", "po_number", "subline"] as const) {
      if (!String(b[k] ?? "").trim()) throw new MockError("Harap isi semua field");
    }
    const row: MockRegist = {
      id: uid(),
      model: String(b.model).trim(),
      order_number: String(b.order_number).trim(),
      po_number: String(b.po_number).trim(),
      subline: String(b.subline).trim(),
      shift: String(b.shift ?? "1"),
      plan: Number(b.plan ?? 0),
      userid: String(b.userid ?? ""),
      timestamps: new Date().toISOString(),
    };
    REGISTS.unshift(row);
    return { message: "Data Added Successfully", result: row };
  }
  let mm = /^\/registscan\/delete\/([^/]+)$/.exec(p);
  if (mm && m === "DELETE") {
    REGISTS = REGISTS.filter((r) => r.id !== mm![1]);
    RECORDS = RECORDS.filter((r) => r.id_regist !== mm![1]);
    return { message: "Deleted Successfully" };
  }

  /* ---- Scan ---- */
  if (p === "/rdps/post" && m === "POST") {
    const regist = REGISTS.find((r) => r.id === String(b.id_regist ?? ""));
    if (!regist) throw new MockError("Registrasi tidak ditemukan", 404);
    const sn = String(b.sn ?? "").trim().toUpperCase();
    if (!sn) throw new MockError("SN wajib diisi");
    if (/[%$#@!%*^]/.test(sn)) throw new MockError("SN mengandung karakter tidak valid");
    if (RECORDS.some((r) => r.sn === sn)) throw new MockError(`Double scan sn: ${sn}`);
    const rec: MockRecord = {
      id: uid(),
      id_regist: regist.id,
      sn,
      sn_odu: String(b.sn_odu ?? "").trim() || null,
      sn_motor: String(b.sn_motor ?? "").trim() || null,
      sn_box: String(b.sn_box ?? "").trim() || null,
      pcb_idu: String(b.pcb_idu ?? "").trim() || null,
      sn_carton: String(b.sn_carton ?? "").trim() || null,
      sn_accessories: String(b.sn_accessories ?? "").trim() || null,
      timestamps: new Date().toISOString(),
    };
    RECORDS.unshift(rec);
    return {
      message: "Data Added Successfully",
      brand: "SHARP",
      po: regist.po_number,
      odf: regist.order_number,
      model: regist.model,
      data: { id: rec.id, sn: rec.sn },
    };
  }

  /* ---- Riwayat (idregist via header) ---- */
  if (p === "/rdps/history" && m === "GET") {
    const idRegist = headers?.idregist ?? "";
    const keyword = (url.searchParams.get("keyword") ?? "").toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Number(url.searchParams.get("limit") ?? 20) || 20;
    let rows = RECORDS.filter((r) => !idRegist || r.id_regist === idRegist);
    if (keyword) {
      rows = rows.filter((r) =>
        [r.sn, r.sn_motor, r.sn_box, r.pcb_idu, r.sn_carton, r.sn_accessories]
          .some((v) => v?.toLowerCase().includes(keyword)),
      );
    }
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      validation: REGISTS.find((r) => r.id === idRegist) ?? null,
      currentPages: page,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    };
  }
  mm = /^\/rdps\/delete\/([^/]+)$/.exec(p);
  if (mm && m === "DELETE") {
    RECORDS = RECORDS.filter((r) => r.id !== mm![1]);
    return { message: "Deleted Succesfully" };
  }

  /* ---- Product Categories (mock) ---- */
  if (p === "/product-categories" && m === "GET") return { data: MASTER["product-categories"] };
  if (p === "/product-categories/post" && m === "POST") {
    const slug = String(b.slug ?? "").trim().toLowerCase();
    const name = String(b.name ?? "").trim();
    if (!slug || !name) throw new MockError("slug dan name wajib");
    if (MASTER["product-categories"].some((r) => String(r.slug).toLowerCase() === slug)) throw new MockError("Kategori sudah ada");
    const row = { id: uid(), slug, name };
    MASTER["product-categories"].unshift(row);
    return { message: "Created", data: row };
  }
  mm = /^\/product-categories\/edit\/([^/]+)$/.exec(p);
  if (mm && m === "PUT") {
    const row = MASTER["product-categories"].find((r) => String(r.id) === mm![1]);
    if (!row) throw new MockError("Kategori tidak ditemukan", 404);
    if (b.slug) row.slug = String(b.slug).trim().toLowerCase();
    if (b.name) row.name = String(b.name).trim();
    return { message: "Updated", data: row };
  }
  mm = /^\/product-categories\/delete\/([^/]+)$/.exec(p);
  if (mm && m === "DELETE") {
    MASTER["product-categories"] = MASTER["product-categories"].filter((r) => String(r.id) !== mm![1]);
    return { message: "Deleted", data: {} };
  }

  /* ---- Master CRUD generik ---- */
  const MASTER_DELETE: Record<string, RegExp> = {
    model: /^\/model\/delete\/([^/]+)$/,
    line: /^\/line\/([^/]+)$/,
    bomlist: /^\/bomlist\/delete\/([^/]+)$/,
    users: /^\/users\/delete\/([^/]+)$/,
    pin: /^\/pin\/delete\/([^/]+)$/,
  };
  for (const key of Object.keys(MASTER)) {
    if (key === "product-categories" || key === "components") continue;
    if (p === `/${key}` && m === "GET") return { data: MASTER[key] };
    if (p === `/${key}/post` && m === "POST") {
      MASTER[key].unshift({ id: uid(), ...b });
      return { message: "success" };
    }
    mm = new RegExp(`^\\/${key}\\/(?:edit|update)\\/([^/]+)$`).exec(p);
    if (mm && m === "PUT") {
      const row = MASTER[key].find((r) => r.id === mm![2]);
      if (row) Object.assign(row, b);
      return { message: "Updated success" };
    }
    mm = MASTER_DELETE[key]?.exec(p);
    if (mm && m === "DELETE") {
      MASTER[key] = MASTER[key].filter((r) => r.id !== mm![1]);
      return { message: "delete successful" };
    }
  }
  if (p === "/pin/compare" && m === "POST") {
    const today = new Date().toISOString().slice(0, 10);
    const row = MASTER.pin.find((r) => r.date === today);
    if (row && Number(row.pin) === Number(b.pin)) return true;
    throw new MockError("Pin tidak sesuai");
  }
  if (p === "/rgscan/checkregist" && m === "GET") return { data: [] };

  return undefined; // tidak ditangani → fetch asli
}
