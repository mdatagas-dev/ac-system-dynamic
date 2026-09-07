const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { createScan } = require("../services/scan");
const requirePermission = require("../../middlewares/requirePermission");
const requirePpcPin = require("../../middlewares/requirePpcPin");
const { assertCanAccessRegistration } = require("../services/registration-access");
const { findBomlist, loadTypedBom, registrationSpec } = require("../services/registration");
const { definition, fieldsForCategory, fieldsForUnit, scanDelegate, typedData, validatePayload } = require("../services/category-specs");
const { unitFromSubline } = require("../rules/unit");
const AppError = require("../../lib/AppError");

async function registrationForRequest(req) {
  const id = req.headers.idregist || req.body?.id_regist;
  if (!id) throw new AppError("tidak ada id regist", 404, "NOT_FOUND");
  const registration = await prisma.registscan.findUnique({ where: { id: String(id) } });
  assertCanAccessRegistration(req.user, registration);
  return registration;
}

router.get("/scan", async (req, res) => {
  const registration = await registrationForRequest(req);
  const { bom, category, spec } = await loadTypedBom(prisma, await findBomlist(prisma, registration.model, registration.order_number));
  if (category !== registration.product_category) throw new AppError("Kategori BOM tidak cocok dengan registrasi", 400, "CATEGORY_MISMATCH");
  const scans = scanDelegate(category, prisma);
  const [total, last, reference] = await Promise.all([
    scans.count({ where: { id_regist: registration.id } }),
    scans.findFirst({ where: { id_regist: registration.id }, orderBy: { timestamps: "desc" } }),
    registrationSpec(prisma, category, registration.id),
  ]);
  const fields = fieldsForUnit(fieldsForCategory(category, spec), unitFromSubline(registration.subline));
  res.status(200).json({ validation: { ...registration, ...(reference || {}) }, total, last, bomlist: [{ id: bom.id, model: bom.model, order_number: bom.order_number, product_category: category, fields }] });
});

router.get("/history", async (req, res) => {
  const registration = await registrationForRequest(req);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const keyword = String(req.query.keyword || "").trim();
  const fields = definition(registration.product_category).fields.map(([key]) => key);
  const where = {
    id_regist: registration.id,
    ...(keyword ? { OR: fields.map((key) => ({ [key]: { contains: keyword, mode: "insensitive" } })) } : {}),
  };
  const scans = scanDelegate(registration.product_category, prisma);
  const [total, data] = await Promise.all([
    scans.count({ where }),
    scans.findMany({ where, orderBy: { timestamps: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  res.status(200).json({ data, validation: registration, currentPages: page, total, totalPages: Math.ceil(total / limit) });
});

router.post("/post", requirePermission("scan:write"), async (req, res) => {
  const payload = req.body || {};
  if (!payload.sn || /[%$#@!^*]/.test(String(payload.sn))) throw new AppError("SN mengandung karakter tidak valid", 400, "INVALID_CHARS");
  const result = await prisma.$transaction((tx) => createScan(tx, { user: req.user, id_regist: payload.id_regist, payload }));
  res.status(201).json({ message: "Data Added Successfully", data: result.created, unit: result.unit, brand: result.brand, po: result.po, odf: result.odf, model: result.model });
});

router.post("/import", requirePermission("registscan:import-sn"), async (req, res) => {
  const { id_regist, rows } = req.body || {};
  if (!id_regist || !Array.isArray(rows) || rows.length === 0 || rows.length > 5000) throw new AppError("id_regist dan 1-5000 rows wajib diisi", 400, "VALIDATION");
  const created = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const row of rows) {
      await createScan(tx, { user: req.user, id_regist, payload: { ...row, id_regist } });
      count++;
    }
    return count;
  });
  res.status(201).json({ message: `Imported ${created} rows`, created });
});

router.put("/edit/:id", requirePermission("scan:write"), requirePpcPin, async (req, res) => {
  const recordId = req.params.id;
  const registration = await registrationForRequest(req);
  const scans = scanDelegate(registration.product_category, prisma);
  const existing = await scans.findUnique({ where: { id: recordId } });
  if (!existing || existing.id_regist !== registration.id) throw new AppError("Record tidak ditemukan", 404, "NOT_FOUND");
  const { category, spec } = await loadTypedBom(prisma, await findBomlist(prisma, registration.model, registration.order_number));
  if (category !== registration.product_category) throw new AppError("Kategori BOM tidak cocok dengan registrasi", 400, "CATEGORY_MISMATCH");
  validatePayload(category, spec, req.body || {}, unitFromSubline(registration.subline));
  const data = typedData(category, req.body || {}, { partial: true });
  // Editing cannot silently introduce duplicate values in this registration.
  for (const [key, value] of Object.entries(data)) {
    if (!value) continue;
    const duplicate = await scans.findFirst({ where: { id_regist: registration.id, [key]: value, NOT: { id: recordId } } });
    if (duplicate) throw new AppError(`Double scan ${key} di satu regist`, 400, "DOUBLE_SCAN");
  }
  const result = await scans.update({ where: { id: recordId }, data });
  res.status(200).json({ message: "data update successful", data: result });
});

router.delete("/delete/:id", requirePermission("scan:write"), requirePpcPin, async (req, res) => {
  const registration = await registrationForRequest(req);
  const scans = scanDelegate(registration.product_category, prisma);
  const existing = await scans.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.id_regist !== registration.id) throw new AppError("Record tidak ditemukan", 404, "NOT_FOUND");
  const result = await scans.delete({ where: { id: existing.id } });
  res.status(200).json({ result, message: "Deleted Successfully" });
});

module.exports = router;
