const prisma = require("../../lib/prisma");
const { stripBrandSuffix } = require("../rules/model-code");
const { categoryKey, definition, fieldsForCategory, validatePayload, typedData } = require("./category-specs");
const { unitFromSubline } = require("../rules/unit");
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

async function resolveBomRule({ model, order_number, payload, subline, db = prisma }) {
  const typed = await loadTypedBom(db, await findBomlist(db, model, order_number));
  const fields = validatePayload(typed.category, typed.spec, payload, unitFromSubline(subline));
  return { ...typed, fields };
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
  return db[definition(category).registrationDelegate].findUnique({ where: { id_regist: idRegist } });
}

module.exports = {
  findBomlist, loadTypedBom, resolveBomRule, createRegistrationSpec,
  updateRegistrationSpec, registrationSpec,
};
