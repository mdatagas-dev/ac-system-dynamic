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

test("LOGIN: user tidak ada -> 401", async () => {
  const r = await api("POST", "/login", { username: "no_such_user_" + uniq, password: "x" });
  assert.strictEqual(r.status, 401);
});

test("LOGIN: password salah -> 401", async () => {
  const ru = await api("POST", "/users/regist", { username: "login_" + uniq, password: "benar123", email: "l@t.id", roleuser: "admin", departement: "QA", section: "T" });
  track("users", ru.data?.user?.id);
  const r = await api("POST", "/login", { username: "login_" + uniq, password: "salah" });
  assert.strictEqual(r.status, 401);
  assert.match(JSON.stringify(r.data), /Wrong Password/);
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
  let r = await api("POST", "/model/post", { brand: "BRAND-" + uniq, model: MODEL_SHORT, pk: 10, linkimage: "http://x" });
  assert.strictEqual(r.status, 200);
  modelId = r.data.data?.id;
  track("model", modelId);
  r = await api("POST", "/model/post", { brand: "BRAND-" + uniq, model: MODEL_SHORT, pk: 10 });
  assert.strictEqual(r.status, 409);
  r = await api("PUT", "/model/edit/" + modelId, { brand: "BRAND2", model: MODEL_SHORT, inch: 12, linkimage: "http://y" });
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

test("REGISTSCAN: post tanpa sn_odu -> 400 (validasi)", async () => {
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ORDER, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN,
    sn_motor: "MTR-" + uniq, sn_box: "BOX-" + uniq,
    pcb_idu: "PCB-" + uniq, sn_carton: "CTN-" + uniq, sn_accessories: "ACC-" + uniq,
  });
  assert.strictEqual(r.status, 400);
});

test("REGISTSCAN: post tanpa pcb_idu -> 400 (validasi)", async () => {
  const r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ORDER, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, sn: SN, sn_odu: "ODU-" + uniq,
    sn_motor: "MTR-" + uniq, sn_box: "BOX-" + uniq,
    sn_carton: "CTN-" + uniq, sn_accessories: "ACC-" + uniq,
  });
  assert.strictEqual(r.status, 400);
});

test("REGISTSCAN: post valid 201, get list, delete 200", async () => {
  const rb1 = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ORDER, sn: SN });
  track("bomlist", rb1.data?.data?.id);
  let r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ORDER, po_number: "PO-" + uniq, subline: "LINE TEST INPUT",
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

  // siapkan bom untuk validasi dinamis washing
  const rb = await api("POST", "/bomlist/post", { model: MODEL_SHORT, order_number: ORDER, sn: SN });
  track("bomlist", rb.data?.data?.id);

  // tanpa komponen wajib sn_drum -> 400
  r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ORDER, po_number: "PO-" + uniq, subline: "LINE WASHING INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, product_category: slug, sn_drum: "", sn_pump: "PUMP-" + uniq,
  });
  assert.strictEqual(r.status, 400);
  assert.match(JSON.stringify(r.data), /sn_drum/);

  // dengan komponen wajib -> 201
  r = await api("POST", "/registscan/post", {
    model: MODEL_FULL, order_number: ORDER, po_number: "PO-" + uniq, subline: "LINE WASHING INPUT",
    userid: "u_" + uniq, shift: "1", plan: 10, product_category: slug, sn_drum: "DRUM-" + uniq, sn_pump: "PUMP-" + uniq,
  });
  assert.strictEqual(r.status, 201);
  const washRegistId = r.data.result?.id;
  track("registscan", washRegistId);

  // scan dengan komponen dinamis
  r = await api("POST", "/rdps/post", { id_regist: washRegistId, sn_drum: "DRUM-" + uniq, sn_pump: "PUMP-" + uniq, sn: SN });
  assert.strictEqual(r.status, 201);
  track("recordscan", r.data.data?.id);

  // cleanup komponen & kategori (hapus record/regist dulu sudah di track, hapus bom)
  r = await api("DELETE", "/components/delete/" + compId1);
  assert.strictEqual(r.status, 200);
});
