const { unitFromSubline } = require("../rules/unit");
const { accuracyPercent, MIN_ACCURACY_PERCENT } = require("../rules/accuracy");
const { assertCanAccessRegistration } = require("./registration-access");
const { findBomlist, loadTypedBom, registrationSpec } = require("./registration");
const { validatePayload, typedData, scanDelegate } = require("./category-specs");
const AppError = require("../../lib/AppError");

const REQUIRED_AC_STAGES = [
  "LINE IDU ASSY INPUT", "LINE IDU ASSY OUTPUT", "LINE ODU ASSY INPUT", "LINE ODU ASSY OUTPUT",
  "LINE IDU TESTING INPUT", "LINE IDU TESTING OUTPUT", "LINE ODU TESTING INPUT", "LINE ODU TESTING OUTPUT",
  "LINE IDU PACKING INPUT", "LINE ODU PACKING INPUT",
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

async function assertNoDuplicate(tx, category, idRegist, payload, fields) {
  const delegate = scanDelegate(category, tx);
  for (const field of fields) {
    const value = payload[field.key];
    if (!value) continue;
    const found = await delegate.findFirst({ where: { id_regist: idRegist, [field.key]: { equals: String(value).trim().toUpperCase(), mode: "insensitive" } } });
    if (found) throw new AppError(`Double scan ${field.key} di satu regist`, 400, "DOUBLE_SCAN");
  }
}

async function assertAcStageOrder(tx, registration, payload) {
  if (registration.product_category !== "ac" || !payload.sn) return;
  const rows = await tx.$queryRaw`
    SELECT r.subline FROM recordscan_ac s
    JOIN registscan r ON r.id = s.id_regist
    WHERE s.sn = ${String(payload.sn).trim().toUpperCase()}
  `;
  const line = registration.subline.toUpperCase().trim();
  if (rows.some((row) => row.subline.toUpperCase() === line)) throw new AppError(`Double Scan di ${registration.subline}`, 400, "DOUBLE_SCAN");
  if (line.endsWith("OUTPUT") && !line.includes("PACKING OUTPUT")) {
    const input = line.replace(/OUTPUT$/, "INPUT").trim();
    if (!rows.some((row) => row.subline.toUpperCase() === input)) throw new AppError(`unit belum di-scan di ${input} - scan input dulu sebelum output`, 400, "ORDER_VIOLATION");
  }
  if (line.includes("PACKING OUTPUT")) {
    const batchStages = await tx.registscan.findMany({ where: { model: registration.model, order_number: registration.order_number, po_number: registration.po_number, product_category: "ac" }, select: { subline: true } });
    for (const stage of REQUIRED_AC_STAGES) {
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
  const fields = validatePayload(category, bomSpec, payload, unitFromSubline(registration.subline));
  const reference = await registrationSpec(tx, category, registration.id);
  assertAccuracy(reference, payload, fields);
  await assertAcStageOrder(tx, registration, payload);
  await assertNoDuplicate(tx, category, registration.id, payload, fields);
  const count = await scanDelegate(category, tx).count({ where: { id_regist: registration.id } });
  if (registration.plan && count >= registration.plan) throw new AppError("Target plan registrasi sudah tercapai", 400, "PLAN_REACHED");
  const created = await scanDelegate(category, tx).create({ data: { id_regist: registration.id, ...typedData(category, payload) } });
  return { created, brand: null, po: registration.po_number, odf: registration.order_number, model: registration.model, unit: {} };
}

module.exports = { createScan, REQUIRED_AC_STAGES };
