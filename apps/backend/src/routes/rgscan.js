const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { hasPermission } = require("../services/permissions");
const { resolveBomRule } = require("../services/registration");
const requirePermission = require("../../middlewares/requirePermission");
const { assertCanAccessRegistration } = require("../services/registration-access");
const AppError = require("../../lib/AppError");

const trimOrNull = (v) => (v ? String(v).trim() : null);

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const isSuperuser = hasPermission(req.user, "registscan:read");

  const params = [];
  let where = "WHERE 1=1";
  if (!isSuperuser) {
    params.push(req.user.id);
    where = "WHERE rgs.userid = $1";
  }
  if (keyword) {
    const start = params.length; // indeks placeholder keyword dimulai setelah filter user
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
    );
    where += ` AND (
      rgs.model ILIKE $${start + 1}
      OR rgs.id::text ILIKE $${start + 2}
      OR rgs.order_number ILIKE $${start + 3}
      OR rgs.po_number ILIKE $${start + 4}
      OR rgs.subline ILIKE $${start + 5}
    )`;
  }
  params.push(Number(limit), Number(skip));

  const sql = `
    SELECT
      rgs.*,
      COUNT(rcd.id_regist)::INTEGER AS total
    FROM registscan AS rgs
    LEFT JOIN recordscan AS rcd
      ON rgs.id = rcd.id_regist::uuid
    ${where}
    GROUP BY rgs.id
    ORDER BY rgs.timestamps DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const sqlcount = `
    SELECT COUNT(id)::INTEGER FROM registscan AS rgs ${where}
  `;

  const result = await prisma.$queryRawUnsafe(sql, ...params);

  // count query tidak pakai limit/skip -> kirim subset params
  const total = await prisma.$queryRawUnsafe(
    sqlcount,
    ...params.slice(0, params.length - 2),
  );

  const resultIndex = result.map((item, index) => ({
    ...item,
    index: skip + index + 1,
  }));

  res.status(200).json({
    data: resultIndex,
    total: total[0].count,
    currentPage: Number(page),
    totalPages: Math.ceil(total[0].count / limit),
  });
});

router.get("/checkregist", async (req, res) => {
  const iduser = req.headers["iduser"];
  const result = await prisma.$queryRaw`
    SELECT
      rgs.id AS id,
      rgs.model AS model,
      rgs.plan AS plan,
      COUNT(rcd.id_regist)::INT AS total
      FROM registscan AS rgs
        LEFT JOIN recordscan AS rcd
        ON rgs.id = rcd.id_regist::uuid
    WHERE rgs.userid = ${iduser}
    GROUP BY rgs.id, rgs.model, rgs.plan
    HAVING rgs.plan > COUNT(rcd.id_regist);
  `;

  res.status(200).json({ data: result });
});

router.post("/post", requirePermission("registscan:write"), async (req, res) => {
  const {
    model,
    order_number,
    po_number,
    userid,
    shift,
    plan,
    sn,
    sn_odu,
    sn_motor,
    sn_box,
    pcb_idu,
    sn_carton,
    sn_accessories,
  } = req.body || {};

  if (
    !model ||
    !order_number ||
    !po_number ||
    !userid ||
    !shift ||
    plan === undefined
  ) {
    throw new AppError("model, order_number, po_number, userid, shift, plan wajib diisi", 400, "VALIDATION");
  }

  // subline otomatis dari section user (fallback ke body untuk kompatibilitas)
  const subline = (req.body.subline ?? req.user?.section ?? "").toString().trim();
  if (!subline) {
    throw new AppError("subline wajib diisi (isi section pada user)", 400, "VALIDATION");
  }

  const { product_category, components, fields } = await resolveBomRule({ model, order_number, payload: req.body });
  const result = await prisma.registscan.create({
    data: {
      model: model.trim(),
      order_number: order_number.trim(),
      po_number: po_number.trim(),
      subline: subline.trim(),
      userid,
      shift,
      plan: Number(plan),
      sn: trimOrNull(sn),
      sn_odu: trimOrNull(sn_odu),
      sn_motor: trimOrNull(sn_motor),
      sn_box: trimOrNull(sn_box),
      sn_accessories: trimOrNull(sn_accessories),
      sn_carton: trimOrNull(sn_carton),
      pcb_idu: trimOrNull(pcb_idu),
      product_category: product_category || null,
      components: Object.keys(components).length ? components : null,
      fields_snapshot: fields,
    },
  });

  res.status(201).json({ message: "Data Added Successfully", result });
});

router.put("/edit/:id", requirePermission("registscan:write"), async (req, res) => {
  const { id } = req.params;
  const {
    model,
    order_number,
    po_number,
    shift,
    plan,
    sn,
    sn_odu,
    sn_motor,
    sn_box,
    pcb_idu,
    sn_carton,
    sn_accessories,
  } = req.body || {};

  if (
    !model ||
    !order_number ||
    !po_number ||
    !shift ||
    plan === undefined
  ) {
    throw new AppError("model, order_number, po_number, shift, plan wajib diisi", 400, "VALIDATION");
  }

  // subline otomatis dari section user (fallback ke body untuk kompatibilitas)
  const subline = (req.body.subline ?? req.user?.section ?? "").toString().trim();
  if (!subline) {
    throw new AppError("subline wajib diisi (isi section pada user)", 400, "VALIDATION");
  }

  // akses: pemilik registrasi (atau superuser)
  const existingReg = await prisma.registscan.findUnique({ where: { id } });
  assertCanAccessRegistration(req.user, existingReg);

  const { product_category, components, fields } = await resolveBomRule({ model, order_number, payload: req.body });
  const result = await prisma.registscan.update({
    where: { id },
    data: {
      model: model.trim(),
      order_number: order_number.trim(),
      po_number: po_number.trim(),
      subline: subline.trim(),
      shift,
      plan: Number(plan),
      sn: trimOrNull(sn),
      sn_odu: trimOrNull(sn_odu),
      sn_motor: trimOrNull(sn_motor),
      sn_box: trimOrNull(sn_box),
      sn_accessories: trimOrNull(sn_accessories),
      sn_carton: trimOrNull(sn_carton),
      pcb_idu: trimOrNull(pcb_idu),
      product_category: product_category ?? undefined,
      components: Object.keys(components).length ? components : undefined,
      fields_snapshot: fields,
    },
  });
  res
    .status(200)
    .json({ message: "data successfully changed", result });
});

router.delete("/delete/:id", requirePermission("registscan:write"), async (req, res) => {
  const { id } = req.params;
  // akses: pemilik registrasi (atau superuser)
  const existingReg = await prisma.registscan.findUnique({ where: { id } });
  assertCanAccessRegistration(req.user, existingReg);
  const result = await prisma.$transaction([
    prisma.recordscan.deleteMany({ where: { id_regist: id } }),
    prisma.registscan.delete({ where: { id } }),
  ]);
  res.status(200).json({ message: "Deleted Successfully", result: result });
});

module.exports = router;
