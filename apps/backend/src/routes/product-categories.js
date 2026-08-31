const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

// GET /product-categories — daftar kategori + jumlah model
router.get("/", async (req, res) => {
  try {
    const data = await prisma.product_categories.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { model: true } } },
    });
    res
      .status(200)
      .json({ data: data.map(({ _count, ...c }) => ({ ...c, model_count: _count.model })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  const { slug, name } = req.body || {};
  if (!slug || !name) {
    return res.status(400).json({ error: "slug dan name wajib" });
  }
  try {
    const normalized = slug.trim().toLowerCase();
    const exists = await prisma.product_categories.findUnique({ where: { slug: normalized } });
    if (exists) {
      return res.status(400).json({ error: "Kategori sudah ada" });
    }
    const data = await prisma.product_categories.create({
      data: { slug: normalized, name: String(name).trim() },
    });
    res.status(201).json({ message: "Created", data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name wajib" });
  try {
    const data = await prisma.product_categories.update({
      where: { id: req.params.id },
      data: { name: String(name).trim() },
    });
    res.status(200).json({ message: "Updated", data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const count = await prisma.model.count({ where: { category_id: req.params.id } });
    if (count > 0) {
      return res
        .status(400)
        .json({ error: `Kategori dipakai ${count} model — pindahkan model dulu` });
    }
    await prisma.product_categories.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
