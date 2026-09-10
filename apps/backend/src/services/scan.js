const { accuracyPercent, MIN_ACCURACY_PERCENT } = require("../rules/accuracy");
const { assertCanAccessRegistration } = require("./registration-access");
const { findBomlist, loadTypedBom, registrationSpec } = require("./registration");
const { assertPrefixes, validatePayload, typedData, scanDelegate } = require("./category-specs");
const AppError = require("../../lib/AppError");

const REQUIRED_AC_STAGES = [
  "LINE IDU ASSY INPUT", "LINE IDU ASSY OUTPUT", "LINE ODU ASSY INPUT", "LINE ODU ASSY OUTPUT",
  "LINE IDU TESTING INPUT", "LINE IDU TESTING OUTPUT", "LINE ODU TESTING INPUT", "LINE ODU TESTING OUTPUT",
  "LINE IDU PACKING INPUT", "LINE ODU PACKING INPUT",
];
const REQUIRED_WM_STAGES = [
  "LINE WM ASSY INPUT", "LINE WM ASSY OUTPUT", "LINE WM PACKING INPUT",
];

async function lockRegistration(tx, id) {
  const rows = await tx.$queryRaw`SELECT id FROM registscan WHERE id = ${id}::uuid FOR UPDATE`;
  if (!rows.length) throw new AppError("Regist tidak ditemukan", 404, "REGIST_NOT_FOUND");
}

function assertAccuracy(spec, payload, fields) {
  for (const field of fields) {
    const expected = spec?.[field.key];
    const actual = payload[field.key];
    if (expected && actual && accuracyPercent(expected, actual) <= MIN_ACCURACY_PERCENT) {
      throw new AppError(`Akurasi scan tidak sama butuh lebih ${MIN_ACCURACY_PERCENT}%, akurasi ${field.key}: ${accuracyPercent(expected, actual).toFixed(2)}%`, 400, "LOW_ACCURACY");
    }
  }
}

// Port aturan panjang dari form scan lama (minLength/maxLength = panjang nilai
// referensi yang tercatat saat registrasi). Field tanpa referensi tidak divalidasi.
function assertLengths(reference, payload, fields) {
  for (const field of fields) {
    const expected = reference?.[field.key];
    const actual = payload[field.key];
    if (!expected || !actual) continue;
    if (String(actual).trim().length !== String(expected).length) {
      throw new AppError(`Panjang ${field.label} harus ${String(expected).length} karakter (sesuai registrasi)`, 400, "LENGTH_MISMATCH");
    }
  }
}
async function assertNoDuplicate(tx, category, idRegist, payload, fields) {
  const delegate = scanDelegate(category, tx);
  for (const field of fields) {
    const value = payload[field.key];
    if (!value) continue;
    const found = await delegate.findFirst({ where: { id_regist: idRegist, [field.key]: { equals: String(value).trim().toUpperCase(), mode: "insensitive" } } });
    if (found) throw new AppError(`Double scan ${field.key} di satu regist`, 400, "DOUBLE_SCAN");
  }
}

async function batchStagesFor(tx, registration) {
  const rows = await tx.registscan.findMany({
    where: {
      model: registration.model,
      order_number: registration.order_number,
      po_number: registration.po_number,
      product_category: registration.product_category,
    },
    select: { subline: true },
  });
  return new Set(rows.map((row) => row.subline.toUpperCase().trim()));
}

async function assertStageOrder(tx, registration, payload) {
  const category = registration.product_category;
  if (!['ac', 'wm'].includes(category) || !payload.sn) return;
  const sn = String(payload.sn).trim().toUpperCase();
  const rows = category === "ac"
    ? await tx.$queryRaw`
        SELECT r.subline FROM recordscan_ac s
        JOIN registscan r ON r.id = s.id_regist
        WHERE s.sn = ${sn}
      `
    : await tx.$queryRaw`
        SELECT r.subline FROM recordscan_wm s
        JOIN registscan r ON r.id = s.id_regist
        WHERE s.sn = ${sn}
      `;
  const line = registration.subline.toUpperCase().trim();
  if (rows.some((row) => row.subline.toUpperCase() === line)) throw new AppError(`Double Scan di ${registration.subline}`, 400, "DOUBLE_SCAN");
  if (line.endsWith("OUTPUT") && !line.includes("PACKING OUTPUT")) {
    const input = line.replace(/OUTPUT$/, "INPUT").trim();
    if (!rows.some((row) => row.subline.toUpperCase() === input)) throw new AppError(`unit belum di-scan di ${input} - scan input dulu sebelum output`, 400, "ORDER_VIOLATION");
  }
  if (line.includes("PACKING")) {
    const unit = line.includes("IDU") ? "IDU" : line.includes("ODU") ? "ODU" : null;
    const assemblyStages = category === "wm"
      ? ["LINE WM ASSY INPUT", "LINE WM ASSY OUTPUT"]
      : unit
        ? [`LINE ${unit} ASSY INPUT`, `LINE ${unit} ASSY OUTPUT`]
        : [];
    const configuredStages = await batchStagesFor(tx, registration);
    const stagesToCheck = assemblyStages.filter((stage) => configuredStages.has(stage));
    for (const stage of stagesToCheck) {
      if (!rows.some((row) => row.subline.toUpperCase() === stage)) {
        throw new AppError(`unit belum melalui ${stage} sebelum packing`, 400, "ORDER_VIOLATION");
      }
    }
  }
  if (line.includes("PACKING OUTPUT")) {
    const batchStages = await tx.registscan.findMany({ where: { model: registration.model, order_number: registration.order_number, po_number: registration.po_number, product_category: category }, select: { subline: true } });
    const requiredStages = category === "wm" ? REQUIRED_WM_STAGES : REQUIRED_AC_STAGES;
    for (const stage of requiredStages) {
      if (batchStages.some((row) => row.subline.toUpperCase() === stage) && !rows.some((row) => row.subline.toUpperCase() === stage)) {
        throw new AppError(`unit terlewat scan kembali di ${stage}`, 400, "MISSED_STAGE");
      }
    }
  }
}

async function createScan(tx, { user, id_regist, payload }) {
  await lockRegistration(tx, id_regist);
  const registration = await tx.registscan.findUnique({ where: { id: id_regist } });
  assertCanAccessRegistration(user, registration);
  const { category, spec: bomSpec } = await loadTypedBom(tx, await findBomlist(tx, registration.model, registration.order_number));
  if (category !== registration.product_category) throw new AppError("Kategori BOM tidak cocok dengan registrasi", 400, "CATEGORY_MISMATCH");
  const fields = validatePayload(category, bomSpec, payload, { skipPrefix: true });
  const reference = await registrationSpec(tx, category, registration.id);
  assertLengths(reference, payload, fields);
  assertAccuracy(reference, payload, fields);
  await assertStageOrder(tx, registration, payload);
  await assertNoDuplicate(tx, category, registration.id, payload, fields);
  assertPrefixes(fields, payload);
  const count = await scanDelegate(category, tx).count({ where: { id_regist: registration.id } });
  if (registration.plan && count >= registration.plan) throw new AppError("Target plan registrasi sudah tercapai", 400, "PLAN_REACHED");
  const created = await scanDelegate(category, tx).create({ data: { id_regist: registration.id, ...typedData(category, payload) } });
  return { created, brand: null, po: registration.po_number, odf: registration.order_number, model: registration.model, unit: {} };
}

module.exports = { createScan, assertLengths, REQUIRED_AC_STAGES, REQUIRED_WM_STAGES };
