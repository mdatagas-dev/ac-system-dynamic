const prisma = require("../../lib/prisma");
const { stripBrandSuffix } = require("../rules/model-code");
const { categoryKey, normalize } = require("./category-specs");
const AppError = require("../../lib/AppError");

async function findBomlist(db, model, orderNumber) {
  const exact = String(model).trim();
  const order = String(orderNumber).trim();
  const hit = await db.bomlist.findFirst({ where: { model: exact, order_number: order, is_active: true } });
  if (hit) return hit;
  const short = stripBrandSuffix(exact);
  return short === exact ? null : db.bomlist.findFirst({ where: { model: short, order_number: order, is_active: true } });
}

async function loadNormalizedBom(db, bom) {
  if (!bom) throw new AppError("Batch tidak ada di bomlist", 404, "BOMLIST_NOT_FOUND");
  if (!bom.model_id || !bom.order_quantity) {
    throw new AppError("Production Order belum normalized", 409, "NORMALIZED_LINK_MISSING");
  }
  const rules = await db.bomlist_components.findMany({
    where: { bomlist_id: bom.id },
    include: { component_type: true },
  });
  if (!rules.length) {
    throw new AppError("BOM Requirement belum tersedia", 409, "NORMALIZED_LINK_MISSING");
  }
  return { bom, category: categoryKey(bom.product_category), rules };
}

function validateNormalizedRegistration(rules, payload, requiresMainSerial) {
  const allowed = new Set(rules.map((rule) => rule.component_type.code));
  const metadata = new Set([
    "model", "order_number", "po_number", "subline", "line_id", "route_step_id", "userid", "shift",
    "plan", "id_regist", "product_category", "reason",
  ]);
  const unknown = Object.keys(payload).filter(
    (key) => !metadata.has(key) && !allowed.has(key) && payload[key],
  );
  if (unknown.length) {
    throw new AppError(
      `Field tidak dikenal kategori: ${unknown.join(", ")}`,
      400,
      "UNKNOWN_FIELD",
    );
  }
  if (requiresMainSerial && !normalize(payload.sn)) {
    throw new AppError("Wajib diisi: Serial Number", 400, "MISSING_REQUIRED");
  }
  const configured = rules.filter((rule) => normalize(payload[rule.component_type.code]));
  if (!configured.length) {
    throw new AppError("Minimal satu komponen scan wajib diisi", 400, "MISSING_REQUIRED");
  }
  for (const rule of configured) {
    const value = normalize(payload[rule.component_type.code]);
    const prefix = normalize(rule.prefix);
    if (prefix && !value.startsWith(prefix)) {
      throw new AppError(
        `${rule.component_type.code} tidak sesuai BOM (diharapkan prefix: ${prefix})`,
        400,
        "BOM_MISMATCH",
      );
    }
  }
  return configured;
}

function normalizedFields(rules, configuredRules = null) {
  const configuredById = configuredRules
    ? new Map(configuredRules.map((rule) => [rule.component_type_id, rule]))
    : null;
  return rules
    .filter((rule) => !configuredById || configuredById.has(rule.component_type_id))
    .map((rule) => {
      const configured = configuredById?.get(rule.component_type_id);
      return {
        key: rule.component_type.code,
        label: rule.component_type.label,
        unit: null,
        prefix: rule.prefix || "",
        required: configuredById ? true : rule.is_required,
        expected_length: configured?.expected_length ?? null,
      };
    });
}

async function resolveBomRule({ model, order_number, payload, subline, routeStep, routeStepId, lineId, db = prisma }) {
  const bom = await findBomlist(db, model, order_number);
  const normalized = await loadNormalizedBom(db, bom);
  const routeSelect = {
    include: { line_master: { select: { id: true, line: true } } },
  };
  const resolvedRouteStep = routeStep || (routeStepId
    ? await db.bomlist_route_steps.findFirst({
        where: { id: String(routeStepId), bomlist_id: bom.id },
        ...routeSelect,
      })
    : lineId
      ? await db.bomlist_route_steps.findFirst({
          where: { bomlist_id: bom.id, line_id: String(lineId) },
          ...routeSelect,
          orderBy: { sequence: "asc" },
        })
    : await db.bomlist_route_steps.findFirst({
        where: {
          bomlist_id: bom.id,
          name: { equals: subline, mode: "insensitive" },
        },
        ...routeSelect,
      }));
  if (!resolvedRouteStep) {
    throw new AppError(
      "Route Production Order belum tersedia",
      409,
      "NORMALIZED_LINK_MISSING",
    );
  }
  const rules = validateNormalizedRegistration(
    normalized.rules,
    payload,
    resolvedRouteStep.requires_main_serial,
  );
  return {
    ...normalized,
    rules,
    routeStep: resolvedRouteStep,
    normalized: true,
  };
}

async function registrationSpec(db, category, idRegist) {
  const normalized = await db.registscan_components.findMany({
    where: { id_regist: idRegist },
    include: { component_type: true },
  });
  return Object.fromEntries(
    normalized.map((rule) => [rule.component_type.code, rule.reference_value]),
  );
}

module.exports = {
  findBomlist,
  loadNormalizedBom,
  normalizedFields,
  registrationSpec,
  resolveBomRule,
};
