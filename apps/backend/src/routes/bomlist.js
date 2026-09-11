const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const requirePermission = require("../../middlewares/requirePermission");
const { categoryKey } = require("../services/category-specs");
const { normalizedFields } = require("../services/registration");
const {
  createNormalizedBom,
  updateNormalizedBom,
} = require("../services/normalized-bom");

async function enrichBom(row, db = prisma) {
  const category = categoryKey(row.product_category);
  const [rules, routeSteps] = await Promise.all([
    db.bomlist_components.findMany({
      where: { bomlist_id: row.id },
      include: { component_type: true },
    }),
    db.bomlist_route_steps.findMany({
      where: { bomlist_id: row.id },
      include: { process: { select: { code: true, name: true } } },
      orderBy: { sequence: "asc" },
    }),
  ]);
  return {
    ...row,
    product_category: category,
    fields: normalizedFields(rules),
    route_steps: routeSteps,
  };
}

router.get("/template", async (req, res) => {
  const modelName = String(req.query.model || "").trim();
  if (!modelName) {
    throw new AppError("model wajib diisi", 400, "VALIDATION");
  }
  const master = await prisma.model.findFirst({
    where: { model: modelName },
    include: {
      category: { select: { slug: true, name: true } },
      bom_templates: {
        include: { component_type: true },
      },
      route_templates: {
        include: { process: { select: { code: true, name: true } } },
        orderBy: { sequence: "asc" },
      },
    },
  });
  if (!master) {
    throw new AppError("Model tidak ditemukan", 404, "NOT_FOUND");
  }
  if (!master.bom_templates.length || !master.route_templates.length) {
    throw new AppError(
      "Template komponen atau route model belum lengkap",
      409,
      "MODEL_TEMPLATE_MISSING",
    );
  }
  res.status(200).json({
    data: {
      model_id: master.id,
      model: master.model,
      product_category: categoryKey(master.category?.slug),
      category_name: master.category?.name ?? null,
      fields: normalizedFields(master.bom_templates),
      route_steps: master.route_templates,
    },
  });
});

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
    const bom = await createNormalizedBom(tx, {
      master,
      category,
      model,
      orderNumber,
      payload,
    });
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
    const bom = await updateNormalizedBom(tx, {
      existing: current,
      master,
      category,
      model,
      orderNumber,
      payload,
    });
    return enrichBom(bom, tx);
  });
  res.status(200).json({ message: "success", data });
});

router.delete("/delete/:id", requirePermission("master-data:write"), async (req, res) => {
  await prisma.bomlist.update({ where: { id: req.params.id }, data: { is_active: false } });
  res.status(200).json({ message: "success" });
});

module.exports = router;
