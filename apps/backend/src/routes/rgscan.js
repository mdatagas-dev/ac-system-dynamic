const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { hasPermission } = require("../services/permissions");
const { resolveBomRule, createRegistrationSpec, updateRegistrationSpec, registrationSpec } = require("../services/registration");
const { isSupportedCategory, scanDelegate } = require("../services/category-specs");
const requirePermission = require("../../middlewares/requirePermission");
const { assertCanAccessRegistration } = require("../services/registration-access");
const AppError = require("../../lib/AppError");

const baseSelect = { id: true, model: true, order_number: true, po_number: true, subline: true, userid: true, shift: true, plan: true, timestamps: true, product_category: true };

async function scanCount(db, registration) {
  if (isSupportedCategory(registration.product_category)) {
    return scanDelegate(registration.product_category, db).count({ where: { id_regist: registration.id } });
  }
  // Legacy registrations remain readable during the additive migration.
  return db.recordscan.count({ where: { id_regist: registration.id } });
}

router.get("/", async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const keyword = String(req.query.keyword || "");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyword);
  const search = ["model", "order_number", "po_number", "subline"].map((field) => ({ [field]: { contains: keyword, mode: "insensitive" } }));
  if (isUuid) search.unshift({ id: keyword });
  const where = {
    ...(hasPermission(req.user, "registscan:read") ? {} : { userid: req.user.id }),
    ...(keyword ? { OR: search } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.registscan.count({ where }),
    prisma.registscan.findMany({ where, select: baseSelect, skip: (page - 1) * limit, take: limit, orderBy: { timestamps: "desc" } }),
  ]);
  const data = await Promise.all(rows.map(async (row, index) => ({
    ...row,
    ...(await registrationSpec(prisma, row.product_category, row.id) || {}),
    total: await scanCount(prisma, row),
    index: (page - 1) * limit + index + 1,
  })));
  res.status(200).json({ data, total, currentPage: page, totalPages: Math.ceil(total / limit) });
});

router.get("/checkregist", async (req, res) => {
  const userId = hasPermission(req.user, "registscan:read") && req.query.userid ? String(req.query.userid) : req.user.id;
  const rows = await prisma.registscan.findMany({ where: { userid: userId }, select: baseSelect });
  const data = (await Promise.all(
    rows.map(async (row) => ({ ...row, total: await scanCount(prisma, row) })),
  )).filter((row) => row.plan > row.total);
  res.status(200).json({ data });
});

function registrationInput(req, requireUserId) {
  const payload = req.body || {};
  const subline = String(payload.subline ?? req.user?.section ?? "").trim();
  const required = ["model", "order_number", "po_number", "shift", "plan"];
  if (requireUserId) required.push("userid");
  if (required.some((key) => payload[key] === undefined || payload[key] === null || String(payload[key]).trim() === "") || !subline) {
    throw new AppError("model, order_number, po_number, shift, plan, dan subline wajib diisi", 400, "VALIDATION");
  }
  const plan = Number(payload.plan);
  if (!Number.isInteger(plan) || plan <= 0) throw new AppError("plan harus bilangan bulat positif", 400, "VALIDATION");
  return { payload, subline, plan };
}

router.post("/post", requirePermission("registscan:write"), async (req, res) => {
  const { payload, subline, plan } = registrationInput(req, false);
  const userid = hasPermission(req.user, "registscan:read") && payload.userid ? String(payload.userid) : req.user.id;
  const resolved = await resolveBomRule({ model: payload.model, order_number: payload.order_number, payload, subline });
  const result = await prisma.$transaction(async (tx) => {
    const registration = await tx.registscan.create({
      data: { model: String(payload.model).trim(), order_number: String(payload.order_number).trim(), po_number: String(payload.po_number).trim(), subline, userid, shift: String(payload.shift), plan, product_category: resolved.category },
    });
    await createRegistrationSpec(tx, resolved.category, registration.id, payload);
    return registration;
  });
  res.status(201).json({ message: "Data Added Successfully", result });
});

router.put("/edit/:id", requirePermission("registscan:write"), async (req, res) => {
  const existing = await prisma.registscan.findUnique({ where: { id: req.params.id }, select: baseSelect });
  assertCanAccessRegistration(req.user, existing);
  const { payload, subline, plan } = registrationInput(req, false);
  const resolved = await resolveBomRule({ model: payload.model, order_number: payload.order_number, payload, subline });
  if (resolved.category !== existing.product_category) throw new AppError("Kategori registrasi tidak dapat diubah", 400, "CATEGORY_CHANGE_FORBIDDEN");
  const result = await prisma.$transaction(async (tx) => {
    const registration = await tx.registscan.update({ where: { id: existing.id }, data: { model: String(payload.model).trim(), order_number: String(payload.order_number).trim(), po_number: String(payload.po_number).trim(), subline, shift: String(payload.shift), plan } });
    await updateRegistrationSpec(tx, resolved.category, existing.id, payload);
    return registration;
  });
  res.status(200).json({ message: "data successfully changed", result });
});

router.delete("/delete/:id", requirePermission("registscan:write"), async (req, res) => {
  const existing = await prisma.registscan.findUnique({ where: { id: req.params.id }, select: baseSelect });
  assertCanAccessRegistration(req.user, existing);
  await prisma.registscan.delete({ where: { id: existing.id } });
  res.status(200).json({ message: "Deleted Successfully" });
});

module.exports = router;
