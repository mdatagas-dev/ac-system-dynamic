const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const ExcelJS = require("exceljs");
const { createScan, assertLengths } = require("../services/scan");
const requirePermission = require("../../middlewares/requirePermission");
const requirePpcPin = require("../../middlewares/requirePpcPin");
const {
  assertCanAccessRegistration,
} = require("../services/registration-access");
const {
  findBomlist,
  loadTypedBom,
  registrationSpec,
} = require("../services/registration");
const {
  definition,
  fieldsForCategory,
  scanDelegate,
  typedData,
  validatePayload,
  assertPrefixes,
} = require("../services/category-specs");
const jakartaTime = (value) =>
  value
    ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    : "";
const AppError = require("../../lib/AppError");
const {
  editNormalizedUnit,
  legacyScanShape,
  normalizedScanRows,
} = require("../services/normalized-scan");
const {
  authorizePin,
  requireReason,
} = require("../services/normalized-registration");

function filterScanRows(rows, fields, keyword) {
  if (!keyword) return rows;
  const search = keyword.toUpperCase();
  return rows.filter((row) =>
    fields.some((key) => String(row[key] || "").toUpperCase().includes(search)),
  );
}

async function registrationForRequest(req) {
  const id = req.headers.idregist || req.body?.id_regist;
  if (!id) throw new AppError("tidak ada id regist", 404, "NOT_FOUND");
  const registration = await prisma.registscan.findUnique({
    where: { id: String(id) },
  });
  assertCanAccessRegistration(req.user, registration);
  return registration;
}

router.get("/scan", async (req, res) => {
  const registration = await registrationForRequest(req);
  const { bom, category, spec } = await loadTypedBom(
    prisma,
    await findBomlist(prisma, registration.model, registration.order_number),
  );
  if (category !== registration.product_category)
    throw new AppError(
      "Kategori BOM tidak cocok dengan registrasi",
      400,
      "CATEGORY_MISMATCH",
    );
  const scans = scanDelegate(category, prisma);
  const [normalizedRows, reference] = await Promise.all([
    registration.bomlist_id
      ? normalizedScanRows(prisma, registration.id, category)
      : null,
    registrationSpec(prisma, category, registration.id),
  ]);
  const total = normalizedRows
    ? normalizedRows.length
    : await scans.count({ where: { id_regist: registration.id } });
  const last = normalizedRows
    ? normalizedRows[0] || null
    : await scans.findFirst({
        where: { id_regist: registration.id },
        orderBy: { timestamps: "desc" },
      });
  const fields = fieldsForCategory(category, spec);
  res.status(200).json({
    validation: { ...registration, ...(reference || {}) },
    total,
    last,
    bomlist: [
      {
        id: bom.id,
        model: bom.model,
        order_number: bom.order_number,
        product_category: category,
        fields,
      },
    ],
  });
});

router.get("/history", async (req, res) => {
  const registration = await registrationForRequest(req);
  const page = Math.max(Number(req.query.page) || 1, 1);
  // Paritas dengan endpoint lama: tanpa param limit -> seluruh baris (dipakai untuk ekspor).
  const limit = req.query.limit
    ? Math.min(Math.max(Number(req.query.limit) || 10, 1), 100)
    : null;
  const keyword = String(req.query.keyword || "").trim();
  const fields = definition(registration.product_category).fields.map(
    ([key]) => key,
  );
  const where = {
    id_regist: registration.id,
    ...(keyword
      ? {
          OR: fields.map((key) => ({
            [key]: { contains: keyword, mode: "insensitive" },
          })),
        }
      : {}),
  };
  let total;
  let data;
  if (registration.bomlist_id) {
    const rows = await normalizedScanRows(
      prisma,
      registration.id,
      registration.product_category,
    );
    const filteredRows = filterScanRows(rows, fields, keyword);
    total = filteredRows.length;
    data = limit
      ? filteredRows.slice((page - 1) * limit, page * limit)
      : filteredRows;
  } else {
    const scans = scanDelegate(registration.product_category, prisma);
    [total, data] = await Promise.all([
      scans.count({ where }),
      scans.findMany({
        where,
        orderBy: { timestamps: "desc" },
        ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
    ]);
  }
  res.status(200).json({
    data,
    validation: registration,
    currentPages: page,
    total,
    totalPages: limit ? Math.ceil(total / limit) : 1,
  });
});

router.get("/history.xlsx", async (req, res) => {
  const registration = await registrationForRequest(req);
  const keyword = String(req.query.keyword || "").trim();
  const keys = definition(registration.product_category).fields.map(
    ([key]) => key,
  );
  const where = {
    id_regist: registration.id,
    ...(keyword
      ? {
          OR: keys.map((key) => ({
            [key]: { contains: keyword, mode: "insensitive" },
          })),
        }
      : {}),
  };
  let rows;
  if (registration.bomlist_id) {
    rows = filterScanRows(
      await normalizedScanRows(
        prisma,
        registration.id,
        registration.product_category,
      ),
      keys,
      keyword,
    );
  } else {
    rows = await scanDelegate(
      registration.product_category,
      prisma,
    ).findMany({ where, orderBy: { timestamps: "desc" } });
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Riwayat");
  sheet.columns = [
    { header: "TIME", key: "timestamps", width: 22 },
    ...keys.map((key) => ({ header: key.toUpperCase(), key, width: 26 })),
  ];
  for (const row of rows)
    sheet.addRow({ ...row, timestamps: jakartaTime(row.timestamps) });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="history-${registration.order_number || registration.id}.xlsx"`,
  );
  await workbook.xlsx.write(res);
  res.end();
});
router.post("/post", requirePermission("scan:write"), async (req, res) => {
  const payload = req.body || {};
  if (!payload.sn || /[%$#@!^*]/.test(String(payload.sn)))
    throw new AppError(
      "SN mengandung karakter tidak valid",
      400,
      "INVALID_CHARS",
    );
  const result = await prisma.$transaction((tx) =>
    createScan(tx, { user: req.user, id_regist: payload.id_regist, payload }),
  );
  res.status(201).json({
    message: "Data Added Successfully",
    data: result.created,
    unit: result.unit,
    brand: result.brand,
    po: result.po,
    odf: result.odf,
    model: result.model,
  });
});

router.post(
  "/import",
  requirePermission("registscan:import-sn"),
  async (req, res) => {
    const { id_regist, rows } = req.body || {};
    if (
      !id_regist ||
      !Array.isArray(rows) ||
      rows.length === 0 ||
      rows.length > 5000
    )
      throw new AppError(
        "id_regist dan 1-5000 rows wajib diisi",
        400,
        "VALIDATION",
      );
    const created = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const row of rows) {
        await createScan(tx, {
          user: req.user,
          id_regist,
          payload: { ...row, id_regist },
        });
        count++;
      }
      return count;
    });
    res.status(201).json({ message: `Imported ${created} rows`, created });
  },
);

router.put(
  "/edit/:id",
  requirePermission("scan:write"),
  requirePpcPin,
  async (req, res) => {
    const recordId = req.params.id;
    const registration = await registrationForRequest(req);
    const scans = scanDelegate(registration.product_category, prisma);
    const existing = await scans.findUnique({ where: { id: recordId } });
    if (!existing || existing.id_regist !== registration.id)
      throw new AppError("Record tidak ditemukan", 404, "NOT_FOUND");
    if (registration.bomlist_id) {
      const result = await prisma.$transaction(async (tx) => {
        const normalizedRegistration = await tx.registscan.findUnique({
          where: { id: registration.id },
          include: {
            component_rules: { include: { component_type: true } },
          },
        });
        const pin = await authorizePin(tx, req.headers["x-pin"]);
        const reason = requireReason(req.body?.reason);
        return editNormalizedUnit(tx, {
          registration: normalizedRegistration,
          category: registration.product_category,
          legacyRecordId: recordId,
          payload: req.body || {},
          reason,
          userId: req.user.id,
          pinId: pin.id,
        });
      });
      return res
        .status(200)
        .json({ message: "data update successful", data: result });
    }
    const { category, spec } = await loadTypedBom(
      prisma,
      await findBomlist(prisma, registration.model, registration.order_number),
    );
    if (category !== registration.product_category)
      throw new AppError(
        "Kategori BOM tidak cocok dengan registrasi",
        400,
        "CATEGORY_MISMATCH",
      );
    validatePayload(
      category,
      spec,
      req.body || {},
      { skipPrefix: true },
    );
    const data = typedData(category, req.body || {}, { partial: true });
    // Nilai hasil edit tetap wajib sepanjang nilai referensi registrasinya.
    assertLengths(
      await registrationSpec(prisma, category, registration.id),
      data,
      fieldsForCategory(category, spec),
    );
    // Editing cannot silently introduce duplicate values in this registration.
    for (const [key, value] of Object.entries(data)) {
      if (!value) continue;
      const duplicate = await scans.findFirst({
        where: {
          id_regist: registration.id,
          [key]: value,
          NOT: { id: recordId },
        },
      });
      if (duplicate)
        throw new AppError(
          `Double scan ${key} di satu regist`,
          400,
          "DOUBLE_SCAN",
        );
    }
    assertPrefixes(fieldsForCategory(category, spec), data);
    const result = await scans.update({ where: { id: recordId }, data });
    res.status(200).json({ message: "data update successful", data: result });
  },
);

router.delete(
  "/delete/:id",
  requirePermission("scan:write"),
  requirePpcPin,
  async (req, res) => {
    const registration = await registrationForRequest(req);
    const scans = scanDelegate(registration.product_category, prisma);
    const existing = await scans.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.id_regist !== registration.id)
      throw new AppError("Record tidak ditemukan", 404, "NOT_FOUND");
    let result;
    if (registration.bomlist_id) {
      result = await prisma.$transaction(async (tx) => {
        const event = await tx.recordscan.findUnique({
          where: {
            legacy_source_table_legacy_source_id: {
              legacy_source_table:
                registration.product_category === "ac"
                  ? "recordscan_ac"
                  : "recordscan_wm",
              legacy_source_id: existing.id,
            },
          },
          include: {
            production_unit: {
              include: { components: { include: { component_type: true } } },
            },
          },
        });
        if (!event || event.deleted_at) {
          throw new AppError("Unit Scan tidak ditemukan", 404, "NOT_FOUND");
        }
        const pin = await authorizePin(tx, req.headers["x-pin"]);
        const reason = requireReason(req.body?.reason || req.body?.delete_reason);
        const deleted = await tx.recordscan.update({
          where: { id: event.id },
          data: {
            deleted_at: new Date(),
            deleted_by: req.user.id,
            delete_reason: reason,
          },
        });
        await tx.audit_events.create({
          data: {
            entity_type: "unit_scan",
            entity_id: event.id,
            action: "soft_delete",
            before_data: legacyScanShape(event, registration.product_category),
            after_data: { deleted_at: deleted.deleted_at },
            reason,
            performed_by: req.user.id,
            authorized_pin_id: pin.id,
          },
        });
        await scanDelegate(registration.product_category, tx).delete({
          where: { id: existing.id },
        });
        return existing;
      });
    } else {
      result = await scans.delete({ where: { id: existing.id } });
    }
    res.status(200).json({ result, message: "Deleted Successfully" });
  },
);

module.exports = router;
