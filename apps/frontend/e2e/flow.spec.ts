import { test, expect } from "@playwright/test";
import { login, apiLogin } from "./helpers";

/**
 * Full flow: ADMIN regist kategori+template, model, bomlist (via API)
 * → OPERATOR (ppc) regist batch + scan (via UI)
 * → VALIDATION: prefix salah ditolak, double scan ditolak, hasil tampil.
 */
test("flow: admin regist model+bomlist → operator scan → validation", async ({ page, request }) => {
  const cookie = await apiLogin(request); // session admin (superuser)
  const uniq = Date.now().toString(36);
  const modelShort = `FLOW-${uniq}`;
  const modelFull = `${modelShort}12345`; // 5-char suffix brand
  const order = `ORD-${uniq}`;
  const po = `PO-${uniq}`;
  const snPrefix = `SN${uniq.toUpperCase().slice(0, 4)}`;
  const snGood = `${snPrefix}-0001`;
  const snBad = `WRONG-${uniq}`;
  const auth = { Cookie: cookie, "Content-Type": "application/json" };
  const base = "http://localhost:3010";

  // ---------- ADMIN: kategori + template material ----------
  const cat = await request.post(`${base}/product-categories/post`, {
    headers: auth,
    data: {
      slug: `flow-cat-${uniq}`,
      name: `Flow Cat ${uniq}`,
      fields: [
        { key: "sn", label: "Serial Number" },
        { key: "pcb_idu", label: "SN PCB", unit: "IDU" },
      ],
    },
  });
  expect(cat.status()).toBe(201);
  const catId = (await cat.json()).data.id;

  // ---------- ADMIN: model master (nama pendek — operator mengetik versi lengkap dgn suffix saat regist) ----------
  const mkModel = await request.post(`${base}/model/post`, {
    headers: auth,
    data: { brand: "FLOW", model: modelShort, pk: 1, category_id: catId },
  });
  expect(mkModel.status(), `model post gagal: ${await mkModel.text()}`).toBe(200);
  const modelId = (await mkModel.json()).data.id;

  // ---------- ADMIN: bomlist (prefix values per order) ----------
  const bom = await request.post(`${base}/bomlist/post`, {
    headers: auth,
    data: { model: modelShort, order_number: order, sn: snPrefix, pcb_idu: `PCB${uniq.toUpperCase().slice(0, 4)}` },
  });
  expect(bom.status()).toBe(200);
  const bomId = (await bom.json()).data.id;

  // ---------- OPERATOR (ppc): regist batch via UI ----------
  await login(page, "e2e_ppc");
  await page.goto("/regist");
  await page.getByRole("button", { name: /^Create$/i }).click();

  const modelInput = page.getByLabel(/Model/);
  await modelInput.click();
  // ketik nama model LENGKAP (dgn 5-char suffix) — master/bomlist memegang nama pendek
  await modelInput.fill(modelFull);
  await page.getByLabel("Order Number").fill(order);
  await page.getByLabel("PO Number").fill(po);
  await page.getByLabel("Plan").fill("2");

  // field dari template: sn (prefix SN####) + pcb_idu (prefix PCB####)
  await page.getByLabel("Serial Number").fill(snGood);
  await page.getByLabel("SN PCB").fill(`PCB${uniq.toUpperCase().slice(0, 4)}-01`);
  await page.getByRole("button", { name: "Simpan" }).click();

  // batch dibuat → halaman auto pindah ke /scan dengan info batch
  await expect(page).toHaveURL(/\/scan\?idregist=/, { timeout: 15_000 });
  await expect(page.getByText(modelFull).first()).toBeVisible();

  // ambil regId untuk masuk ke halaman scan
  const checkRegist = await request.get(`${base}/registscan?limit=5&keyword=${order}`, { headers: auth });
  const regId = (await checkRegist.json()).data?.[0]?.id;
  expect(regId).toBeTruthy();

  // ---------- VALIDATION: prefix salah ditolak (popup merah, tutup dgn OK) ----------
  // tunggu transisi halaman selesai — AnimatePresence me-render dua halaman sebentar
  await expect(page.getByLabel("SN PCB")).toHaveCount(1);
  const snField = page.getByLabel("Serial Number");
  const pcbField = page.getByLabel("SN PCB");
  await snField.fill(snBad);
  await expect(snField).toHaveValue(snBad);
  await pcbField.fill(`PCB${uniq.toUpperCase().slice(0, 4)}-01`);
  await expect(pcbField).toHaveValue(`PCB${uniq.toUpperCase().slice(0, 4)}-01`);
  await pcbField.press("Enter");
  await expect(page.getByText("Scan Gagal")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/tidak sesuai BOM/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  // ---------- OPERATOR: scan benar → sukses (popup hijau auto-tutup ~1.2s) ----------
  await snField.fill(snGood);
  await expect(snField).toHaveValue(snGood);
  await pcbField.fill(`PCB${uniq.toUpperCase().slice(0, 4)}-01`);
  await expect(pcbField).toHaveValue(`PCB${uniq.toUpperCase().slice(0, 4)}-01`);
  await pcbField.press("Enter");
  await expect(page.getByText(/Berhasil/i)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500); // tunggu popup sukses menutup sebelum scan ulang

  // ---------- VALIDATION: double scan di regist sama ditolak ----------
  // reload agar form bersih dari state auto-focus/auto-advance sebelumnya
  await page.reload();
  await expect(page.getByLabel("SN PCB")).toHaveCount(1);
  await page.getByLabel("Serial Number").fill(snGood);
  await page.getByLabel("SN PCB").fill(`PCB${uniq.toUpperCase().slice(0, 4)}-01`);
  await page.getByLabel("SN PCB").press("Enter");
  await expect(page.getByText(/Double scan/i)).toBeVisible({ timeout: 15_000 });

  // cleanup (best-effort)
  await request.delete(`${base}/registscan/delete/${regId}`, { headers: auth }).catch(() => {});
  await request.delete(`${base}/bomlist/delete/${bomId}`, { headers: auth }).catch(() => {});
  await request.delete(`${base}/model/delete/${modelId}`, { headers: auth }).catch(() => {});
  await request.delete(`${base}/product-categories/delete/${catId}`, { headers: auth }).catch(() => {});
});