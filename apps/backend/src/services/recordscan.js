// Pure. Membangun data insert/update recordscan dari payload scan/import/edit.
// Kolom SN selalu UPPERCASE; kolom lain di luar kolom tetap + metadata dianggap
// komponen dinamis dan disimpan di JSONB `components` (juga UPPERCASE).

const FIXED_COLUMNS = new Set([
  "sn", "sn_odu", "sn_carton", "pcb_idu", "sn_box", "sn_motor", "sn_accessories",
]);

const METADATA = new Set([
  "id_regist", "product_category", "productCategory", "pn_carton", "components",
]);

const up = (v) => (v ? String(v).toUpperCase() : "");

// Kolom SN standar, dibersihkan & UPPERCASE.
function scanFields(payload) {
  return {
    sn: up(payload.sn),
    sn_odu: up(payload.sn_odu),
    sn_carton: up(payload.sn_carton),
    pcb_idu: up(payload.pcb_idu),
    sn_box: up(payload.sn_box),
    sn_motor: up(payload.sn_motor),
    sn_accessories: up(payload.sn_accessories),
  };
}

// Komponen dinamis: key yang tidak dikenal (atau isi payload.components).
function dynamicComponents(payload) {
  const out = {};
  for (const k of Object.keys(payload)) {
    if (!FIXED_COLUMNS.has(k) && !METADATA.has(k) && payload[k]) out[k] = up(payload[k]);
  }
  const comps = payload.components && typeof payload.components === "object" ? payload.components : {};
  for (const [k, v] of Object.entries(comps)) if (v) out[k] = up(v);
  return out;
}

function productCategory(payload, fallback) {
  return (payload.product_category || payload.productCategory || fallback || "").toString().toLowerCase() || null;
}

// Data lengkap untuk prisma create recordscan (components null bila kosong).
function buildScanRecord(payload, prodCat) {
  const components = dynamicComponents(payload);
  return {
    ...scanFields(payload),
    product_category: prodCat,
    components: Object.keys(components).length ? components : null,
  };
}

module.exports = { buildScanRecord, dynamicComponents, productCategory, scanFields };
