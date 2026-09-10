const AppError = require("../../lib/AppError");
const { normalize } = require("./category-specs");

function parseOrderQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "order_quantity harus bilangan bulat positif",
      400,
      "VALIDATION",
    );
  }
  return quantity;
}

function booleanValue(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

async function loadModelTemplates(db, modelId) {
  const [components, routes] = await Promise.all([
    db.model_bom_templates.findMany({
      where: { model_id: modelId },
      include: { component_type: true },
    }),
    db.model_route_steps.findMany({
      where: { model_id: modelId },
      orderBy: { sequence: "asc" },
    }),
  ]);
  if (!components.length || !routes.length) {
    throw new AppError(
      "Template komponen atau route model belum lengkap",
      409,
      "MODEL_TEMPLATE_MISSING",
    );
  }
  return { components, routes };
}

function componentSnapshot(template, payload) {
  const code = template.component_type.code;
  return {
    component_type_id: template.component_type_id,
    prefix: normalize(payload[code]) || template.prefix,
    is_required: booleanValue(
      payload[`${code}_required`],
      template.is_required,
    ),
  };
}

function routeSnapshot(template) {
  return {
    process_id: template.process_id,
    template_step_id: template.id,
    code: template.code,
    name: template.name,
    sequence: template.sequence,
    is_required: template.is_required,
    requires_main_serial: template.requires_main_serial,
  };
}

async function createNormalizedBom(
  db,
  { master, category, model, orderNumber, payload },
) {
  const templates = await loadModelTemplates(db, master.id);
  return db.bomlist.create({
    data: {
      model,
      model_id: master.id,
      order_number: orderNumber,
      po_number: normalize(payload.po_number),
      order_quantity: parseOrderQuantity(payload.order_quantity),
      order_status: "active",
      product_category: category,
      component_rules: {
        create: templates.components.map((template) =>
          componentSnapshot(template, payload),
        ),
      },
      route_steps: {
        create: templates.routes.map(routeSnapshot),
      },
    },
  });
}

async function updateNormalizedBom(
  db,
  { existing, master, category, model, orderNumber, payload },
) {
  const [registrationCount, productionCount] = await Promise.all([
    db.registscan.count({ where: { bomlist_id: existing.id } }),
    db.production_units.count({ where: { bomlist_id: existing.id } }),
  ]);
  if (master.id !== existing.model_id) {
    throw new AppError(
      "Model Production Order tidak dapat diubah",
      409,
      "ORDER_IN_USE",
    );
  }
  const orderQuantity = parseOrderQuantity(payload.order_quantity);
  if (orderQuantity < productionCount) {
    throw new AppError(
      `Quantity tidak boleh di bawah aktual produksi (${productionCount})`,
      400,
      "QUANTITY_BELOW_ACTUAL",
    );
  }
  const templates = await loadModelTemplates(db, master.id);
  const existingRules = await db.bomlist_components.findMany({
    where: { bomlist_id: existing.id },
  });
  const existingByType = new Map(
    existingRules.map((rule) => [rule.component_type_id, rule]),
  );
  for (const template of templates.components) {
    const data = componentSnapshot(template, payload);
    const current = existingByType.get(template.component_type_id);
    if (current) {
      await db.bomlist_components.update({ where: { id: current.id }, data });
    } else if (registrationCount === 0) {
      await db.bomlist_components.create({
        data: { bomlist_id: existing.id, ...data },
      });
    }
  }
  return db.bomlist.update({
    where: { id: existing.id },
    data: {
      model,
      model_id: master.id,
      order_number: orderNumber,
      po_number: normalize(payload.po_number),
      order_quantity: orderQuantity,
      product_category: category,
    },
  });
}

module.exports = {
  createNormalizedBom,
  parseOrderQuantity,
  updateNormalizedBom,
};
