/* Integration test suite: semua endpoint backend (dummy data + cleanup). */
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { api, token, track, waitForServer, cleanupAll, uniq } = require("../test-helpers");
let bomlistId, modelId, lineId, pinId, userId, registId, recordId;
const TODAY = new Date().toISOString().split("T")[0];
const MODEL_SHORT = "TDD-" + uniq;        // bomlist.model
const MODEL_FULL = MODEL_SHORT + "12345"; // registscan.model, slice(-5) -> MODEL_SHORT
const ORDER = "ORD-" + uniq;
const SN = "SN-" + uniq;

before(async () => {
  await waitForServer();
  // BOM-driven: bomlist.post mensyaratkan model master; model wajib kategori.
  // Template kategori menentukan field material (template-is-law): sn wajib ada.
  // Jika sudah ada dari run sebelumnya, 409/400 ditoleransi.
  const cat = await api("POST", "/product-categories/post", { slug: "ac", name: "Air Conditioner" });
  const catId = cat.data?.data?.id;
  if (catId) track("product_categories", catId);
  MASTER_CAT_ID = catId ?? (await api("GET", "/product-categories")).data?.data?.find((c) => c.slug === "ac")?.id ?? "";
  await api("POST", "/model/post", { brand: "TDD-MASTER", model: MODEL_SHORT, pk: 1, category_id: MASTER_CAT_ID });
});
let MASTER_CAT_ID = "";

after(async () => {
  await cleanupAll();
});

// ---------- AUTH & INFRA ----------
test("AUTH: tanpa token -> 401", async () => {
  const r = await api("GET", "/pin", undefined, "bad-token-xyz");
  assert.strictEqual(r.status, 401);
});

test("AUTH: token valid -> 200", async () => {
  const r = await api("GET", "/pin");
  assert.strictEqual(r.status, 200);
});

test("INFRA: route tidak ada -> 404", async () => {
  const r = await api("GET", "/__nonexistent__");
  assert.strictEqual(r.status, 404);
});

// ---------- LOGIN ----------
test("LOGIN: body kosong -> 400", async () => {
  const r = await api("POST", "/auth/login", {});
  assert.strictEqual(r.status, 400);
});

test("LOGIN: password salah -> 401", async () => {
  const ru = await api("POST", "/users/regist", { username: "login_" + uniq, password: "benar123", email: "l@t.id", roleuser: "admin", departement: "QA", section: "T" });
  track("users", ru.data?.user?.id);
  const r = await api("POST", "/auth/login", { username: "login_" + uniq, password: "salah" });
  assert.strictEqual(r.status, 401);
  assert.match(JSON.stringify(r.data), /Username atau password salah/);
});

test("LOGIN: user tidak ada -> 401 (pesan seragam)", async () => {
  const r = await api("POST", "/auth/login", { username: "no_such_user_" + uniq, password: "x" });
  assert.strictEqual(r.status, 401);
  assert.match(JSON.stringify(r.data), /Username atau password salah/);
});

test("LOGIN: benar -> 200 + user", async () => {
  const r = await api("POST", "/auth/login", { username: "login_" + uniq, password: "benar123" });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.user);
  assert.ok(r.data.message, "login successful");
});

// ---------- USERS ----------
test("USERS: regist tanpa password -> 400 (validasi)", async () => {
  const r = await api("POST", "/users/regist", { username: "nopass_" + uniq, email: "n@t.id", roleuser: "admin", departement: "QA", section: "T" });
  assert.strictEqual(r.status, 400);
});

test("USERS: regist tanpa username -> 400 (validasi)", async () => {
  const r = await api("POST", "/users/regist", { password: "x123456", email: "n@t.id", roleuser: "admin", departement: "QA", section: "T" });
  assert.strictEqual(r.status, 400);
});

test("USERS: regist valid -> 201, duplikat case-insensitive -> 400", async () => {
  let r = await api("POST", "/users/regist", { username: "dup_" + uniq, password: "pass123", email: "d@t.id", roleuser: "admin", departement: "QA", section: "T" });
  assert.strictEqual(r.status, 201);
  track("users", r.data.user?.id);
  r = await api("POST", "/users/regist", { username: "DUP_" + uniq.toUpperCase(), password: "pass123", email: "d2@t.id", roleuser: "admin", departement: "QA", section: "T" });
  assert.strictEqual(r.status, 400);
});

test("USERS: update + delete -> 201 / 200", async () => {
  let r = await api("POST", "/users/regist", { username: "crud_" + uniq, password: "pass123", email: "c@t.id", roleuser: "admin", departement: "QA", section: "T" });
  userId = r.data.user?.id;
  track("users", userId);
  r = await api("PUT", "/users/update/" + userId, { username: "crud_" + uniq, password: "pass456", email: "c@t.id", roleuser: "admin", departement: "QA", section: "T2" });
  assert.strictEqual(r.status, 201);
  r = await api("DELETE", "/users/delete/" + userId);
  assert.strictEqual(r.status, 200);
});

// ---------- MODEL ----------
test("MODEL: post 200, duplikat 409, edit 201, delete 200", async () => {
  const mName = "TDDM-" + uniq; // nama unik, tidak bentrok dengan master dari before()
  let r = await api("POST", "/model/post", { brand: "BRAND-" + uniq, model: mName, pk: 10, linkimage: "http://x", category_id: MASTER_CAT_ID });
  assert.strictEqual(r.status, 200);
  modelId = r.data.data?.id;
  track("model", modelId);
  r = await api("POST", "/model/post", { brand: "BRAND-" + uniq, model: mName, pk: 10, category_id: MASTER_CAT_ID });
  assert.strictEqual(r.status, 409);
  r = await api("POST", "/model/post", { brand: "BRAND-" + uniq, model: "NOCAT-" + uniq, pk: 10 });
  assert.strictEqual(r.status, 400, "model tanpa kategori ditolak");
  r = await api("PUT", "/model/edit/" + modelId, { brand: "BRAND2", model: mName, inch: 12, linkimage: "http://y", category_id: MASTER_CAT_ID });
  assert.strictEqual(r.status, 201);
  r = await api("DELETE", "/model/delete/" + modelId);
  assert.strictEqual(r.status, 200);
});

// ---------- LINE ----------
test("LINE: post 201, duplikat 400, delete 200", async () => {
  let r = await api("POST", "/line/post", { line: "LINE-" + uniq });
  assert.strictEqual(r.status, 201);
  lineId = r.data.data?.id;
  track("line", lineId);
  r = await api("POST", "/line/post", { line: "LINE-" + uniq });
  assert.strictEqual(r.status, 400);
  r = await api("DELETE", "/line/" + lineId);
  assert.strictEqual(r.status, 200);
});

test("LINE: operator dapat membaca daftar line", async () => {
  const r = await api("GET", "/line", undefined, token("ppc"));
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.data.data));
});

// ---------- PIN ----------
test("PIN: post 200, duplikat 409, compare benar/salah, delete", async () => {
  let r = await api("POST", "/pin/post", { date: TODAY, pin: 4321 });
  assert.strictEqual(r.status, 200);
  pinId = r.data.result?.id;
  track("pin", pinId);
  r = await api("POST", "/pin/post", { date: TODAY, pin: 1111 });
  assert.strictEqual(r.status, 409);
  r = await api("POST", "/pin/compare", { pin: 4321 });
  assert.strictEqual(r.status, 200);
  r = await api("POST", "/pin/compare", { pin: 9999 });
  assert.strictEqual(r.status, 400);
  r = await api("DELETE", "/pin/delete/" + pinId);
  assert.strictEqual(r.status, 200);
});

test("PIN: compare tanpa pin hari ini -> 404", async () => {
  const r = await api("POST", "/pin/compare", { pin: 7777 });
  assert.ok([400, 404].includes(r.status));
});

// ---------- BOMLIST ----------
test("BOMLIST: post 200, edit 200, delete 200", async () => {
  let r = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ORDER, sn: SN });
  assert.strictEqual(r.status, 200);
  bomlistId = r.data.data?.id;
  track("bomlist", bomlistId);
  r = await api("PUT", "/bomlist/edit/" + bomlistId, { model: MODEL_SHORT, order_number: ORDER, sn: SN });
  assert.strictEqual(r.status, 200);
  r = await api("DELETE", "/bomlist/delete/" + bomlistId);
  assert.strictEqual(r.status, 200);
});

// ---------- UPH ----------
test("UPH: post 201, edit 200, delete 200", async () => {
  const rLine = await api("POST", "/line/post", { line: "LINE-U-" + uniq });
  track("line", rLine.data.data?.id);
  const rModel = await api("POST", "/model/post", { brand: "B", model: "MOD-U-" + uniq, pk: 1, category_id: MASTER_CAT_ID });
  track("model", rModel.data.data?.id);
  let r = await api("POST", "/uph/post", { model: rModel.data.data?.id, line: rLine.data.data?.id, uph: 100 });
  assert.strictEqual(r.status, 201);
  track("uph", r.data.data?.id);
  r = await api("PUT", "/uph/edit/" + r.data.data?.id, { model: rModel.data.data?.id, line: rLine.data.data?.id, uph: 120 });
  assert.strictEqual(r.status, 200);
  r = await api("DELETE", "/uph/delete/" + r.data.data?.id);
  assert.strictEqual(r.status, 200);
});

// ---------- REGISTSCAN ----------
test("REGISTSCAN: post tanpa model -> 400 (validasi)", async () => {
  const r = await api("POST", "/registscan/post", { order_number: ORDER, po_number: "P", subline: "L", userid: "u", shift: "1", plan: 5, sn: SN });
  assert.strictEqual(r.status, 400);
});

test("REGISTSCAN: post tanpa order_number -> 400 (validasi)", async () => {
  const r = await api("POST", "/registscan/post", { model: MODEL_FULL, po_number: "P", subline: "L", userid: "u", shift: "1", plan: 5, sn: SN });
  assert.strictEqual(r.status, 400);
});

test("REGISTSCAN: line wajib dipilih di body", async () => {
  const ord = "ORDS-" + uniq;
  await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: SN });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-S-" + uniq,
    userid: "u_" + uniq, shift: "1", plan: 5, sn: SN,
  });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /line wajib diisi/);
});

test("REGISTSCAN: field wajib dari BOM tidak diisi -> 400", async () => {
  const ord = "ORDQ1-" + uniq;
  await api("POST", "/bomlist/post", {
    model: MODEL_SHORT, order_number: ord, sn: SN,
    pcb_idu: "PCB", pcb_idu_required: true,
  });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-" + uniq, subline: "LINE IDU ASSY INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN,
  });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /Wajib diisi/);
});

test("REGISTSCAN: nilai tidak sesuai prefix BOM -> 400", async () => {
  const ord = "ORDQ2-" + uniq;
  await api("POST", "/bomlist/post", {
    model: MODEL_SHORT, order_number: ord, sn: SN,
    pcb_idu: "PCB", pcb_idu_required: true,
  });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-" + uniq, subline: "LINE IDU ASSY INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN, pcb_idu: "AAA-" + uniq,
  });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /tidak sesuai BOM/);
});

test("REGISTSCAN: field dinamis tak dideklarasi BOM -> 400", async () => {
  const ord = "ORDQ3-" + uniq;
  await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: SN });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN, sn_drum: "DRM-" + uniq,
  });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /Field tidak dikenal kategori/);
});

test("REGISTSCAN: post valid 201, get list, delete 200", async () => {
  const pvOrd = "PVORD-" + uniq; // order unik agar tak bentrok BOM rule unik
  const rb1 = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: pvOrd, sn: SN });
  track("bomlist", rb1.data?.data?.id);
  let r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: pvOrd, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN,
    pcb_odu: "PCBO-" + uniq, sn_motor: "MTR-" + uniq,
    pcb_idu: "PCB-" + uniq, sn_carton: "CTN-" + uniq, sn_accessories: "ACC-" + uniq,
  });
  assert.strictEqual(r.status, 201);
  registId = r.data.result?.id;
  track("registscan", registId);
  r = await api("GET", "/registscan?limit=5");
  assert.strictEqual(r.status, 200);
  r = await api("GET", "/registscan?keyword=" + MODEL_SHORT + "&limit=5");
  assert.strictEqual(r.status, 200);
  r = await api("DELETE", "/registscan/delete/" + registId);
  assert.strictEqual(r.status, 200);
});

// ---------- RDPS ----------
test("RDPS: scan tanpa idregist header -> 404", async () => {
  const r = await api("GET", "/rdps/scan", undefined, token());
  assert.strictEqual(r.status, 404);
});

test("RDPS: post 201, edit 200, export 200, delete 200 (alur scan)", async () => {
  // setup: bomlist + registscan
  const rb2 = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ORDER, sn: SN });
  track("bomlist", rb2.data?.data?.id);
  let r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ORDER, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN,
    pcb_odu: "PCBO-" + uniq, sn_motor: "MTR-" + uniq,
    pcb_idu: "PCB-" + uniq, sn_carton: "CTN-" + uniq, sn_accessories: "ACC-" + uniq,
  });
  assert.strictEqual(r.status, 201);
  registId = r.data.result?.id;
  track("registscan", registId);

  r = await api("POST", "/rdps/post", { id_regist: registId, sn: SN, sn_carton: "CTN-" + uniq, pcb_idu: "PCB-" + uniq, pcb_odu: "PCBO-" + uniq, sn_motor: "MTR-" + uniq, sn_accessories: "ACC-" + uniq });
  assert.strictEqual(r.status, 201);
  recordId = r.data.data?.id;
  track("recordscan", recordId);

  r = await api("PUT", "/rdps/edit/" + recordId, { id_regist: registId, sn: SN, sn_carton: "CTN-" + uniq, pcb_idu: "PCB-" + uniq, pcb_odu: "PCBO-" + uniq, sn_motor: "MTR-" + uniq, sn_accessories: "ACC-" + uniq });
  assert.strictEqual(r.status, 200);

  r = await api("GET", "/rdps/export-odf-po-detail?model=" + MODEL_FULL + "&order_number=" + ORDER);
  assert.strictEqual(r.status, 200);

  r = await api("GET", "/rdps/export-odf-po-all?model=" + MODEL_FULL + "&order_number=" + ORDER);
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.data.data));
  assert.ok(r.data.data.some((row) => Object.hasOwn(row, "scanTime")));
  assert.ok(r.data.data.some((row) => Object.hasOwn(row, "registTime")));
  // xlsx variant — paritas dengan ekspor lama (datascan Export -> allHistory.xlsx)
  r = await api("GET", "/rdps/export-odf-po-all.xlsx?model=" + MODEL_FULL + "&order_number=" + ORDER);
  assert.strictEqual(r.status, 200);
  assert.ok((r.headers["content-type"] || "").includes("spreadsheetml"));
  // xlsx riwayat per registrasi — paritas dengan ekspor lama (history.xlsx)
  r = await api("GET", "/rdps/history.xlsx", undefined, undefined, { idregist: registId });
  assert.strictEqual(r.status, 200);
  assert.ok((r.headers["content-type"] || "").includes("spreadsheetml"));

  r = await api("GET", "/rdps/total-po-scan?limit=5");
  assert.strictEqual(r.status, 200);

  r = await api("DELETE", "/rdps/delete/" + recordId, undefined, undefined, { idregist: registId });
  assert.strictEqual(r.status, 200);
  r = await api("DELETE", "/registscan/delete/" + registId);
  assert.strictEqual(r.status, 200);
});

// ---------- TDD SLICE 1: DOUBLE-SN REJECTION ----------
test("DATA EXPORT: riwayat scan global dapat dicari dan dipaginasi", async () => {
  const ord = "ORDEXPORT-" + uniq;
  const prefix = "EXP-" + uniq;
  const bom = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: prefix });
  track("bomlist", bom.data?.data?.id);
  const registration = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-" + uniq, subline: "LINE IDU ASSY INPUT",
    shift: "1", plan: 1, sn: prefix + "000",
  });
  assert.strictEqual(registration.status, 201);
  track("registscan", registration.data.result.id);
  const scan = await api("POST", "/rdps/post", { id_regist: registration.data.result.id, sn: prefix + "001" });
  assert.strictEqual(scan.status, 201);
  track("recordscan", scan.data.data.id);
  const result = await api("GET", `/rdps/data-export?keyword=${encodeURIComponent(ord)}&page=1&limit=20`);
  assert.strictEqual(result.status, 200);
  assert.ok(result.data.data.some((row) => row.order_number === ord));
  const xlsx = await api("GET", `/rdps/data-export.xlsx?keyword=${encodeURIComponent(ord)}`);
  assert.strictEqual(xlsx.status, 200);
});

// ---------- TDD SLICE 1b: LENGTH RULE (port form lama) ----------
test("TDD/LENGTH: panjang scan harus sama dengan referensi registrasi", async () => {
  const ord = "ORDLEN-" + uniq;
  const regSn = "LEN2026-CCCCCC"; // referensi 14 karakter
  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: "LEN2026" }); // prefix lebih pendek dari referensi
  track("bomlist", rb.data?.data?.id);
  const rReg = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "POLEN-" + uniq, subline: "LINE IDU ASSY INPUT",
    userid: "ul_" + uniq, shift: "1", plan: 10, sn: regSn, pcb_idu: "PCBLEN-7777", sn_accessories: "ACCCLEN-01",
  });
  assert.strictEqual(rReg.status, 201);
  const rid = rReg.data.result?.id;
  track("registscan", rid);
  // kependekan -> ditolak (padahal prefix cocok, akurasi tinggi)
  const expectedLen = regSn.length;
  const snLabel = "Serial Number";
  let r = await api("POST", "/rdps/post", { id_regist: rid, sn: "LEN2026-CC" });
  assert.strictEqual(r.status, 400, "scan lebih pendek dari referensi harus ditolak");
  assert.match(JSON.stringify(r.data), new RegExp(`Panjang ${snLabel} harus ${expectedLen}`));
  // kepanjangan -> ditolak
  r = await api("POST", "/rdps/post", { id_regist: rid, sn: regSn + "99" });
  assert.strictEqual(r.status, 400, "scan lebih panjang dari referensi harus ditolak");
  assert.match(JSON.stringify(r.data), new RegExp(`Panjang ${snLabel} harus ${expectedLen}`));
  // panjang pas -> sukses
  r = await api("POST", "/rdps/post", { id_regist: rid, sn: regSn });
  assert.strictEqual(r.status, 201, "scan dengan panjang sama harus sukses");
  track("recordscan", r.data.data?.id);
  // field tanpa referensi (sn_motor kosong di registrasi) tidak divalidasi panjangnya
  r = await api("POST", "/rdps/post", { id_regist: rid, sn: "LEN2026-DDDDDD", sn_motor: "MTR-01" });
  assert.strictEqual(r.status, 201, "field tanpa referensi bebas panjang");
  track("recordscan", r.data.data?.id);
  // edit yang melanggar panjang -> ditolak
  r = await api("PUT", "/rdps/edit/" + r.data.data.id, { id_regist: rid, sn: regSn.slice(0, 5) });
  assert.strictEqual(r.status, 400, "edit ke panjang salah harus ditolak");
  assert.match(JSON.stringify(r.data), new RegExp(`Panjang ${snLabel} harus ${expectedLen}`));
});
test("TDD/DOUBLE-SN: scan SN sama di regist sama -> 400", async () => {
  const ord = "ORD2-" + uniq;
  const sub = "LINE IDU ASSY INPUT";
  const regSn = "AC2026-AAAAAA";
  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: regSn });
  track("bomlist", rb.data?.data?.id);
  const rReg = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO2-" + uniq, subline: sub,
    userid: "u2_" + uniq, shift: "1", plan: 10, sn: regSn, pcb_idu: "PCB-A", sn_accessories: "ACC-A",
  });
  assert.strictEqual(rReg.status, 201);
  const rid = rReg.data.result?.id;
  track("registscan", rid);

  const payload = { id_regist: rid, sn: regSn };
  let r = await api("POST", "/rdps/post", payload);
  assert.strictEqual(r.status, 201, "scan pertama harus sukses");
  track("recordscan", r.data.data?.id);

  r = await api("POST", "/rdps/post", payload);
  assert.strictEqual(r.status, 400, "scan ulang SN sama harus ditolak");
  assert.match(JSON.stringify(r.data), /Double scan/i);
});

test("TDD/DOUBLE-SN: SN beda tapi material sama -> 400", async () => {
  const ord = "ORD3-" + uniq;
  const sub = "LINE IDU ASSY INPUT";
  const regSn = "AC2026-BBBBBB";
  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: regSn });
  track("bomlist", rb.data?.data?.id);
  const rReg = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO3-" + uniq, subline: sub,
    userid: "u3_" + uniq, shift: "1", plan: 10, sn: regSn, pcb_idu: "PCB-SHARED-" + uniq, sn_accessories: "ACC-B",
  });
  assert.strictEqual(rReg.status, 201);
  const rid = rReg.data.result?.id;
  track("registscan", rid);

  const pcbShared = "PCB-SHARED-" + uniq;
  const snAlt = regSn.slice(0, -1) + "C"; // beda SN, sama panjang referensi
  let r = await api("POST", "/rdps/post", { id_regist: rid, sn: regSn, pcb_idu: pcbShared });
  assert.strictEqual(r.status, 201, "scan pertama harus sukses");
  track("recordscan", r.data.data?.id);

  r = await api("POST", "/rdps/post", { id_regist: rid, sn: snAlt, pcb_idu: pcbShared });
  assert.strictEqual(r.status, 400, "material yang sama di regist sama harus ditolak");
  assert.match(JSON.stringify(r.data), /Double scan/i);
});

// ---------- TDD SLICE 2: UPH DASHBOARD AGGREGATION ----------
test("TDD/DASHBOARD: agregasi UPH per jam menjumlah scan hari ini", async () => {
  const MODEL_DASH_FULL = "TDAD-" + uniq + "LOOP"; // slice(-5) -> "TDAD-<uniq>"
  const ord = "ORDD-" + uniq;
  const sub = "LINE DASH IDU ASSY " + uniq;
  const PO = "PO-DASH-" + uniq;

  const rModel = await api("POST", "/model/post", { brand: "B-DASH", model: MODEL_DASH_FULL.slice(0, -5), pk: 1, category_id: MASTER_CAT_ID });
  assert.strictEqual(rModel.status, 200);
  track("model", rModel.data.data?.id);
  const rLine = await api("POST", "/line/post", { line: sub });
  assert.strictEqual(rLine.status, 201);
  track("line", rLine.data.data?.id);
  const rb = await api("POST", "/bomlist/post", { model: MODEL_DASH_FULL.slice(0, -5), order_number: ord, sn: "DASH-SN" });
  track("bomlist", rb.data?.data?.id);

  const mkRegist = async (shift) => {
    const r = await api("POST", "/registscan/post", {
      model: MODEL_DASH_FULL, order_number: ord, po_number: PO, subline: sub,
      userid: "ud_" + uniq + shift, shift, plan: 10,
      sn: "DASH-SN-" + shift + "001", pcb_idu: "PCB-D" + shift, sn_accessories: "ACC-D" + shift,
    });
    assert.strictEqual(r.status, 201, "regist harus dibuat");
    const rid = r.data.result?.id;
    track("registscan", rid);
    return rid;
  };

  const rid1 = await mkRegist("1");
  const rid2 = await mkRegist("2");

  // shift 1: 2 scan; shift 2: 1 scan
  const scans = [
    { id_regist: rid1, sn: "DASH-SN-1001" },
    { id_regist: rid1, sn: "DASH-SN-1002" },
    { id_regist: rid2, sn: "DASH-SN-2001" },
  ];
  for (const s of scans) {
    const r = await api("POST", "/rdps/post", s);
    assert.strictEqual(r.status, 201, "scan harus sukses: " + s.sn);
    track("recordscan", r.data.data?.id);
  }

  const r = await api("GET", "/rdps/dashboard?keyword=" + encodeURIComponent(sub));
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.data.data), "data harus array");
  const item = r.data.data.find((d) => d.model === MODEL_DASH_FULL);
  assert.ok(item, "model harus muncul di dashboard");

  const hour = new Date().getHours();
  const expected = hour >= 16 ? 3 : hour >= 7 ? 2 : 1; // branch2/1/3
  assert.strictEqual(item.total, expected, "total harus = scan shift aktif hari ini");
  assert.ok(Array.isArray(item.uph) && item.uph.length === 24, "uph 24 slot jam");
  assert.ok(Array.isArray(r.data.subline), "subline list ada");
});

// ---------- FIXED PLAN: lanjut produksi lewat registrasi baru ----------
test("PLAN: batch ditutup saat plan tercapai, registrasi baru dapat melanjutkan", async () => {
  const ord = "ORDPLAN-" + uniq;
  const prefix = "PLAN-" + uniq;
  const bom = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: prefix });
  assert.strictEqual(bom.status, 200);
  track("bomlist", bom.data.data.id);

  const makeRegistration = async (po, sn) => api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: po, subline: "LINE IDU ASSY INPUT",
    shift: "1", plan: 1, sn,
  });

  let registration = await makeRegistration("PO-PLAN-1-" + uniq, prefix + "001");
  assert.strictEqual(registration.status, 201);
  const firstId = registration.data.result.id;
  track("registscan", firstId);
  let scan = await api("POST", "/rdps/post", { id_regist: firstId, sn: prefix + "001" });
  assert.strictEqual(scan.status, 201);
  scan = await api("POST", "/rdps/post", { id_regist: firstId, sn: prefix + "002" });
  assert.strictEqual(scan.status, 400);
  assert.match(JSON.stringify(scan.data), /Target plan registrasi sudah tercapai/);

  registration = await makeRegistration("PO-PLAN-2-" + uniq, prefix + "002");
  assert.strictEqual(registration.status, 201);
  const secondId = registration.data.result.id;
  track("registscan", secondId);
  scan = await api("POST", "/rdps/post", { id_regist: secondId, sn: prefix + "002" });
  assert.strictEqual(scan.status, 201);
});

// ---------- TDD SLICE 3: DELETE CASCADE ----------
test("TDD/CASCADE: hapus registrasi ikut menghapus scan-nya", async () => {
  const ord = "ORDC-" + uniq;
  const sub = "LINE CASCADE IDU ASSY";
  const regSn = "CASC-SN-1001";
  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: "CASC-SN" });
  track("bomlist", rb.data?.data?.id);
  const rReg = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-C-" + uniq, subline: sub,
    userid: "uc_" + uniq, shift: "1", plan: 10, sn: regSn, pcb_idu: "PCB-C", sn_accessories: "ACC-C",
  });
  assert.strictEqual(rReg.status, 201);
  const rid = rReg.data.result?.id;

  for (const s of ["CASC-SN-1001", "CASC-SN-1002"]) {
    const r = await api("POST", "/rdps/post", { id_regist: rid, sn: s });
    assert.strictEqual(r.status, 201, "scan harus sukses: " + s);
  }

  const before = await api("GET", "/rdps/history", undefined, token(), { idregist: rid });
  assert.strictEqual(before.status, 200);
  assert.strictEqual(before.data.total, 2, "harus ada 2 scan sebelum hapus");

  const del = await api("DELETE", "/registscan/delete/" + rid);
  assert.strictEqual(del.status, 200, "registrasi harus bisa dihapus");

  const after = await api("GET", "/rdps/history", undefined, token(), { idregist: rid });
  assert.strictEqual(after.status, 404, "registrasi dan typed scan harus ikut terhapus");
});

// ---------- TDD SLICE 4: AUTH REFRESH FLOW ----------
test("TDD/SESSION: login -> akses -> logout -> akses lagi 401", async () => {
  const u = "refl-" + uniq;
  const reg = await api("POST", "/users/regist", {
    username: u, password: "refpass1", email: "ref@t.id", roleuser: "superuser", departement: "QA", section: "T",
  });
  assert.strictEqual(reg.status, 201);
  track("users", reg.data.user?.id);

  // login real -> ambil session_id dari Set-Cookie
  const loginRes = await fetch(`${process.env.TEST_PORT ? `http://localhost:${process.env.TEST_PORT}` : "http://localhost:3199"}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: "refpass1" }),
  });
  assert.strictEqual(loginRes.status, 200);
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const sid = /session_id=([^;]+)/.exec(setCookie)?.[1];
  assert.ok(sid, "harus ada session_id di Set-Cookie");

  // akses pakai cookie session
  let r = await api("GET", "/pin", undefined, sid);
  assert.strictEqual(r.status, 200, "session valid harus lolos");

  // /auth/me kembalikan user
  r = await api("GET", "/auth/me", undefined, sid);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.user?.username, u, "me harus kembalikan user login");

  // logout -> session dihapus
  r = await api("POST", "/auth/logout", undefined, sid);
  assert.strictEqual(r.status, 200);

  // akses setelah logout -> 401
  r = await api("GET", "/pin", undefined, sid);
  assert.strictEqual(r.status, 401, "session setelah logout harus invalid");

  // session tidak ada -> 401
  r = await api("GET", "/auth/me", undefined, "0000000000000000000000000000000000000000000000000000000000000000");
  assert.strictEqual(r.status, 401, "session tak dikenal harus 401");
});

// ---------- PRODUCT CATEGORIES ----------
test("PRODUCT_CATEGORIES: hanya kategori typed AC/WM yang didukung", async () => {
  let r = await api("POST", "/product-categories/post", { slug: "unsupported-" + uniq, name: "Unsupported" });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /tidak didukung/);

  r = await api("GET", "/product-categories");
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.data.some((c) => c.slug === "ac"));
});

// ---------- WM typed tables ----------
test("WM: spesifikasi dan scan memakai kolom typed", async () => {
  let categories = await api("GET", "/product-categories");
  let wmId = categories.data.data.find((category) => category.slug === "wm")?.id;
  if (!wmId) {
    const created = await api("POST", "/product-categories/post", { slug: "wm", name: "Washing Machine" });
    assert.strictEqual(created.status, 201);
    wmId = created.data.data.id;
    track("product_categories", wmId);
  }
  const wmModel = "WM-" + uniq;
  let r = await api("POST", "/model/post", { brand: "WM", model: wmModel, pk: 1, category_id: wmId });
  assert.strictEqual(r.status, 200);
  track("model", r.data.data.id);
  const wOrd = "WMORD-" + uniq;
  r = await api("POST", "/bomlist/post", { model: wmModel, order_number: wOrd, sn: "WM", sn_drum: "DRM", sn_drum_required: true, sn_pump: "PMP" });
  assert.strictEqual(r.status, 200);
  track("bomlist", r.data.data.id);

  r = await api("POST", "/registscan/post", { model: wmModel, order_number: wOrd, po_number: "PO-" + uniq, subline: "LINE WASHING INPUT", shift: "1", plan: 2, sn: "WM-REF" });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /SN Drum|sn_drum/);

  r = await api("POST", "/registscan/post", { model: wmModel, order_number: wOrd, po_number: "PO-" + uniq, subline: "LINE WASHING INPUT", shift: "1", plan: 2, sn: "WM-REF", sn_drum: "DRM-REF", sn_pump: "PMP-REF" });
  assert.strictEqual(r.status, 201);
  const washRegistId = r.data.result.id;
  track("registscan", washRegistId);
  r = await api("POST", "/rdps/post", { id_regist: washRegistId, sn: "WM-001", sn_drum: "DRM-001", sn_pump: "PMP-001" });
  assert.strictEqual(r.status, 201);
});

test("WM: tanpa registrasi ASSY OUTPUT, packing tetap boleh lanjut", async () => {
  const categories = await api("GET", "/product-categories");
  const wmId = categories.data.data.find((category) => category.slug === "wm")?.id;
  const wmModel = "WM-OPTIONAL-" + uniq;
  const order = "WMOPTIONAL-" + uniq;
  const po = "PO-WMOPTIONAL-" + uniq;
  let r = await api("POST", "/model/post", { brand: "WM", model: wmModel, pk: 1, category_id: wmId });
  assert.strictEqual(r.status, 200);
  track("model", r.data.data.id);
  r = await api("POST", "/bomlist/post", { model: wmModel, order_number: order, sn: "WM", sn_drum: "DRM", sn_drum_required: true });
  assert.strictEqual(r.status, 200);
  track("bomlist", r.data.data.id);

  const create = async (subline) => {
    const response = await api("POST", "/registscan/post", {
      model: wmModel, order_number: order, po_number: po, subline,
      shift: "1", plan: 1, sn: "WM-REF", sn_drum: "DRM-REF",
    });
    assert.strictEqual(response.status, 201);
    track("registscan", response.data.result.id);
    return response.data.result.id;
  };
  const assyInput = await create("LINE WM ASSY INPUT");
  const packingInput = await create("LINE WM PACKING INPUT");

  r = await api("POST", "/rdps/post", { id_regist: packingInput, sn: "WM-002", sn_drum: "DRM-002" });
  assert.strictEqual(r.status, 400);
  r = await api("POST", "/rdps/post", { id_regist: assyInput, sn: "WM-002", sn_drum: "DRM-002" });
  assert.strictEqual(r.status, 201);
  r = await api("POST", "/rdps/post", { id_regist: packingInput, sn: "WM-002", sn_drum: "DRM-002" });
  assert.strictEqual(r.status, 201);
});

test("WM: ASSY harus selesai sebelum packing", async () => {
  const categories = await api("GET", "/product-categories");
  const wmId = categories.data.data.find((category) => category.slug === "wm")?.id;
  const wmModel = "WM-STAGE-" + uniq;
  const order = "WMSTAGE-" + uniq;
  const po = "PO-WMSTAGE-" + uniq;
  let r = await api("POST", "/model/post", { brand: "WM", model: wmModel, pk: 1, category_id: wmId });
  assert.strictEqual(r.status, 200);
  track("model", r.data.data.id);
  r = await api("POST", "/bomlist/post", { model: wmModel, order_number: order, sn: "WM", sn_drum: "DRM", sn_drum_required: true });
  assert.strictEqual(r.status, 200);
  track("bomlist", r.data.data.id);

  const makeRegistration = async (subline) => {
    const response = await api("POST", "/registscan/post", {
      model: wmModel, order_number: order, po_number: po, subline,
      shift: "1", plan: 1, sn: "WM-REF", sn_drum: "DRM-REF",
    });
    assert.strictEqual(response.status, 201);
    track("registscan", response.data.result.id);
    return response.data.result.id;
  };
  const scan = (id) => api("POST", "/rdps/post", { id_regist: id, sn: "WM-001", sn_drum: "DRM-001" });
  const assyInput = await makeRegistration("LINE WM ASSY INPUT");
  const assyOutput = await makeRegistration("LINE WM ASSY OUTPUT");
  const packingInput = await makeRegistration("LINE WM PACKING INPUT");
  const packingOutput = await makeRegistration("LINE WM PACKING OUTPUT");

  r = await scan(packingInput);
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /LINE WM ASSY INPUT/);
  r = await scan(assyInput);
  assert.strictEqual(r.status, 201);
  r = await scan(packingInput);
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /LINE WM ASSY OUTPUT/);
  r = await scan(assyOutput);
  assert.strictEqual(r.status, 201);
  r = await scan(packingInput);
  assert.strictEqual(r.status, 201);
  r = await scan(packingOutput);
  assert.strictEqual(r.status, 201);
});

// ---------- TDD SLICE: BULK IMPORT + SOFT-DELETE BOM ----------
test("TDD/IMPORT: import scan divalidasi BOM + hanya superuser", async () => {
  const ord = "ORDIMP-" + uniq;
  const pre = "IMP-" + uniq;
  await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: pre });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-IMP-" + uniq,
    userid: "u_imp_" + uniq, subline: "LINE IDU ASSY INPUT", shift: "1", plan: 10, sn: pre + "0001",
  });
  assert.strictEqual(r.status, 201);
  const rid = r.data.result.id;
  track("registscan", rid);

  // ppc tidak boleh import (tanpa registscan:import-sn)
  const denied = await api("POST", "/rdps/import", {
    id_regist: rid, rows: [{ sn: pre + "0001" }],
  }, token("ppc"));
  assert.strictEqual(denied.status, 403, "ppc tanpa import-sn harus 403");

  // baris tidak sesuai BOM (panjang dibuat sama dgn referensi agar yang diuji murni prefix BOM) -> 400, transaction rollback
  const refLen = (pre + "0001").length;
  const bad = await api("POST", "/rdps/import", {
    id_regist: rid, rows: [{ sn: "IMP" + "X".repeat(refLen - 3) }],
  });
  assert.strictEqual(bad.status, 400);
  assert.match(JSON.stringify(bad.data), /tidak sesuai BOM/);

  // baris valid -> created 2
  const ok = await api("POST", "/rdps/import", {
    id_regist: rid, rows: [{ sn: pre + "0001" }, { sn: pre + "0002" }],
  });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.data.created, 2);
});

test("BOMLIST: hapus = arsip, bisa buat ulang aturan yang sama", async () => {
  const ord = "ORDARCH-" + uniq;
  const b1 = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: SN });
  assert.strictEqual(b1.status, 200);
  const id1 = b1.data.data?.id;
  track("bomlist", id1);

  const del = await api("DELETE", "/bomlist/delete/" + id1);
  assert.strictEqual(del.status, 200);

  // tidak muncul di list aktif
  const list = await api("GET", "/bomlist?keyword=" + ord + "&limit=5");
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.data.data.length, 0, "aturan terarsip tidak muncul di list aktif");

  // muncul kalau ?archived=true
  const arch = await api("GET", "/bomlist?keyword=" + ord + "&archived=true&limit=5");
  assert.strictEqual(arch.data.data.length, 1, "aturan terarsip muncul saat archived=true");

  // bisa buat ulang (tidak bentrok unique)
  const b2 = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: SN });
  assert.strictEqual(b2.status, 200);
  track("bomlist", b2.data.data?.id);
});

// ---------- TDD SLICE: ACCESS CONTROL (ownership) ----------
test("TDD/ACCESS: ppc tidak bisa scan/edit/hapus registrasi milik user lain", async () => {
  const ord = "ORDACC-" + uniq;
  const sn = "ACC-" + uniq + "0001";
  const OTHER_ID = "22222222-2222-2222-2222-222222222222";
  await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-ACC-" + uniq,
    userid: "owner_" + uniq, subline: "LINE IDU ASSY INPUT", shift: "1", plan: 5, sn,
  });
  assert.strictEqual(r.status, 201);
  const rid = r.data.result.id;
  track("registscan", rid);

  const ppcToken = token("ppc", "LINE IDU ASSY INPUT", OTHER_ID);

  // scan regist milik orang lain -> 403
  const scan = await api("POST", "/rdps/post", { id_regist: rid, sn }, ppcToken);
  assert.strictEqual(scan.status, 403, "scan regist milik user lain harus 403");

  // edit -> 403
  const ed = await api("PUT", "/registscan/edit/" + rid, {
    model: MODEL_FULL, order_number: ord, po_number: "PO-ACC-" + uniq, shift: "1", plan: 6, sn,
  }, ppcToken);
  assert.strictEqual(ed.status, 403, "edit regist milik user lain harus 403");

  // hapus -> 403
  const del = await api("DELETE", "/registscan/delete/" + rid, undefined, ppcToken);
  assert.strictEqual(del.status, 403, "hapus regist milik user lain harus 403");

  // superuser tetap bisa hapus
  const del2 = await api("DELETE", "/registscan/delete/" + rid);
  assert.strictEqual(del2.status, 200, "superuser tetap bisa hapus");
});

test("PPC: registrasi terbuka memblokir registrasi baru, edit tidak butuh PIN", async () => {
  const ord = "ORDOPEN-" + uniq;
  const po = "PO-OPEN-" + uniq;
  const sn = "OPEN-" + uniq;
  const ppcId = "33333333-3333-3333-3333-333333333333";
  const ppcToken = token("ppc", "LINE IDU ASSY INPUT", ppcId);

  const bom = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn });
  track("bomlist", bom.data?.data?.id);
  const first = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: po, subline: "LINE IDU ASSY INPUT", shift: "1", plan: 1, sn,
  }, ppcToken);
  assert.strictEqual(first.status, 201);
  const firstId = first.data.result.id;
  track("registscan", firstId);

  const blocked = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: po + "-2", subline: "LINE IDU ASSY INPUT", shift: "1", plan: 1, sn,
  }, ppcToken);
  assert.strictEqual(blocked.status, 409);
  assert.strictEqual(blocked.data.code, "OPEN_REGISTRATION");

  const edited = await api("PUT", "/registscan/edit/" + firstId, {
    model: MODEL_FULL, order_number: ord, po_number: po, subline: "LINE IDU ASSY INPUT", shift: "1", plan: 1, sn,
  }, ppcToken);
  assert.strictEqual(edited.status, 200);

  const scanned = await api("POST", "/rdps/post", { id_regist: firstId, sn }, ppcToken);
  assert.strictEqual(scanned.status, 201);
  track("recordscan", scanned.data.data.id);

  const allowed = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: po + "-2", subline: "LINE IDU ASSY INPUT", shift: "1", plan: 1, sn,
  }, ppcToken);
  assert.strictEqual(allowed.status, 201);
  track("registscan", allowed.data.result.id);
});

// ---------- LOGIN RATE LIMIT (lockout per akun; self-clean agar tak ganggu test lain) ----------
test("AUTH/LOCKOUT: 5 gagal login -> 429 (rate limit)", async () => {
  const u = "lock_" + uniq;
  for (let i = 0; i < 5; i++) {
    const r = await api("POST", "/auth/login", { username: u, password: "wrong" });
    assert.strictEqual(r.status, 401, "percobaan gagal ke-" + (i + 1));
  }
  const locked = await api("POST", "/auth/login", { username: u, password: "wrong" });
  assert.strictEqual(locked.status, 429);
  assert.match(JSON.stringify(locked.data), /Terlalu banyak percobaan/);
  // bersihkan counter supaya test lain (yang mungkin jalan paralel) tak ikut terkunci
  const redis = require("../src/config/redis");
  const keys = await redis.keys("login_fail:*");
  if (keys.length) await redis.del(keys);
});

// ---------- TDD SLICE: INPUT-BEFORE-OUTPUT ----------
test("TDD/SEQ: SN harus di-scan INPUT dulu sebelum OUTPUT line yang sama", async () => {
  const ord = "ORDSEQ-" + uniq;
  const sn = "SEQ-" + uniq + "0001";
  const IN = "LINE IDU ASSY INPUT";
  const OUT = "LINE IDU ASSY OUTPUT";

  // Operator memilih line pada payload (tanpa login nyata)
  const tokenIn = token("superuser", IN);
  const tokenOut = token("superuser", OUT);

  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn });
  track("bomlist", rb.data?.data?.id);

  const mkRegist = async (t, u) => {
    const r = await api("POST", "/registscan/post", {
      model: MODEL_FULL, order_number: ord, po_number: "PO-SEQ-" + uniq,
      userid: "u_seq_" + uniq, subline: u, shift: "1", plan: 5, sn,
    }, t);
    assert.strictEqual(r.status, 201, (u || "") + " regist harus dibuat");
    const rid = r.data.result.id;
    track("registscan", rid);
    return rid;
  };
  const ridIn = await mkRegist(tokenIn, "input");
  const ridOut = await mkRegist(tokenOut, "output");

  // OUTPUT dulu -> ditolak, belum pernah di-scan di INPUT
  const outFirst = await api("POST", "/rdps/post", { id_regist: ridOut, sn }, tokenOut);
  assert.strictEqual(outFirst.status, 400, "output sebelum input harus ditolak");
  assert.match(JSON.stringify(outFirst.data), /belum di-scan/i);

  // INPUT -> sukses
  const inScan = await api("POST", "/rdps/post", { id_regist: ridIn, sn }, tokenIn);
  assert.strictEqual(inScan.status, 201, "scan input harus sukses");
  track("recordscan", inScan.data.data?.id);

  // OUTPUT sekarang -> sukses
  const outScan = await api("POST", "/rdps/post", { id_regist: ridOut, sn }, tokenOut);
  assert.strictEqual(outScan.status, 201, "scan output setelah input harus sukses");
  track("recordscan", outScan.data.data?.id);
});

test("TDD/SEQ: packing input wajib melewati assy input dan output", async () => {
  const ord = "ORDPACK-" + uniq;
  const sn = "PACK-" + uniq + "0001";
  const po = "PO-PACK-" + uniq;
  const tokenIn = token("superuser", "LINE IDU ASSY INPUT");
  const tokenOut = token("superuser", "LINE IDU ASSY OUTPUT");
  const tokenPacking = token("superuser", "LINE IDU PACKING INPUT");

  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn });
  track("bomlist", rb.data?.data?.id);

  const mkRegist = async (t, section) => {
    const r = await api("POST", "/registscan/post", {
      model: MODEL_FULL, order_number: ord, po_number: po, subline: section, shift: "1", plan: 1, sn,
    }, t);
    assert.strictEqual(r.status, 201, section + " regist harus dibuat");
    const rid = r.data.result.id;
    track("registscan", rid);
    return rid;
  };
  const ridIn = await mkRegist(tokenIn, "LINE IDU ASSY INPUT");
  const ridOut = await mkRegist(tokenOut, "LINE IDU ASSY OUTPUT");
  const ridPacking = await mkRegist(tokenPacking, "LINE IDU PACKING INPUT");

  let r = await api("POST", "/rdps/post", { id_regist: ridPacking, sn }, tokenPacking);
  assert.strictEqual(r.status, 400, "packing sebelum assy harus ditolak");
  assert.match(JSON.stringify(r.data), /ASSY INPUT/);

  r = await api("POST", "/rdps/post", { id_regist: ridIn, sn }, tokenIn);
  assert.strictEqual(r.status, 201);
  track("recordscan", r.data.data?.id);

  r = await api("POST", "/rdps/post", { id_regist: ridPacking, sn }, tokenPacking);
  assert.strictEqual(r.status, 400, "packing sebelum assy output harus ditolak");
  assert.match(JSON.stringify(r.data), /ASSY OUTPUT/);

  r = await api("POST", "/rdps/post", { id_regist: ridOut, sn }, tokenOut);
  assert.strictEqual(r.status, 201);
  track("recordscan", r.data.data?.id);

  r = await api("POST", "/rdps/post", { id_regist: ridPacking, sn }, tokenPacking);
  assert.strictEqual(r.status, 201, "packing setelah assy input dan output harus sukses");
  track("recordscan", r.data.data?.id);
});

test("TDD/SEQ: packing boleh lanjut tanpa registrasi assy output", async () => {
  const ord = "ORDPACK-OPTIONAL-" + uniq;
  const sn = "PACK-OPTIONAL-" + uniq + "0001";
  const po = "PO-PACK-OPTIONAL-" + uniq;
  const tokenIn = token("superuser", "LINE IDU ASSY INPUT");
  const tokenPacking = token("superuser", "LINE IDU PACKING INPUT");

  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn });
  track("bomlist", rb.data?.data?.id);

  const makeRegistration = async (t, subline) => {
    const r = await api("POST", "/registscan/post", {
      model: MODEL_FULL, order_number: ord, po_number: po, subline, shift: "1", plan: 1, sn,
    }, t);
    assert.strictEqual(r.status, 201, subline + " regist harus dibuat");
    track("registscan", r.data.result.id);
    return r.data.result.id;
  };
  const ridIn = await makeRegistration(tokenIn, "LINE IDU ASSY INPUT");
  const ridPacking = await makeRegistration(tokenPacking, "LINE IDU PACKING INPUT");

  let r = await api("POST", "/rdps/post", { id_regist: ridPacking, sn }, tokenPacking);
  assert.strictEqual(r.status, 400, "packing sebelum assy input harus ditolak");
  r = await api("POST", "/rdps/post", { id_regist: ridIn, sn }, tokenIn);
  assert.strictEqual(r.status, 201);
  track("recordscan", r.data.data?.id);
  r = await api("POST", "/rdps/post", { id_regist: ridPacking, sn }, tokenPacking);
  assert.strictEqual(r.status, 201, "packing tanpa assy output harus sukses");
  track("recordscan", r.data.data?.id);
});
