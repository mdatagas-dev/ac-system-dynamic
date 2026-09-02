const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const { validateTemplate, normalizeTemplate } = require("../rules/bom-match");

// Audit template: tulis baris audit setiap kali fields berubah (create, atau edit yang
// memuat fields). Slug tanpa FK — baris bertahan walau kategori dihapus.
async function auditFields(slug, fields, changedBy) {
  await prisma.product_categories_audit.create({
    data: { slug, fields, changed_by: changedBy || "unknown" },
  });
}

// GET /product-categories — daftar kategori + jumlah model
router.get("/", async (req, res) => {
  const data = await prisma.product_categories.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { model: true } } },
  });
  res
    .status(200)
    .json({ data: data.map(({ _count, ...c }) => ({ ...c, model_count: _count.model })) });
});

router.post("/post", async (req, res) => {
  const { slug, name, fields } = req.body || {};
  if (!slug || !name) {
    throw new AppError("slug dan name wajib", 400, "VALIDATION");
  }
  const normalized = slug.trim().toLowerCase();
  const exists = await prisma.product_categories.findUnique({ where: { slug: normalized } });
  if (exists) {
    throw new AppError("Kategori sudah ada", 400, "DUPLICATE");
  }
  let normFields = null;
  if (fields !== undefined && fields !== null) {
    const err = validateTemplate(fields);
    if (err) throw new AppError(`Template tidak valid: ${err}`, 400, "VALIDATION");
    normFields = normalizeTemplate(fields);
  }
  const data = await prisma.product_categories.create({
    data: { slug: normalized, name: String(name).trim(), fields: normFields },
  });
  await auditFields(normalized, normFields, req.user?.username);
  res.status(201).json({ message: "Created", data });
});

router.put("/edit/:id", async (req, res) => {
  const { name, fields } = req.body || {};
  if (!name) throw new AppError("name wajib", 400, "VALIDATION");
  let normFields;
  if (fields !== undefined && fields !== null) {
    const err = validateTemplate(fields);
    if (err) throw new AppError(`Template tidak valid: ${err}`, 400, "VALIDATION");
    normFields = normalizeTemplate(fields);
  }
  const data = await prisma.product_categories.update({
    where: { id: req.params.id },
    data: { name: String(name).trim(), ...(fields !== undefined ? { fields: normFields } : {}) },
  });
  // audit hanya saat fields disentuh — perubahan nama tidak menyentuh traceability
  if (fields !== undefined) await auditFields(data.slug, normFields, req.user?.username);
  res.status(200).json({ message: "Updated", data });
});

router.delete("/delete/:id", async (req, res) => {
  const count = await prisma.model.count({ where: { category_id: req.params.id } });
  if (count > 0) {
    throw new AppError(
      `Kategori dipakai ${count} model — pindahkan model dulu`,
      400,
      "VALIDATION",
    );
  }
  await prisma.product_categories.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Deleted" });
});

module.exports = router;
