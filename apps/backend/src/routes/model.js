const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const requirePermission = require("../../middlewares/requirePermission");
const { categoryKey } = require("../services/category-specs");

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = keyword
    ? {
        OR: [
          { brand: { contains: keyword, mode: "insensitive" } },
          { model: { contains: keyword, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await prisma.model.count({ where });
  const result = await prisma.model.findMany({
    where,
    skip: Number.isNaN(skip) ? 0 : skip,
    take: Number(limit),
    include: { category: { select: { slug: true, name: true } } },
  });

  const resultIndex = result.map(({ category, ...item }, index) => ({
    ...item,
    product_category: category?.slug ?? null,
    category_name: category?.name ?? null,
    index: skip + index + 1,
  }));
  res.status(200).json({
    data: resultIndex,
    total,
    currentPages: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/post", requirePermission("master-data:write"), async (req, res) => {
  const { brand, model, pk, linkimage, category_id, product } = req.body;

  if (!category_id) {
    throw new AppError("Kategori wajib dipilih", 400, "VALIDATION");
  }
  const category = await prisma.product_categories.findUnique({
    where: { id: category_id },
  });
  if (!category) {
    throw new AppError("Kategori tidak ditemukan", 404, "NOT_FOUND");
  }
  categoryKey(category.slug);

  const checkModel = await prisma.model.findFirst({
    where: {
      model: model,
    },
  });

  if (checkModel !== null) {
    throw new AppError("Double Model", 409, "DUPLICATE");
  }

  const result = await prisma.model.create({
    data: {
      brand,
      model,
      pk: Number(pk),
      linkimage,
      category_id,
      product: product || null,
    },
    include: { category: { select: { slug: true, name: true } } },
  });
  res.status(200).json({ message: "Data berhasil ditambah", data: result });
});

router.put("/edit/:id", requirePermission("master-data:write"), async (req, res) => {
  const { id } = req.params;
  const { brand, model, linkimage, category_id, product } = req.body;

  if (category_id) {
    const category = await prisma.product_categories.findUnique({
      where: { id: category_id },
    });
    if (!category) {
      throw new AppError("Kategori tidak ditemukan", 404, "NOT_FOUND");
    }
    categoryKey(category.slug);
  }
  const result = await prisma.model.update({
    where: {
      id: id,
    },
    data: {
      brand,
      model,
      linkimage,
      product,
      ...(category_id ? { category_id } : {}),
    },
    include: { category: { select: { slug: true, name: true } } },
  });
  res.status(201).json(result);
});

router.delete("/delete/:id", requirePermission("master-data:write"), async (req, res) => {
  const { id } = req.params;
  const result = await prisma.model.delete({
    where: {
      id: id,
    },
  });
  res.status(200).json({ result: result, message: "Deleted Succesfully" });
});

module.exports = router;
