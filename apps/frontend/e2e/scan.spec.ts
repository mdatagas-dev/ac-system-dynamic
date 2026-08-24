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
    data: { model: modelFull, order_number: order, po_number: `PO-${uniq}`, subline: "LINE IDU ASSY INPUT", userid: "e2e", shift: "1", plan: 5, sn, sn_odu: `ODU-${uniq}`, pcb_idu: `PCB-${uniq}`, sn_accessories: `ACC-${uniq}`, sn_motor: `MTR-${uniq}`, sn_box: `BOX-${uniq}`, sn_carton: `CTN-${uniq}` },
  });
  expect(reg.status()).toBe(201);
  const regId = (await reg.json()).result.id;

  try {
    await login(page);
    await page.goto(`/scan?idregist=${regId}`);

    // scan SN + komponen IDU (auto pindah tanpa Enter, terakhir Enter = auto submit)
    await page.getByLabel("Serial Number").fill(sn);
    // untuk IDU, auto pindah aktif: setelah SN terisi, fokus ke PCB, tapi isi manual juga oke
    await page.getByLabel("PCB IDU").fill(`PCB-${uniq}`);
    await page.getByLabel("SN Accessories").fill(`ACC-${uniq}`);
    await page.getByLabel("SN Accessories").press("Enter");

    // hasil tampil
    await expect(page.getByText(sn)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Berhasil/i)).toBeVisible();
  } finally {
    // cleanup: jangan bikin test fail kalau cleanup error (request context bisa sudah closed)
    try {
      const hist = await request.get(`${base}/rdps/history?limit=100`, {
        headers: { ...auth, idregist: regId },
      });
      if (hist.status() === 200) {
        const records: Array<{ id: string; sn: string }> = (await hist.json()).data ?? [];
        for (const r of records.filter((x) => x.sn === sn)) {
          try { await request.delete(`${base}/rdps/delete/${r.id}`, { headers: auth }); } catch {}
        }
      }
      try { await request.delete(`${base}/registscan/delete/${regId}`, { headers: auth }); } catch {}
      try { await request.delete(`${base}/bomlist/delete/${bomId}`, { headers: auth }); } catch {}
    } catch {}
  }
});
