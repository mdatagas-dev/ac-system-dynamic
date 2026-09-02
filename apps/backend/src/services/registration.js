// Validasi payload registrasi terhadap BOM rule batch (satu baris per model+order_number).
// Struktur field datang dari TEMPLATE kategori (product_categories.fields); baris bomlist
// memegang nilai prefix. Lempar AppError bila tidak cocok.

const prisma = require("../../lib/prisma");
const { missingRequired, findBomMismatch, unknownKeys, ruleFields } = require("../rules/bom-match");
const { stripBrandSuffix } = require("../rules/model-code");
const AppError = require("../../lib/AppError");

const NO_TEMPLATE_MSG = "Batch has no field template — set the category template in Master Data";

/**
 * Ambil template kategori untuk baris bomlist dan tempelkan sebagai rule.fields.
 * Hard error bila slug kosong atau template belum dibuat (cutover template-is-law).
 */
async function withTemplate(db, bomRow) {
  const slug = bomRow && bomRow.product_category;
  if (!slug) throw new AppError(NO_TEMPLATE_MSG, 400, "NO_TEMPLATE");
  const cat = await db.product_categories.findUnique({
    where: { slug },
    select: { fields: true },
  });
  if (!cat || !Array.isArray(cat.fields) || cat.fields.length === 0) {
    throw new AppError(NO_TEMPLATE_MSG, 400, "NO_TEMPLATE");
  }
  return { ...bomRow, fields: cat.fields };
}

async function resolveBomRule({ model, order_number, payload }) {
  const modelOnly = stripBrandSuffix(String(model).trim());
  const bomRow = await prisma.bomlist.findFirst({
    where: { model: modelOnly, order_number: order_number.trim(), is_active: true },
  });
  if (!bomRow) throw new AppError("Batch tidak ada di bomlist", 404, "BOMLIST_NOT_FOUND");
  const rule = await withTemplate(prisma, bomRow);

  const missing = missingRequired(rule, payload);
  if (missing) throw new AppError(`Wajib diisi: ${missing.label}`, 400, "MISSING_REQUIRED");
  const mismatch = findBomMismatch(rule, payload);
  if (mismatch) {
    throw new AppError(`${mismatch.key} tidak sesuai BOM (diharapkan mengandung: ${mismatch.expected})`, 400, "BOM_MISMATCH");
  }
  const unknown = unknownKeys(rule, payload);
  if (unknown.length) throw new AppError(`Field tidak dikenal BOM: ${unknown.join(", ")}`, 400, "UNKNOWN_FIELD");

  // components JSONB = nilai field dinamis yang dideklarasikan BOM
  const components = {};
  for (const f of ruleFields(rule)) {
    const val = payload[f.key];
    if (val !== undefined && val !== null && String(val).trim() !== "") components[f.key] = String(val).trim();
  }
  return { product_category: rule.product_category ?? null, components, fields: rule.fields };
}

module.exports = { resolveBomRule, withTemplate, NO_TEMPLATE_MSG };
