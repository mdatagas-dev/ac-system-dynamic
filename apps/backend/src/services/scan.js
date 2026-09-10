const AppError = require("../../lib/AppError");
const { assertCanAccessRegistration } = require("./registration-access");
const { createNormalizedScan, normalizedReady } = require("./normalized-scan");

async function lockRegistration(tx, id) {
  const rows = await tx.$queryRaw`
    SELECT id FROM registscan WHERE id = ${id}::uuid FOR UPDATE
  `;
  if (!rows.length) {
    throw new AppError("Regist tidak ditemukan", 404, "REGIST_NOT_FOUND");
  }
}

async function createScan(tx, { user, id_regist, payload }) {
  await lockRegistration(tx, id_regist);
  const registration = await tx.registscan.findUnique({
    where: { id: id_regist },
    include: {
      order: true,
      route_step: true,
      component_rules: { include: { component_type: true } },
    },
  });
  assertCanAccessRegistration(user, registration);
  if (registration.deleted_at) {
    throw new AppError("Regist sudah dihapus", 410, "REGIST_DELETED");
  }
  if (!normalizedReady(registration)) {
    throw new AppError(
      "Relasi registrasi normalized belum lengkap",
      409,
      "NORMALIZED_LINK_MISSING",
    );
  }
  const result = await createNormalizedScan(tx, { registration, user, payload });
  return {
    ...result,
    brand: null,
    po: registration.po_number,
    odf: registration.order_number,
    model: registration.model,
  };
}

module.exports = { createScan };
