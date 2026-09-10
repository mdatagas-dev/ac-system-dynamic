const prisma = require("../../lib/prisma");
const { stripBrandSuffix } = require("../rules/model-code");
const {
  categoryKey,
  definition,
  fieldsForCategory,
  normalize,
  typedData,
  validatePayload,
} = require("./category-specs");
const AppError = require("../../lib/AppError");

async function findBomlist(db, model, orderNumber) {
  const exact = String(model).trim();
  const order = String(orderNumber).trim();
  const hit = await db.bomlist.findFirst({ where: { model: exact, order_number: order, is_active: true } });
  if (hit) return hit;
  const short = stripBrandSuffix(exact);
  return short === exact ? null : db.bomlist.findFirst({ where: { model: short, order_number: order, is_active: true } });
}

async function loadTypedBom(db, bom) {
  if (!bom) throw new AppError("Batch tidak ada di bomlist", 404, "BOMLIST_NOT_FOUND");
  const category = categoryKey(bom.product_category);
  const spec = await db[definition(category).bomDelegate].findUnique({ where: { bom_id: bom.id } });
  if (!spec) throw new AppError("Spesifikasi kategori BOM belum dibuat", 400, "MISSING_CATEGORY_SPEC");
  return { bom, category, spec };
}

async function loadNormalizedBom(db, bom) {
  if (!bom?.model_id || !bom?.order_quantity) return null;
  const rules = await db.bomlist_components.findMany({
    where: { bomlist_id: bom.id },
    include: { component_type: true },
  });
  return rules.length ? { bom, category: categoryKey(bom.product_category), rules } : null;
}

function validateNormalizedRegistration(rules, payload, requiresMainSerial) {
  const allowed = new Set(rules.map((rule) => rule.component_type.code));
  const metadata = new Set([
    "model", "order_number", "po_number", "subline", "userid", "shift",
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
  const configuredIds = configuredRules
    ? new Set(configuredRules.map((rule) => rule.component_type_id))
    : null;
  return rules
    .filter((rule) => !configuredIds || configuredIds.has(rule.component_type_id))
    .map((rule) => ({
      key: rule.component_type.code,
      label: rule.component_type.label,
      unit: null,
      prefix: rule.prefix || "",
      required: configuredIds ? true : rule.is_required,
    }));
}

async function resolveBomRule({ model, order_number, payload, subline, routeStep, db = prisma }) {
  const bom = await findBomlist(db, model, order_number);
  const normalized = await loadNormalizedBom(db, bom);
  if (normalized) {
    const resolvedRouteStep = routeStep || await db.bomlist_route_steps.findFirst({
      where: {
        bomlist_id: bom.id,
        name: { equals: subline, mode: "insensitive" },
      },
    });
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
  const typed = await loadTypedBom(db, bom);
  const fields = validatePayload(typed.category, typed.spec, payload);
  return { ...typed, fields, normalized: false };
}

async function createRegistrationSpec(db, category, idRegist, payload) {
  return db[definition(category).registrationDelegate].create({ data: { id_regist: idRegist, ...typedData(category, payload) } });
}

async function updateRegistrationSpec(db, category, idRegist, payload) {
  return db[definition(category).registrationDelegate].upsert({
    where: { id_regist: idRegist },
    create: { id_regist: idRegist, ...typedData(category, payload) },
    update: typedData(category, payload, { partial: true }),
  });
}

async function registrationSpec(db, category, idRegist) {
  const normalized = await db.registscan_components.findMany({
    where: { id_regist: idRegist },
    include: { component_type: true },
  });
  if (normalized.length) {
    return Object.fromEntries(
      normalized.map((rule) => [rule.component_type.code, rule.reference_value]),
    );
  }
  return db[definition(category).registrationDelegate].findUnique({ where: { id_regist: idRegist } });
}

module.exports = {
  findBomlist, loadNormalizedBom, loadTypedBom, normalizedFields,
  resolveBomRule, createRegistrationSpec,
  updateRegistrationSpec, registrationSpec,
};
