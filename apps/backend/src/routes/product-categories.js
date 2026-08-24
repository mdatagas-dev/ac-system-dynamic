const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/", async (req, res) => {
  try {
    const data = await prisma.product_categories.findMany({ orderBy: { name: "asc" } });
    res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  const { slug, name, suffix_length } = req.body || {};
  if (!slug || !name) return res.status(400).json({ error: "slug dan name wajib" });
  try {
    const exists = await prisma.product_categories.findUnique({ where: { slug: slug.trim().toLowerCase() } });
    if (exists) return res.status(400).json({ error: "Kategori sudah ada" });
    const data = await prisma.product_categories.create({
      data: { slug: slug.trim().toLowerCase(), name: name.trim(), suffix_length: Number(suffix_length) || 5 },
    });
    res.status(201).json({ message: "Created", data });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { slug, name, suffix_length } = req.body || {};
  try {
    const data = await prisma.product_categories.update({
      where: { id },
      data: {
        ...(slug ? { slug: slug.trim().toLowerCase() } : {}),
        ...(name ? { name: name.trim() } : {}),
        ...(suffix_length !== undefined ? { suffix_length: Number(suffix_length) } : {}),
      },
    });
    res.status(200).json({ message: "Updated", data });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const data = await prisma.product_categories.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Deleted", data });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
