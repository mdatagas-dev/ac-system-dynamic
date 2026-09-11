const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const ExcelJS = require("exceljs");
const { createScan } = require("../services/scan");
const requirePermission = require("../../middlewares/requirePermission");
const requirePpcPin = require("../../middlewares/requirePpcPin");
const {
  assertCanAccessRegistration,
} = require("../services/registration-access");
const {
  findBomlist,
  loadNormalizedBom,
  normalizedFields,
  registrationSpec,
} = require("../services/registration");
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
    include: { route_step: { select: { name: true, requires_main_serial: true } } },
  });
  assertCanAccessRegistration(req.user, registration);
  return registration;
}

router.get("/scan", async (req, res) => {
  const registration = await registrationForRequest(req);
  const bom = await findBomlist(
    prisma,
    registration.model,
    registration.order_number,
  );
  const normalizedBom = await loadNormalizedBom(prisma, bom);
  const category = normalizedBom.category;
  const configuredRules = await prisma.registscan_components.findMany({
    where: { id_regist: registration.id },
  });
  const fields = normalizedFields(normalizedBom.rules, configuredRules);
  if (category !== registration.product_category) {
    throw new AppError(
      "Kategori BOM tidak cocok dengan registrasi",
      400,
      "CATEGORY_MISMATCH",
    );
  }
  const [normalizedRows, reference] = await Promise.all([
    normalizedScanRows(prisma, registration.id, category),
    registrationSpec(prisma, category, registration.id),
  ]);
  const total = normalizedRows.length;
  const last = normalizedRows[0] || null;
  // Progres order terpisah dari plan registrasi: unit unik vs order_quantity.
  const [unitCount, orderQuantity] = await Promise.all([
    prisma.production_units.count({ where: { bomlist_id: bom.id } }),
    prisma.bomlist.findUnique({
      where: { id: bom.id },
      select: { order_quantity: true },
    }).then((order) => order?.order_quantity ?? null),
  ]);
  res.status(200).json({
    validation: { ...registration, ...(reference || {}) },
    total,
    last,
    route_step: {
      name: registration.route_step?.name ?? registration.subline,
      requires_main_serial: registration.route_step?.requires_main_serial ?? true,
    },
    order: { order_quantity: orderQuantity, unit_count: unitCount },
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
  const fields = [
    "sn",
    ...(await prisma.registscan_components.findMany({
      where: { id_regist: registration.id },
      include: { component_type: true },
    })).map((rule) => rule.component_type.code),
  ];
  const rows = await normalizedScanRows(
    prisma,
    registration.id,
    registration.product_category,
  );
  const filteredRows = filterScanRows(rows, fields, keyword);
  const total = filteredRows.length;
  const data = limit
    ? filteredRows.slice((page - 1) * limit, page * limit)
    : filteredRows;
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
  const keys = [
    "sn",
    ...(await prisma.registscan_components.findMany({
      where: { id_regist: registration.id },
      include: { component_type: true },
    })).map((rule) => rule.component_type.code),
  ];
  const rows = filterScanRows(
    await normalizedScanRows(
      prisma,
      registration.id,
      registration.product_category,
    ),
    keys,
    keyword,
  );
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
  if (payload.sn && /[%$#@!^*]/.test(String(payload.sn)))
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
        recordId,
        payload: req.body || {},
        reason,
        userId: req.user.id,
        pinId: pin.id,
      });
    });
    return res.status(200).json({
      message: "data update successful",
      data: result,
    });
  },
);

router.delete(
  "/delete/:id",
  requirePermission("scan:write"),
  requirePpcPin,
  async (req, res) => {
    const registration = await registrationForRequest(req);
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.recordscan.findUnique({
        where: { id: req.params.id },
        include: {
          components: { include: { component_type: true } },
          production_unit: {
            include: { components: { include: { component_type: true } } },
          },
        },
      });
      if (!event || event.deleted_at || event.id_regist !== registration.id) {
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
      return legacyScanShape(event, registration.product_category);
    });
    res.status(200).json({ result, message: "Deleted Successfully" });
  },
);

module.exports = router;
