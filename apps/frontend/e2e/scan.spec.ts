import { test, expect } from "@playwright/test";
import { login, apiLogin } from "./helpers";

/**
 * Alur scan: setup data via API → scan via UI → hasil tampil → cleanup.
 */
test("alur scan: regist via API, scan via UI, hasil muncul", async ({ page, request }) => {
  const token = await apiLogin(request);
  const uniq = Date.now().toString(36);
  const modelShort = `E2E-${uniq}`;
  const modelFull = `${modelShort}12345`;
  const order = `E2E-${uniq}`;
  const sn = `E2E-SN-${uniq}`;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const base = "http://localhost:3010";

  // setup: bomlist + registscan
  const bom = await request.post(`${base}/bomlist/post`, { headers: auth, data: { model: modelShort, order_number: order, sn } });
  expect(bom.status()).toBe(200);
  const bomId = (await bom.json()).data.id;

  const reg = await request.post(`${base}/registscan/post`, {
    headers: auth,
    data: { model: modelFull, order_number: order, po_number: `PO-${uniq}`, subline: "LINE E2E", userid: "e2e", shift: "1", plan: 5, sn, sn_motor: "", sn_box: "", pcb_idu: "", sn_carton: "", sn_accessories: "" },
  });
  expect(reg.status()).toBe(201);
  const regId = (await reg.json()).result.id;

  try {
    await login(page);
    await page.goto("/scan");

    // pilih registrasi: buka select → klik option
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: new RegExp(`${modelShort}12345`) }).click();

    // scan SN
    await page.getByLabel("Serial Number").fill(sn);
    await page.getByRole("button", { name: "Simpan Scan" }).click();

    // hasil tampil
    await expect(page.getByText(sn)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Berhasil/i)).toBeVisible();
  } finally {
    // cleanup: hapus semua recordscan milik regist ini (via history), lalu regist & bomlist
    const hist = await request.get(`${base}/rdps/history?limit=100`, {
      headers: { ...auth, idregist: regId },
    });
    if (hist.status() === 200) {
      const records: Array<{ id: string; sn: string }> = (await hist.json()).data ?? [];
      for (const r of records.filter((x) => x.sn === sn)) {
        await request.delete(`${base}/rdps/delete/${r.id}`, { headers: auth });
      }
    }
    await request.delete(`${base}/registscan/delete/${regId}`, { headers: auth });
    await request.delete(`${base}/bomlist/delete/${bomId}`, { headers: auth });
  }
});
