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
  // BOM-driven: bomlist.post mensyaratkan model sudah ada di Model Master.
  // Buat sekali; jika sudah ada dari run sebelumnya, 409 ditoleransi.
  await api("POST", "/model/post", { brand: "TDD-MASTER", model: MODEL_SHORT, pk: 1 });
});

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
  const r = await api("POST", "/login", {});
  assert.strictEqual(r.status, 400);
});

test("LOGIN: password salah -> 401", async () => {
  const ru = await api("POST", "/users/regist", { username: "login_" + uniq, password: "benar123", email: "l@t.id", roleuser: "admin", departement: "QA", section: "T" });
  track("users", ru.data?.user?.id);
  const r = await api("POST", "/login", { username: "login_" + uniq, password: "salah" });
  assert.strictEqual(r.status, 401);
  assert.match(JSON.stringify(r.data), /Username atau password salah/);
});

test("LOGIN: user tidak ada -> 401 (pesan seragam)", async () => {
  const r = await api("POST", "/login", { username: "no_such_user_" + uniq, password: "x" });
  assert.strictEqual(r.status, 401);
  assert.match(JSON.stringify(r.data), /Username atau password salah/);
});

test("LOGIN: benar -> 200 + token", async () => {
  const r = await api("POST", "/login", { username: "login_" + uniq, password: "benar123" });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.accessToken);
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
  let r = await api("POST", "/model/post", { brand: "BRAND-" + uniq, model: mName, pk: 10, linkimage: "http://x" });
  assert.strictEqual(r.status, 200);
  modelId = r.data.data?.id;
  track("model", modelId);
  r = await api("POST", "/model/post", { brand: "BRAND-" + uniq, model: mName, pk: 10 });
  assert.strictEqual(r.status, 409);
  r = await api("PUT", "/model/edit/" + modelId, { brand: "BRAND2", model: mName, inch: 12, linkimage: "http://y" });
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
  const rModel = await api("POST", "/model/post", { brand: "B", model: "MOD-U-" + uniq, pk: 1 });
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

test("REGISTSCAN: subline otomatis dari section user (tanpa subline di body)", async () => {
  const ord = "ORDS-" + uniq;
  await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: SN });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-S-" + uniq,
    userid: "u_" + uniq, shift: "1", plan: 5, sn: SN,
  });
  assert.strictEqual(r.status, 201, "tanpa subline di body harus pakai section JWT");
  const rid = r.data.result?.id;
  track("registscan", rid);
  const list = await api("GET", "/registscan?keyword=" + ord + "&limit=5");
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.data.data[0].subline, "TEST", "subline diisi dari section user (token helper section=TEST)");
});

test("REGISTSCAN: field wajib dari BOM tidak diisi -> 400", async () => {
  const ord = "ORDQ1-" + uniq;
  await api("POST", "/bomlist/post", {
    model: MODEL_SHORT, order_number: ord, sn: SN,
    components: { sn_drum: { label: "SN Drum", prefix: "DRM", required: true } },
  });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN,
  });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /Wajib diisi/);
});

test("REGISTSCAN: nilai tidak sesuai prefix BOM -> 400", async () => {
  const ord = "ORDQ2-" + uniq;
  await api("POST", "/bomlist/post", {
    model: MODEL_SHORT, order_number: ord, sn: SN,
    components: { sn_drum: { label: "SN Drum", prefix: "DRM", required: true } },
  });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN, sn_drum: "AAA-" + uniq,
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
  assert.match(JSON.stringify(r.data), /Field tidak dikenal BOM/);
});

test("REGISTSCAN: post valid 201, get list, delete 200", async () => {
  const pvOrd = "PVORD-" + uniq; // order unik agar tak bentrok BOM rule unik
  const rb1 = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: pvOrd, sn: SN });
  track("bomlist", rb1.data?.data?.id);
  let r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: pvOrd, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN,
    sn_odu: "ODU-" + uniq, sn_motor: "MTR-" + uniq, sn_box: "BOX-" + uniq,
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
    sn_odu: "ODU-" + uniq, sn_motor: "MTR-" + uniq, sn_box: "BOX-" + uniq,
    pcb_idu: "PCB-" + uniq, sn_carton: "CTN-" + uniq, sn_accessories: "ACC-" + uniq,
  });
  assert.strictEqual(r.status, 201);
  registId = r.data.result?.id;
  track("registscan", registId);

  r = await api("POST", "/rdps/post", { id_regist: registId, sn: SN, sn_odu: "ODU-" + uniq, sn_carton: "CTN-" + uniq, pcb_idu: "PCB-" + uniq, sn_box: "BOX-" + uniq, sn_motor: "MTR-" + uniq, sn_accessories: "ACC-" + uniq });
  assert.strictEqual(r.status, 201);
  recordId = r.data.data?.id;
  track("recordscan", recordId);

  r = await api("PUT", "/rdps/edit/" + recordId, { id_regist: registId, sn: SN, sn_odu: "ODU-" + uniq, sn_carton: "CTN-" + uniq, pcb_idu: "PCB-" + uniq, sn_box: "BOX-" + uniq, sn_motor: "MTR-" + uniq, sn_accessories: "ACC-" + uniq });
  assert.strictEqual(r.status, 200);

  r = await api("GET", "/rdps/export-odf-po-detail?model=" + MODEL_FULL + "&order_number=" + ORDER);
  assert.strictEqual(r.status, 200);

  r = await api("GET", "/rdps/export-odf-po-all?model=" + MODEL_FULL + "&order_number=" + ORDER);
  assert.strictEqual(r.status, 200);

  r = await api("GET", "/rdps/total-po-scan?limit=5");
  assert.strictEqual(r.status, 200);

  r = await api("DELETE", "/rdps/delete/" + recordId);
  assert.strictEqual(r.status, 200);
  r = await api("DELETE", "/registscan/delete/" + registId);
  assert.strictEqual(r.status, 200);
});

// ---------- TDD SLICE 1: DOUBLE-SN REJECTION ----------
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
    userid: "u3_" + uniq, shift: "1", plan: 10, sn: regSn, pcb_idu: "PCB-B", sn_accessories: "ACC-B",
  });
  assert.strictEqual(rReg.status, 201);
  const rid = rReg.data.result?.id;
  track("registscan", rid);

  const pcbShared = "PCB-SHARED-" + uniq;
  let r = await api("POST", "/rdps/post", { id_regist: rid, sn: regSn, pcb_idu: pcbShared });
  assert.strictEqual(r.status, 201, "scan pertama harus sukses");
  track("recordscan", r.data.data?.id);

  r = await api("POST", "/rdps/post", { id_regist: rid, sn: regSn + "2", pcb_idu: pcbShared });
  assert.strictEqual(r.status, 400, "material yang sama di regist sama harus ditolak");
  assert.match(JSON.stringify(r.data), /Double scan/i);
});

// ---------- TDD SLICE 2: UPH DASHBOARD AGGREGATION ----------
test("TDD/DASHBOARD: agregasi UPH per jam menjumlah scan hari ini", async () => {
  const MODEL_DASH_FULL = "TDAD-" + uniq + "LOOP"; // slice(-5) -> "TDAD-<uniq>"
  const ord = "ORDD-" + uniq;
  const sub = "LINE DASH IDU ASSY " + uniq;
  const PO = "PO-DASH-" + uniq;

  const rModel = await api("POST", "/model/post", { brand: "B-DASH", model: MODEL_DASH_FULL.slice(0, -5), pk: 1 });
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
  assert.strictEqual(after.status, 200);
  assert.strictEqual(after.data.total, 0, "scan harus ikut terhapus (no orphan)");
});

// ---------- TDD SLICE 4: AUTH REFRESH FLOW ----------
test("TDD/REFRESH: login -> akses -> refresh -> akses lagi, token invalid -> 401", async () => {
  const u = "refl-" + uniq;
  const reg = await api("POST", "/users/regist", {
    username: u, password: "refpass1", email: "ref@t.id", roleuser: "superuser", departement: "QA", section: "T",
  });
  assert.strictEqual(reg.status, 201);
  track("users", reg.data.user?.id);

  const login = await api("POST", "/login", { username: u, password: "refpass1" });
  assert.strictEqual(login.status, 200);
  const at = login.data.accessToken;
  const rt = login.data.refreshToken;
  assert.ok(at && rt, "must return access + refresh token");

  let r = await api("GET", "/pin", undefined, at);
  assert.strictEqual(r.status, 200, "access token harus lolos");

  const rf = await api("POST", "/login/refresh_token", { refreshToken: rt });
  assert.strictEqual(rf.status, 200, "refresh valid harus 200");
  assert.ok(rf.data.accessToken, "harus ada access token baru");

  r = await api("GET", "/pin", undefined, rf.data.accessToken);
  assert.strictEqual(r.status, 200, "token hasil refresh harus lolos");

  r = await api("POST", "/login/refresh_token", { refreshToken: "garbage-token" });
  assert.strictEqual(r.status, 401, "refresh token invalid harus 401");

  r = await api("POST", "/login/refresh_token", {});
  assert.strictEqual(r.status, 401, "tanpa refresh token harus 401");
});

// ---------- PRODUCT CATEGORIES ----------
test("PRODUCT_CATEGORIES: CRUD + slug unique", async () => {
  const slug = "tdd-cat-" + uniq;
  let r = await api("POST", "/product-categories/post", { slug, name: "TDD Cat", suffix_length: 4 });
  assert.strictEqual(r.status, 201);
  const catId = r.data.data?.id;
  assert.ok(catId);
  track("product_categories", catId);

  // duplicate slug -> 400
  r = await api("POST", "/product-categories/post", { slug, name: "Dup" });
  assert.strictEqual(r.status, 400);

  r = await api("GET", "/product-categories");
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.data.data));
  assert.ok(r.data.data.some((c) => c.slug === slug));

  r = await api("PUT", "/product-categories/edit/" + catId, { name: "TDD Cat Edited", suffix_length: 5 });
  assert.strictEqual(r.status, 200);

  r = await api("DELETE", "/product-categories/delete/" + catId);
  assert.strictEqual(r.status, 200);
});

test("COMPONENTS: CRUD dinamis per kategori + validasi washing", async () => {
  const slug = "washing-tdd-" + uniq;
  let r = await api("POST", "/product-categories/post", { slug, name: "Washing TDD", suffix_length: 5 });
  assert.strictEqual(r.status, 201);
  const catId = r.data.data?.id;
  track("product_categories", catId);

  // buat komponen wajib + opsional
  r = await api("POST", "/components/post", { category_id: catId, key: "sn_drum", label: "SN Drum", required: true, sort: 1 });
  assert.strictEqual(r.status, 201);
  const compId1 = r.data.data?.id;
  track("components", compId1);

  r = await api("POST", "/components/post", { category_id: catId, key: "sn_pump", label: "SN Pump", required: false, sort: 2 });
  assert.strictEqual(r.status, 201);
  track("components", r.data.data?.id);

  // duplicate key di kategori sama -> 400
  r = await api("POST", "/components/post", { category_id: catId, key: "sn_drum", label: "Dup" });
  assert.strictEqual(r.status, 400);

  // GET filter by slug
  r = await api("GET", "/components?slug=" + slug);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.data.length, 2);

  // GET filter by category_id
  r = await api("GET", "/components?category_id=" + catId);
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.data.some((c) => c.key === "sn_drum"));

  // edit komponen
  r = await api("PUT", "/components/edit/" + compId1, { label: "SN Drum Updated", required: true });
  assert.strictEqual(r.status, 200);

  // siapkan BOM rule yang mendeklarasikan komponen dinamis washing
  const wOrd = "WASHORD-" + uniq;
  const rb = await api("POST", "/bomlist/post", {
    model: MODEL_SHORT, order_number: wOrd, sn: SN,
    components: {
      sn_drum: { label: "SN Drum", prefix: "DRM", required: true },
      sn_pump: { label: "SN Pump", prefix: "PMP", required: false },
    },
  });
  track("bomlist", rb.data?.data?.id);

  // tanpa komponen wajib sn_drum -> 400
  r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: wOrd, po_number: "PO-" + uniq, subline: "LINE WASHING INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN, sn_pump: "PMP-" + uniq,
  });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /sn_drum|Wajib diisi/);

  // dengan komponen wajib -> 201
  r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: wOrd, po_number: "PO-" + uniq, subline: "LINE WASHING INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN, sn_drum: "DRM-" + uniq, sn_pump: "PMP-" + uniq,
  });
  assert.strictEqual(r.status, 201);
  const washRegistId = r.data.result?.id;
  track("registscan", washRegistId);

  // scan dengan komponen dinamis
  r = await api("POST", "/rdps/post", { id_regist: washRegistId, sn_drum: "DRM-" + uniq, sn_pump: "PMP-" + uniq, sn: SN });
  assert.strictEqual(r.status, 201);
  track("recordscan", r.data.data?.id);

  // cleanup komponen & kategori (hapus record/regist dulu sudah di track, hapus bom)
  r = await api("DELETE", "/components/delete/" + compId1);
  assert.strictEqual(r.status, 200);
});

// ---------- TDD SLICE: BULK IMPORT + SOFT-DELETE BOM ----------
test("TDD/IMPORT: import scan divalidasi BOM + hanya superuser", async () => {
  const ord = "ORDIMP-" + uniq;
  const pre = "IMP-" + uniq;
  await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn: pre });
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ord, po_number: "PO-IMP-" + uniq,
    userid: "u_imp_" + uniq, shift: "1", plan: 10, sn: pre + "0001",
  });
  assert.strictEqual(r.status, 201);
  const rid = r.data.result.id;
  track("registscan", rid);

  // ppc tidak boleh import (tanpa registscan:import-sn)
  const denied = await api("POST", "/rdps/import", {
    id_regist: rid, rows: [{ sn: pre + "0001" }],
  }, token("ppc"));
  assert.strictEqual(denied.status, 403, "ppc tanpa import-sn harus 403");

  // baris tidak sesuai BOM -> 400, transaction rollback
  const bad = await api("POST", "/rdps/import", {
    id_regist: rid, rows: [{ sn: "ZZZ-NOT-MATCH" }],
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
    userid: "owner_" + uniq, shift: "1", plan: 5, sn,
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

// ---------- LOGIN RATE LIMIT (lockout per akun; self-clean agar tak ganggu test lain) ----------
test("AUTH/LOCKOUT: 5 gagal login -> 429 (rate limit)", async () => {
  const u = "lock_" + uniq;
  for (let i = 0; i < 5; i++) {
    const r = await api("POST", "/login", { username: u, password: "wrong" });
    assert.strictEqual(r.status, 401, "percobaan gagal ke-" + (i + 1));
  }
  const locked = await api("POST", "/login", { username: u, password: "wrong" });
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

  // token dengan section berbeda -> subline registscan ikut section JWT (tanpa login nyata)
  const tokenIn = token("superuser", IN);
  const tokenOut = token("superuser", OUT);

  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ord, sn });
  track("bomlist", rb.data?.data?.id);

  const mkRegist = async (t, u) => {
    const r = await api("POST", "/registscan/post", {
      model: MODEL_FULL, order_number: ord, po_number: "PO-SEQ-" + uniq,
      userid: "u_seq_" + uniq, shift: "1", plan: 5, sn,
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
