const AppError = require("../../lib/AppError");
const { categoryKey } = require("./category-specs");

const COMPONENTS = {
  ac: [
    ["sn", true],
    ["sn_odu", false],
    ["sn_carton", false],
    ["pcb_idu", false],
    ["pcb_odu", false],
    ["sn_box", false],
    ["sn_motor", false],
    ["sn_accessories", false],
  ],
  wm: [
    ["sn", true],
    ["sn_drum", true],
    ["sn_pump", false],
  ],
};

const ROUTES = {
  ac: [
    ["LINE IDU ASSY INPUT", "idu-assembly-input", "assembly", 10],
    ["LINE IDU ASSY OUTPUT", "idu-assembly-output", "assembly", 20],
    ["LINE ODU ASSY INPUT", "odu-assembly-input", "assembly", 30],
    ["LINE ODU ASSY OUTPUT", "odu-assembly-output", "assembly", 40],
    ["LINE IDU TESTING INPUT", "idu-testing-input", "testing", 50],
    ["LINE IDU TESTING OUTPUT", "idu-testing-output", "testing", 60],
    ["LINE ODU TESTING INPUT", "odu-testing-input", "testing", 70],
    ["LINE ODU TESTING OUTPUT", "odu-testing-output", "testing", 80],
    ["LINE IDU PACKING INPUT", "idu-packing-input", "packing", 90],
    ["LINE IDU PACKING OUTPUT", "idu-packing-output", "packing", 100],
    ["LINE ODU PACKING INPUT", "odu-packing-input", "packing", 110],
    ["LINE ODU PACKING OUTPUT", "odu-packing-output", "packing", 120],
  ],
  wm: [
    ["LINE WM ASSY INPUT", "wm-assembly-input", "assembly", 110],
    ["LINE WM ASSY OUTPUT", "wm-assembly-output", "assembly", 120],
    ["LINE WM PACKING INPUT", "wm-packing-input", "packing", 130],
    ["LINE WM PACKING OUTPUT", "wm-packing-output", "packing", 140],
  ],
};

async function ensureModelTemplates(db, modelId, category) {
  const key = categoryKey(category);
  const [componentCount, routeCount] = await Promise.all([
    db.model_bom_templates.count({ where: { model_id: modelId } }),
    db.model_route_steps.count({ where: { model_id: modelId } }),
  ]);
  // Existing models may have been configured/backfilled with custom rows.
  // Only fill the missing side; do not overwrite or reorder those rows.
  const needsComponents = componentCount === 0;
  const needsRoutes = routeCount === 0;
  if (!needsComponents && !needsRoutes) return;

  const componentTypes = await db.component_types.findMany({
    where: { code: { in: COMPONENTS[key].map(([code]) => code) } },
    select: { id: true, code: true },
  });
  const componentByCode = new Map(componentTypes.map((type) => [type.code, type]));
  const missingComponents = COMPONENTS[key]
    .filter(([code]) => !componentByCode.has(code))
    .map(([code]) => code);
  if (missingComponents.length) {
    throw new AppError(
      `Component Type belum di-seed: ${missingComponents.join(", ")}`,
      409,
      "MODEL_TEMPLATE_MISSING",
    );
  }

  const processes = await db.processes.findMany({
    where: { code: { in: ROUTES[key].map(([, , processCode]) => processCode) } },
    select: { id: true, code: true },
  });
  const processByCode = new Map(processes.map((process) => [process.code, process]));
  const missingProcesses = [...new Set(
    ROUTES[key]
      .map(([, , processCode]) => processCode)
      .filter((code) => !processByCode.has(code)),
  )];
  if (missingProcesses.length) {
    throw new AppError(
      `Process belum di-seed: ${missingProcesses.join(", ")}`,
      409,
      "MODEL_TEMPLATE_MISSING",
    );
  }

  if (needsComponents) {
    await db.model_bom_templates.createMany({
      data: COMPONENTS[key].map(([code, isRequired]) => ({
        model_id: modelId,
        component_type_id: componentByCode.get(code).id,
        is_required: isRequired,
      })),
      skipDuplicates: true,
    });
  }
  if (needsRoutes) {
    await db.model_route_steps.createMany({
      data: ROUTES[key].map(([name, code, processCode, sequence]) => ({
        model_id: modelId,
        process_id: processByCode.get(processCode).id,
        code,
        name,
        sequence,
        is_required: true,
        requires_main_serial: true,
      })),
      skipDuplicates: true,
    });
  }
}

module.exports = { ensureModelTemplates };
