const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const requirePermission = require("../../middlewares/requirePermission");

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "", archived = "false" } = req.query;
  const showArchived = String(archived) === "true";
  const skip = (Number(page) - 1) * Number(limit);
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  const where = {
    ...(showArchived ? {} : { is_active: true }),
    ...(keyword
      ? {
          OR: [
            isUUID ? { id: { equals: keyword } } : undefined,
            { sn_carton: { contains: keyword, mode: "insensitive" } },
            { model: { contains: keyword, mode: "insensitive" } },
            { pcb_idu: { contains: keyword, mode: "insensitive" } },
            { sn_box: { contains: keyword, mode: "insensitive" } },
            { sn_motor: { contains: keyword, mode: "insensitive" } },
            { sn_accessories: { contains: keyword, mode: "insensitive" } },
            { order_number: { contains: keyword, mode: "insensitive" } },
            { sn: { contains: keyword, mode: "insensitive" } },
          ].filter(Boolean),
        }
      : {}),
  };
  const total = await prisma.bomlist.count({ where });
  const result = await prisma.bomlist.findMany({
    where,
    skip,
    take: Number(limit),
    orderBy: {
      timestamps: "desc",
    },
  });

  // enrich: template kategori per baris (struktur field) — satu query untuk semua slug
  const slugs = [...new Set(result.map((r) => r.product_category).filter(Boolean))];
  const cats = slugs.length
    ? await prisma.product_categories.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, fields: true },
      })
    : [];
  const fieldsBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.fields]));
  const enriched = result.map((r) => ({
    ...r,
    fields: fieldsBySlug[r.product_category] ?? null,
  }));

  res.status(200).json({
    data: enriched,
    total,
    currentPages: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/post", requirePermission("master-data:write"), async (req, res) => {
  const handleData = req.body;
  const model = String(handleData.model || "").trim();
  const orderNumber = String(handleData.order_number || "").trim();

  if (!model || !orderNumber) {
    throw new AppError("model dan order_number wajib diisi", 400, "VALIDATION");
  }

  const master = await prisma.model.findFirst({
    where: { model },
    include: { category: { select: { slug: true } } },
  });
  if (!master) {
    throw new AppError("Create the model first in Model Master", 400, "VALIDATION");
  }

  const existing = await prisma.bomlist.findFirst({
    where: { model, order_number: orderNumber, is_active: true },
  });
  if (existing) {
    throw new AppError("BOM rule already exists for this model and order", 400, "DUPLICATE");
  }

  const components =
    handleData.components && typeof handleData.components === "object"
      ? handleData.components
      : undefined;
  const unitMap =
    handleData.unit_map && typeof handleData.unit_map === "object"
      ? handleData.unit_map
      : undefined;

  const result = await prisma.bomlist.create({
    data: {
      sn_carton: handleData.sn_carton,
      model,
      pcb_idu: handleData.pcb_idu,
      sn_box: handleData.sn_box,
      sn_motor: handleData.sn_motor,
      sn_accessories: handleData.sn_accessories,
      order_number: orderNumber,
      sn: handleData.sn,
      components,
      unit_map: unitMap,
      product_category: master.category?.slug ?? null,
    },
  });
  res.status(200).json({ message: "success", data: result });
});

router.put("/edit/:id", requirePermission("master-data:write"), async (req, res) => {
  const { id } = req.params;
  const handleData = req.body;
  const model = String(handleData.model || "").trim();
  const orderNumber = String(handleData.order_number || "").trim();

  if (!model || !orderNumber) {
    throw new AppError("model dan order_number wajib diisi", 400, "VALIDATION");
  }

  const master = await prisma.model.findFirst({
    where: { model },
    include: { category: { select: { slug: true } } },
  });
  if (!master) {
    throw new AppError("Create the model first in Model Master", 400, "VALIDATION");
  }

  const existing = await prisma.bomlist.findFirst({
    where: { model, order_number: orderNumber, is_active: true, NOT: { id } },
  });
  if (existing) {
    throw new AppError("BOM rule already exists for this model and order", 400, "DUPLICATE");
  }

  const components =
    handleData.components !== undefined && typeof handleData.components === "object"
      ? handleData.components
      : undefined;
  const unitMap =
    handleData.unit_map && typeof handleData.unit_map === "object"
      ? handleData.unit_map
      : undefined;

  const result = await prisma.bomlist.update({
    where: { id },
    data: {
      sn_carton: handleData.sn_carton,
      model,
      pcb_idu: handleData.pcb_idu,
      sn_box: handleData.sn_box,
      sn_motor: handleData.sn_motor,
      sn_accessories: handleData.sn_accessories,
      order_number: orderNumber,
      sn: handleData.sn,
      product_category: master.category?.slug ?? null,
      ...(components ? { components } : {}),
      ...(unitMap ? { unit_map: unitMap } : {}),
    },
  });
  res.status(200).json({ message: "success", data: result });
});

router.delete("/delete/:id", requirePermission("master-data:write"), async (req, res) => {
  const { id } = req.params;
  // soft-delete: arsip, aturan lama tetap jadi sejarah tapi tak dipakai batch baru
  await prisma.bomlist.update({
    where: { id },
    data: { is_active: false },
  });
  res.status(200).json({ message: "success" });
});

module.exports = router;