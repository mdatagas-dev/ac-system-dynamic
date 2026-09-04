// Inti bisnis scan: satu transaksi yang memvalidasi lalu menyimpan recordscan.
// Semua rule produksi (double scan, urutan INPUT->OUTPUT, missed scan PACKING,
// akurasi vs registrasi) dievaluasi di sini supaya route /rdps tetap tipis.

const { ruleFieldsForUnit } = require("../rules/bom-match");
const { unitFromSubline } = require("../rules/unit");
const { accuracyPercent, MIN_ACCURACY_PERCENT } = require("../rules/accuracy");
const { buildScanRecord, productCategory } = require("./recordscan");
const { assertCanAccessRegistration } = require("./registration-access");
const { withTemplate, findBomlist } = require("./registration");
const AppError = require("../../lib/AppError");

const isPresent = (v) => v !== undefined && v !== null && v !== "";

// Stage wajib yang harus dilewati unit sebelum PACKING OUTPUT (urutan produksi).
const REQUIRED_STAGES = [
  "LINE IDU ASSY INPUT",
  "LINE IDU ASSY OUTPUT",
  "LINE ODU ASSY INPUT",
  "LINE ODU ASSY OUTPUT",
  "LINE IDU TESTING INPUT",
  "LINE IDU TESTING OUTPUT",
  "LINE ODU TESTING INPUT",
  "LINE ODU TESTING OUTPUT",
  "LINE IDU PACKING INPUT",
  "LINE ODU PACKING INPUT",
];

const KNOWN_SCAN_COLS = new Set([
  "sn", "sn_odu", "sn_carton", "pcb_idu", "sn_box", "sn_motor", "sn_accessories",
]);

// Satu unit dengan nilai material apa pun (PCB/box/motor/...) hanya boleh muncul
// sekali di regist yang sama. Pemeriksaan global (semua kolom scan di payload),
// bukan per-unit: duplikat adalah duplikat di line mana pun.
async function assertNoDoubleScan(tx, id_regist, payload) {
  const optionWhere = [];
  for (const key in payload) {
    const value = payload[key];
    if (value === undefined || value === null || value === "") continue;
    if (!KNOWN_SCAN_COLS.has(key)) continue;
    optionWhere.push({ [key]: { contains: value, mode: "insensitive" } });
  }
  // hanya komponen dinamis (mis. washing sn_drum) -> dummy yang tak match, biar lolos
  if (optionWhere.length === 0) {
    optionWhere.push({ sn: { contains: "__no_match__" } });
  }

  const checkSN = await tx.recordscan.findMany({
    where: {
      AND: [
        { id_regist: { contains: id_regist, mode: "insensitive" } },
        { OR: optionWhere },
      ],
    },
  });
  if (checkSN.length > 0) {
    let sameValue = "";
    for (const key in payload) {
      const value = payload[key];
      if (value === checkSN[0][key] && value !== undefined && value !== "" && value !== null) {
        sameValue = key;
      }
    }
    throw new AppError(`Double scan ${sameValue} di satu regist`, 400, "DOUBLE_SCAN");
  }
}

// Akurasi karakter-per-karakter vs nilai registrasi; ambang nyata adalah
// MIN_ACCURACY_PERCENT (lihat rules/accuracy.js).
function assertAccuracy(valueRegist, payload, relevantKeys) {
  for (const key of relevantKeys) {
    const value = payload[key];
    if (value === undefined || value === null || value === "") continue;
    const regist = valueRegist[key];
    if (regist === undefined || regist === null || regist === "") continue;
    if (accuracyPercent(regist, value) <= MIN_ACCURACY_PERCENT) {
      throw new AppError(
        `Akurasi scan tidak sama butuh lebih ${MIN_ACCURACY_PERCENT}%, akurasi ${key}:  ${accuracyPercent(regist, value).toFixed(2)}%`,
        400,
        "LOW_ACCURACY",
      );
    }
  }
}

/**
 * Simpan satu scan dalam transaksi yang sudah dimulai (tx). Melempar AppError
 * bila melanggar rule produksi; transaksi di-rollback otomatis oleh caller.
 * Validasi BOM/double-scan/akurasi hanya diterapkan pada field material yang
 * unitnya cocok dengan subline (unitFromSubline), plus field tanpa unit.
 */
async function createScan(tx, { user, id_regist, payload }) {
  // kunci baris regist agar dua scan paralel tak balapan
  await tx.$queryRaw`SELECT * FROM "recordscan" WHERE "id_regist" = ${id_regist} FOR UPDATE`;

  const valueRegist = await tx.registscan.findUnique({ where: { id: id_regist } });
  assertCanAccessRegistration(user, valueRegist);

  // BOM check: nilai yang di-scan harus mengikuti BOM rule batch ini
  const bomRule = await findBomlist(tx, valueRegist.model, valueRegist.order_number);
  if (!bomRule) throw new AppError("Batch tidak ada di bomlist", 404, "BOMLIST_NOT_FOUND");
  const rule = await withTemplate(tx, bomRule);

  // field yang relevan untuk unit subline ini (unit null → berlaku semua line)
  const currentUnit = unitFromSubline(valueRegist.subline);
  const unitFields = ruleFieldsForUnit(rule, currentUnit);
  const relevantKeys = unitFields.map((f) => f.key);

  // BOM prefix check — hanya field yang relevan untuk unit ini
  for (const f of unitFields) {
    const scanned = payload[f.key];
    if (isPresent(f.prefix) && isPresent(scanned) && !String(scanned).includes(f.prefix)) {
      throw new AppError(
        `${f.key} tidak sesuai BOM (diharapkan mengandung: ${f.prefix})`,
        400,
        "BOM_MISMATCH",
      );
    }
  }

  const brandtv = await tx.model.findFirst({ where: { model: valueRegist.model } });

  // semua subline yang sudah pernah mencatat SN ini
  const allSubline = await tx.$queryRaw`
    SELECT rgs.subline, rcs.sn
    FROM registscan AS rgs
    JOIN recordscan AS rcs
      ON rgs.id = rcs.id_regist::uuid
    WHERE rcs.sn = ${String(payload.sn || "").trim().toUpperCase()}
  `;

  const currentLine = valueRegist.subline.toUpperCase();
  const alreadyScannedOn = (lineList) =>
    allSubline.some((e) => e.subline.toUpperCase().includes(lineList));

  // double scan: SN sudah pernah di-scan di line yang sama
  if (alreadyScannedOn(currentLine)) {
    const found = allSubline.find((e) => e.subline.toUpperCase().includes(currentLine));
    throw new AppError("Double Scan di " + (found?.subline || currentLine), 400, "DOUBLE_SCAN");
  }

  // Rule: SN harus di-scan di INPUT dulu sebelum bisa di-scan di OUTPUT line yang sama.
  // Pengecualian PACKING OUTPUT (line terminal) - sudah dicek lewat checkMissedScan semua stage.
  const subUpper = valueRegist.subline.toUpperCase().trim();
  if (subUpper.endsWith("OUTPUT") && !subUpper.includes("PACKING OUTPUT")) {
    const inputStage = subUpper.replace(/OUTPUT$/, "INPUT").trim();
    if (!alreadyScannedOn(inputStage)) {
      throw new AppError(
        `unit belum di-scan di ${inputStage} - scan input dulu sebelum output`,
        400,
        "ORDER_VIOLATION",
      );
    }
  }

  let unit = {};
  // jika user regist adalah packing
  if (valueRegist.subline.toUpperCase().includes("PACKING OUTPUT")) {
    const searchRegist = await tx.registscan.findMany({
      select: { subline: true, model: true, po_number: true, order_number: true },
      where: {
        order_number: valueRegist.order_number,
        model: valueRegist.model,
        po_number: valueRegist.po_number,
      },
    });

    // cek apakah unit terlewat di line sebelumnya
    const checkMissedScan = (lineList) => {
      if (
        searchRegist.some((e) => e.subline.toUpperCase().includes(lineList)) &&
        !alreadyScannedOn(lineList)
      ) {
        throw new AppError(`unit terlewat scan kembali di ${lineList}`, 400, "MISSED_STAGE");
      }
    };
    REQUIRED_STAGES.forEach(checkMissedScan);

    // gabungkan material yang pernah terekam untuk unit ini (mainboard, panel, dll.)
    const materialCheck = await tx.recordscan.findMany({
      where: {
        sn: { equals: payload.sn, mode: "insensitive" },
        OR: [
          { sn_carton: { not: null } },
          { pcb_idu: { not: null } },
          { sn_box: { not: null } },
          { sn_motor: { not: null } },
          { sn_accessories: { not: null } },
        ],
      },
    });
    unit = materialCheck.reduce((acc, item) => {
      for (const key in item) {
        if ((!acc[key] || acc[key] === "") && item[key]) acc[key] = item[key];
      }
      return acc;
    }, {});
  }

  await assertNoDoubleScan(tx, id_regist, payload);
  assertAccuracy(valueRegist, payload, relevantKeys);

  const created = await tx.recordscan.create({
    data: {
      id_regist,
      ...buildScanRecord(payload, productCategory(payload, valueRegist.product_category)),
    },
  });

  return {
    unit,
    brand: brandtv ? brandtv.brand : null,
    po: valueRegist.po_number,
    odf: valueRegist.order_number,
    model: valueRegist.model,
    created,
  };
}

module.exports = { createScan, REQUIRED_STAGES };
