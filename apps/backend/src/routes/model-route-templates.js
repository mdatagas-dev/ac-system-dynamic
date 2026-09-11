const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const requirePermission = require("../../middlewares/requirePermission");
const { ensureModelTemplates } = require("../services/model-templates");

function normalizeSteps(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new AppError("Minimal satu route step wajib diisi", 400, "VALIDATION");
  }
  const seenCodes = new Set();
  const seenSequences = new Set();
  return input.map((step, index) => {
    const code = String(step?.code || "").trim().toLowerCase();
    const name = String(step?.name || "").trim();
    const sequence = Number(step?.sequence ?? index + 1);
    const processId = String(step?.process_id || "").trim();
    const lineId = String(step?.line_id || "").trim();
    if (!code || !name || !processId || !lineId || !Number.isInteger(sequence) || sequence <= 0) {
      throw new AppError("Code, nama, process, Line, dan sequence route wajib valid", 400, "VALIDATION");
    }
    if (seenCodes.has(code) || seenSequences.has(sequence)) {
      throw new AppError("Code dan sequence route tidak boleh duplikat", 400, "DUPLICATE");
    }
    seenCodes.add(code);
    seenSequences.add(sequence);
    return {
      code,
      name,
      sequence,
      line_id: lineId,
      process_id: processId,
      is_required: step?.is_required !== false,
      requires_main_serial: step?.requires_main_serial !== false,
    };
  });
}

async function loadModel(modelId, db = prisma) {
  const model = await db.model.findUnique({
    where: { id: modelId },
    select: {
      id: true,
      model: true,
      brand: true,
      category: { select: { slug: true, name: true } },
      route_templates: {
        include: {
          process: { select: { id: true, code: true, name: true } },
          line_master: { select: { id: true, line: true } },
        },
        orderBy: { sequence: "asc" },
      },
    },
  });
  if (!model) throw new AppError("Model tidak ditemukan", 404, "NOT_FOUND");
  return model;
}

router.get("/", async (req, res) => {
  const modelId = String(req.query.model_id || "").trim();
  if (!modelId) throw new AppError("model_id wajib diisi", 400, "VALIDATION");
  const initial = await loadModel(modelId);
  await ensureModelTemplates(prisma, initial.id, initial.category?.slug);
  const [model, processes, lines] = await Promise.all([
    loadModel(modelId),
    prisma.processes.findMany({ where: { is_active: true }, orderBy: { code: "asc" } }),
    prisma.line.findMany({ where: { line: { not: null } }, orderBy: { line: "asc" } }),
  ]);
  res.status(200).json({ data: { model, processes, lines } });
});

router.put("/:modelId", requirePermission("master-data:write"), async (req, res) => {
  const steps = normalizeSteps(req.body?.steps);
  const model = await loadModel(req.params.modelId);
  const processIds = [...new Set(steps.map((step) => step.process_id))];
  const lineIds = [...new Set(steps.map((step) => step.line_id).filter(Boolean))];
  const processes = await prisma.processes.findMany({
    where: { id: { in: processIds }, is_active: true },
    select: { id: true },
  });
  if (processes.length !== processIds.length) {
    throw new AppError("Process route tidak ditemukan atau tidak aktif", 400, "VALIDATION");
  }
  const lines = await prisma.line.findMany({
    where: { id: { in: lineIds }, line: { not: null } },
    select: { id: true },
  });
  if (lines.length !== lineIds.length || lineIds.length !== steps.length) {
    throw new AppError("Setiap route step wajib memiliki Line aktif", 400, "VALIDATION");
  }

  await prisma.$transaction(async (tx) => {
    for (const step of steps) {
      await tx.model_route_steps.upsert({
        where: { model_id_code: { model_id: model.id, code: step.code } },
        create: { model_id: model.id, ...step },
        update: {
          process_id: step.process_id,
          name: step.name,
          sequence: step.sequence,
          is_required: step.is_required,
          requires_main_serial: step.requires_main_serial,
        },
      });
    }
    await tx.model_route_steps.deleteMany({
      where: {
        model_id: model.id,
        code: { notIn: steps.map((step) => step.code) },
      },
    });
  });

  const updated = await loadModel(model.id);
  res.status(200).json({ data: updated });
});

module.exports = router;
