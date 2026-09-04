const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

const { stripBrandSuffix } = require("../rules/model-code");
const { findBomMismatch } = require("../rules/bom-match");
const { buildScanRecord, dynamicComponents, productCategory, scanFields } = require("../services/recordscan");
const { createScan } = require("../services/scan");
const requirePermission = require("../../middlewares/requirePermission");
const { assertCanAccessRegistration } = require("../services/registration-access");
const { withTemplate, findBomlist } = require("../services/registration");
const AppError = require("../../lib/AppError");

router.get("/scan", async (req, res) => {
  const idRegist = req.headers.idregist;

  if (!idRegist) {
    throw new AppError("tidak ada id regist", 404, "NOT_FOUND");
  }

  // validasi dari regist
  const resRegistScan = await prisma.registscan.findFirst({
    where: { id: idRegist },
  });
  if (!resRegistScan) {
    throw new AppError("regist tidak ditemukan", 404, "NOT_FOUND");
  }

  // menghitung total scan
  const resRecordScanCount = await prisma.recordscan.count({
    where: { id_regist: idRegist },
  });

  // scan terakhir
  const resRecordScanLast = await prisma.recordscan.findFirst({
    where: { id_regist: idRegist },
    orderBy: { timestamps: "desc" },
  });

  // lookup toleran: exact dulu, fallback strip suffix (lihat findBomlist di registration.js)
  let resBomlist = await prisma.bomlist.findMany({
    where: {
      model: resRegistScan.model.trim(),
      order_number: resRegistScan.order_number.trim(),
      is_active: true,
    },
  });
  if (resBomlist.length === 0) {
    resBomlist = await prisma.bomlist.findMany({
      where: {
        model: stripBrandSuffix(resRegistScan.model).trim(),
        order_number: resRegistScan.order_number.trim(),
        is_active: true,
      },
    });
  }

  const cleanBomlist = resBomlist.map((item) => {
    const filterd = {};
    for (const key in item) {
      const value = item[key];
      if (value !== "" && value !== null && value !== undefined) {
        filterd[key] = value;
      }
    }
    return filterd;
  });

  // enrich: template kategori (struktur field) per baris — client derive form dari sini
  const slugs = [...new Set(resBomlist.map((r) => r.product_category).filter(Boolean))];
  const cats = slugs.length
    ? await prisma.product_categories.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, fields: true },
      })
    : [];
  const fieldsBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.fields]));
  const enrichedBomlist = cleanBomlist.map((r) => ({
    ...r,
    fields: fieldsBySlug[r.product_category] ?? null,
  }));

  res.status(200).json({
    validation: resRegistScan,
    total: resRecordScanCount,
    last: resRecordScanLast,
    bomlist: enrichedBomlist,
  });
});

router.get("/history", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;

  const idRegist = req.headers.idregist;

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  // filter sama untuk keyword & tanpa keyword — cabang kosong identik, cukup satu
  const where = {
    AND: [
      { id_regist: { contains: idRegist, mode: "insensitive" } },
      {
        OR: [
          isUUID ? { id: { equals: keyword } } : undefined,
          { sn: { contains: keyword, mode: "insensitive" } },
          { sn_carton: { contains: keyword, mode: "insensitive" } },
          { pcb_idu: { contains: keyword, mode: "insensitive" } },
          { sn_box: { contains: keyword, mode: "insensitive" } },
          { sn_motor: { contains: keyword, mode: "insensitive" } },
          { sn_accessories: { contains: keyword, mode: "insensitive" } },
        ].filter(Boolean),
      },
    ],
  };

  const queryOptions = {
    where,
    orderBy: {
      timestamps: "desc",
    },
  };

  if (limit) {
    const skip = (Number(page) - 1) * Number(limit);
    queryOptions.skip = skip;
    queryOptions.take = Number(limit);
  }

  const total = await prisma.recordscan.count({ where });
  const result = await prisma.recordscan.findMany(queryOptions);
  const resultRegist = await prisma.registscan.findFirst({
    where: { id: idRegist },
  });

  return res.status(200).json({
    data: result,
    validation: resultRegist,
    currentPages: Number(page),
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/post", requirePermission("scan:write"), async (req, res) => {
  const { id_regist, pn_carton, ...searchField } = req.body;

  // validasi SN mengandung karakter unik
  if (/[%$#@!%*^]/.test(searchField.sn)) {
    throw new AppError("SN mengandung karakter tidak valid", 400, "INVALID_CHARS");
  }

  const txResult = await prisma.$transaction((tx) =>
    createScan(tx, { user: req.user, id_regist, payload: searchField }),
  );

  return res.status(201).json({
    message: "Data Added Successfully",
    data: txResult.created,
    unit: txResult.unit,
    brand: txResult.brand,
    po: txResult.po,
    odf: txResult.odf,
    model: txResult.model,
  });
});

// Bulk import scan (admin) — baris divalidasi BOM rule batch, lalu di-insert.
router.post("/import", requirePermission("registscan:import-sn"), async (req, res) => {
  const { id_regist, rows } = req.body || {};

  if (!id_regist || !Array.isArray(rows) || rows.length === 0) {
    throw new AppError("id_regist dan rows wajib diisi", 400, "VALIDATION");
  }
  if (rows.length > 5000) {
    throw new AppError("Maksimal 5000 baris", 400, "VALIDATION");
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT * FROM "recordscan" WHERE "id_regist" = ${id_regist} FOR UPDATE`;
    const valueRegist = await tx.registscan.findUnique({ where: { id: id_regist } });
    assertCanAccessRegistration(req.user, valueRegist);

    const bomRule = await findBomlist(tx, valueRegist.model, valueRegist.order_number);
    if (!bomRule) throw new AppError("Batch tidak ada di bomlist", 404, "BOMLIST_NOT_FOUND");
    const rule = await withTemplate(tx, bomRule);

    let count = 0;
    for (const row of rows) {
      const mismatch = findBomMismatch(rule, row);
      if (mismatch) {
        throw new AppError(
          `baris ${row.sn || "-"}: ${mismatch.key} tidak sesuai BOM (diharapkan mengandung: ${mismatch.expected})`,
          400,
          "BOM_MISMATCH",
        );
      }
      await tx.recordscan.create({
        data: {
          id_regist,
          ...buildScanRecord(row, productCategory(row)),
        },
      });
      count++;
    }
    return count;
  });

  return res.status(201).json({ message: `Imported ${created} rows`, created });
});

router.put("/edit/:id", requirePermission("scan:write"), async (req, res) => {
  const { id } = req.params;
  const { id_regist, sn, ...handleRequest } = req.body;
  const optionWhere = [];

  for (const key in handleRequest) {
    const value = handleRequest[key];
    if (value !== undefined && value !== null && value !== "") {
      optionWhere.push({ [key]: { equals: value } });
    }
  }

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const excludeConditions = [];
  if (isUUID) {
    excludeConditions.push({ id: { equals: id } });
  }
  excludeConditions.push({ sn: { contains: sn, mode: "insensitive" } });

  const checkUnit = await prisma.recordscan.findMany({
    where: {
      NOT: excludeConditions,
      OR: optionWhere,
    },
  });

  if (checkUnit.length > 0) {
    throw new AppError("Double scan di satu regist", 400, "DOUBLE_SCAN");
  }

  // akses: pemilik registrasi (atau superuser)
  const record = await prisma.recordscan.findUnique({ where: { id } });
  if (!record) {
    throw new AppError("Record tidak ditemukan", 404, "NOT_FOUND");
  }
  const reg = await prisma.registscan.findUnique({ where: { id: record.id_regist } });
  assertCanAccessRegistration(req.user, reg);
  const components = dynamicComponents(handleRequest);
  const result = await prisma.recordscan.update({
    where: { id },
    data: {
      sn,
      ...scanFields(handleRequest),
      ...(handleRequest.product_category || handleRequest.productCategory
        ? { product_category: productCategory(handleRequest) }
        : {}),
      ...(Object.keys(components).length ? { components } : {}),
    },
  });
  res.status(200).json({ message: "data update successful", data: result });
});

router.delete("/delete/:id", requirePermission("scan:write"), async (req, res) => {
  const { id } = req.params;

  const check = await prisma.recordscan.findFirst({
    where: { id },
  });

  if (!check || Object.keys(check).length < 1) {
    throw new AppError("Id tidak terbaca di server", 401, "NOT_FOUND");
  }
  // akses: pemilik registrasi (atau superuser)
  const reg = await prisma.registscan.findUnique({ where: { id: check.id_regist } });
  assertCanAccessRegistration(req.user, reg);
  const result = await prisma.recordscan.delete({
    where: { id },
  });
  res.status(200).json({ result: result, message: "Deleted Succesfully" });
});

module.exports = router;
