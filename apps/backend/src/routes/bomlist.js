const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const requirePermission = require("../../middlewares/requirePermission");
const { categoryKey, definition, bomSpecData, fieldsForCategory } = require("../services/category-specs");
const { normalizedFields } = require("../services/registration");
const {
  createNormalizedBom,
  updateNormalizedBom,
} = require("../services/normalized-bom");

async function enrichBom(row, db = prisma) {
  const category = categoryKey(row.product_category);
  if (row.model_id && row.order_quantity) {
    const rules = await db.bomlist_components.findMany({
      where: { bomlist_id: row.id },
      include: { component_type: true },
    });
    if (rules.length) {
      return {
        ...row,
        product_category: category,
        fields: normalizedFields(rules),
      };
    }
  }
  const spec = await db[definition(category).bomDelegate].findUnique({ where: { bom_id: row.id } });
  return { ...row, product_category: category, fields: spec ? fieldsForCategory(category, spec) : [] };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "", archived = "false" } = req.query;
  const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = Math.max(Number(page) - 1, 0) * take;
  const where = {
    ...(String(archived) === "true" ? {} : { is_active: true }),
    ...(keyword ? { OR: [
      { model: { contains: keyword, mode: "insensitive" } },
      { order_number: { contains: keyword, mode: "insensitive" } },
    ] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.bomlist.count({ where }),
    prisma.bomlist.findMany({ where, skip, take, orderBy: { timestamps: "desc" } }),
  ]);
  const data = await Promise.all(rows.map(async (row) => {
    try { return await enrichBom(row); } catch { return { ...row, fields: [] }; }
  }));
  res.status(200).json({ data, total, currentPages: Number(page), totalPages: Math.ceil(total / take) });
});

async function masterAndCategory(model) {
  const master = await prisma.model.findFirst({ where: { model }, include: { category: { select: { slug: true } } } });
  if (!master) throw new AppError("Create the model first in Model Master", 400, "VALIDATION");
  return { master, category: categoryKey(master.category?.slug) };
}

router.post("/post", requirePermission("master-data:write"), async (req, res) => {
  const payload = req.body || {};
  const model = String(payload.model || "").trim();
  const orderNumber = String(payload.order_number || "").trim();
  if (!model || !orderNumber) throw new AppError("model dan order_number wajib diisi", 400, "VALIDATION");
  const { master, category } = await masterAndCategory(model);
  const existing = await prisma.bomlist.findFirst({ where: { model, order_number: orderNumber, is_active: true } });
  if (existing) throw new AppError("BOM rule already exists for this model and order", 409, "DUPLICATE");
  const data = await prisma.$transaction(async (tx) => {
    let bom;
    if (payload.order_quantity !== undefined) {
      bom = await createNormalizedBom(tx, {
        master,
        category,
        model,
        orderNumber,
        payload,
      });
    } else {
      bom = await tx.bomlist.create({ data: { model, order_number: orderNumber, product_category: category } });
      await tx[definition(category).bomDelegate].create({ data: { bom_id: bom.id, ...bomSpecData(category, payload) } });
    }
    return enrichBom(bom, tx);
  });
  res.status(200).json({ message: "success", data });
});

router.put("/edit/:id", requirePermission("master-data:write"), async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const model = String(payload.model || "").trim();
  const orderNumber = String(payload.order_number || "").trim();
  if (!model || !orderNumber) throw new AppError("model dan order_number wajib diisi", 400, "VALIDATION");
  const { master, category } = await masterAndCategory(model);
  const current = await prisma.bomlist.findUnique({ where: { id } });
  if (!current) throw new AppError("Production Order tidak ditemukan", 404, "NOT_FOUND");
  const existing = await prisma.bomlist.findFirst({ where: { model, order_number: orderNumber, is_active: true, NOT: { id } } });
  if (existing) throw new AppError("BOM rule already exists for this model and order", 409, "DUPLICATE");
  const data = await prisma.$transaction(async (tx) => {
    let bom;
    if (current.model_id && current.order_quantity) {
      bom = await updateNormalizedBom(tx, {
        existing: current,
        master,
        category,
        model,
        orderNumber,
        payload,
      });
    } else {
      bom = await tx.bomlist.update({ where: { id }, data: { model, order_number: orderNumber, product_category: category } });
      await tx[definition(category).bomDelegate].upsert({
        where: { bom_id: id }, create: { bom_id: id, ...bomSpecData(category, payload) }, update: bomSpecData(category, payload),
      });
    }
    return enrichBom(bom, tx);
  });
  res.status(200).json({ message: "success", data });
});

router.delete("/delete/:id", requirePermission("master-data:write"), async (req, res) => {
  await prisma.bomlist.update({ where: { id: req.params.id }, data: { is_active: false } });
  res.status(200).json({ message: "success" });
});

module.exports = router;
