const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const { categoryKey } = require("../services/category-specs");

router.get("/", async (_req, res) => {
  const data = await prisma.product_categories.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { model: true } } },
  });
  res.status(200).json({ data: data.map(({ _count, ...category }) => ({ ...category, model_count: _count.model })) });
});

router.post("/post", async (req, res) => {
  const { slug, name } = req.body || {};
  if (!slug || !name) throw new AppError("slug dan name wajib", 400, "VALIDATION");
  const normalized = categoryKey(slug);
  const exists = await prisma.product_categories.findUnique({ where: { slug: normalized } });
  if (exists) throw new AppError("Kategori sudah ada", 409, "DUPLICATE");
  const data = await prisma.product_categories.create({ data: { slug: normalized, name: String(name).trim() } });
  res.status(201).json({ message: "Created", data });
});

router.put("/edit/:id", async (req, res) => {
  const { name } = req.body || {};
  if (!name) throw new AppError("name wajib", 400, "VALIDATION");
  const existing = await prisma.product_categories.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError("Kategori tidak ditemukan", 404, "NOT_FOUND");
  categoryKey(existing.slug);
  const data = await prisma.product_categories.update({ where: { id: req.params.id }, data: { name: String(name).trim() } });
  res.status(200).json({ message: "Updated", data });
});

router.delete("/delete/:id", async (req, res) => {
  const count = await prisma.model.count({ where: { category_id: req.params.id } });
  if (count > 0) throw new AppError(`Kategori dipakai ${count} model — pindahkan model dulu`, 400, "VALIDATION");
  await prisma.product_categories.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Deleted" });
});

module.exports = router;
