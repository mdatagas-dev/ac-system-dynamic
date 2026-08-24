const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

// GET /components?category_id=xxx atau ?slug=ac_split
router.get("/", async (req, res) => {
  const { category_id, slug } = req.query;
  try {
    let categoryId = category_id;
    if (slug && !categoryId) {
      const cat = await prisma.product_categories.findUnique({ where: { slug } });
      if (!cat) return res.status(404).json({ error: "Kategori tidak ditemukan" });
      categoryId = cat.id;
    }
    const where = categoryId ? { category_id: categoryId } : {};
    const data = await prisma.component_definitions.findMany({
      where,
      orderBy: [{ sort: "asc" }, { label: "asc" }],
    });
    res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  let { category_id, slug, key, label, required, regex, sort, enabled } = req.body || {};
  if (!key || !label) return res.status(400).json({ error: "key dan label wajib" });
  try {
    if (slug && !category_id) {
      const cat = await prisma.product_categories.findUnique({ where: { slug } });
      if (!cat) return res.status(404).json({ error: "Kategori tidak ditemukan" });
      category_id = cat.id;
    }
    if (!category_id) return res.status(400).json({ error: "category_id atau slug wajib" });
    key = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const exists = await prisma.component_definitions.findUnique({
      where: { category_id_key: { category_id, key } },
    });
    if (exists) return res.status(400).json({ error: "Key sudah ada di kategori ini" });
    const data = await prisma.component_definitions.create({
      data: {
        category_id,
        key,
        label: label.trim(),
        required: !!required,
        regex: regex ? String(regex).trim() : null,
        sort: sort !== undefined ? Number(sort) : 0,
        enabled: enabled !== undefined ? !!enabled : true,
      },
    });
    res.status(201).json({ message: "Created", data });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal Server Error" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { key, label, required, regex, sort, enabled } = req.body || {};
  try {
    const data = await prisma.component_definitions.update({
      where: { id: req.params.id },
      data: {
        ...(key ? { key: key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") } : {}),
        ...(label ? { label: label.trim() } : {}),
        ...(required !== undefined ? { required: !!required } : {}),
        ...(regex !== undefined ? { regex: regex ? String(regex).trim() : null } : {}),
        ...(sort !== undefined ? { sort: Number(sort) } : {}),
        ...(enabled !== undefined ? { enabled: !!enabled } : {}),
      },
    });
    res.status(200).json({ message: "Updated", data });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const data = await prisma.component_definitions.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Deleted", data });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
