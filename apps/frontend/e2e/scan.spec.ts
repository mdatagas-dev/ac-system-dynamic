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

  // setup: model master + bomlist (BOM-driven) + registscan
  const cat = await request.post(`${base}/product-categories/post`, {
    headers: auth,
    data: { slug: `e2e-scan-cat-${uniq}`, name: `E2E Scan Cat ${uniq}` },
  });
  expect(cat.status()).toBe(201);
  const catId = (await cat.json()).data.id;
  const mkModel = await request.post(`${base}/model/post`, { headers: auth, data: { brand: "E2E Brand", model: modelShort, pk: 1, category_id: catId } });
  expect(mkModel.status()).toBe(200);
  const modelId = (await mkModel.json()).data.id;

  const bom = await request.post(`${base}/bomlist/post`, {
    headers: auth,
    data: { model: modelShort, order_number: order, sn, pcb_idu: `PCB-${uniq}`, sn_accessories: `ACC-${uniq}` },
  });
  expect(bom.status()).toBe(200);
  const bomId = (await bom.json()).data.id;

  const reg = await request.post(`${base}/registscan/post`, {
    headers: auth,
    data: { model: modelFull, order_number: order, po_number: `PO-${uniq}`, subline: "LINE IDU ASSY INPUT", userid: "e2e", shift: "1", plan: 5, sn, pcb_idu: `PCB-${uniq}`, sn_accessories: `ACC-${uniq}` },
  });
  expect(reg.status()).toBe(201);
  const regId = (await reg.json()).result.id;

  try {
    await login(page);
    await page.goto(`/scan?idregist=${regId}`);

    // scan SN + komponen IDU — field dari BOM rule (auto pindah tanpa Enter, terakhir Enter = auto submit)
    await page.getByLabel("Serial Number").fill(sn);
    await page.getByLabel("SN PCB").fill(`PCB-${uniq}`);
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
      try { await request.delete(`${base}/model/delete/${modelId}`, { headers: auth }); } catch {}
      try { await request.delete(`${base}/product-categories/delete/${catId}`, { headers: auth }); } catch {}
    } catch {}
  }
});
