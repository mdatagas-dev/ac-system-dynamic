const AppError = require("../../lib/AppError");
const { normalize } = require("./category-specs");

const STRUCTURAL_FIELDS = ["bomlist_id", "line_id", "route_step_id"];

function assertPlanNotBelowScans(plan, activeScans) {
  if (plan < activeScans) {
    throw new AppError(
      `Plan tidak boleh di bawah aktual produksi (${activeScans})`,
      400,
      "PLAN_BELOW_ACTUAL",
    );
  }
}

function structuralChanges(existing, next) {
  return STRUCTURAL_FIELDS.filter(
    (field) => next[field] !== undefined && next[field] !== existing[field],
  );
}

function referenceChanges(existingSpec, payload, fieldKeys) {
  return fieldKeys.filter(
    (key) =>
      Object.hasOwn(payload, key) &&
      normalize(payload[key]) !== normalize(existingSpec?.[key]),
  );
}

function jakartaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00.000Z`);
}

async function authorizePin(db, rawPin) {
  const value = String(rawPin || "").trim();
  if (!value) {
    throw new AppError("PIN harian wajib", 403, "PIN_REQUIRED");
  }
  const numericPin = Number(value);
  const record = Number.isFinite(numericPin)
    ? await db.pin.findFirst({
        where: { date: jakartaDate(), pin: numericPin },
      })
    : null;
  if (!record) {
    throw new AppError("PIN harian tidak sesuai", 403, "PIN_INVALID");
  }
  return record;
}

function requireReason(value) {
  const reason = String(value || "").trim();
  if (!reason) {
    throw new AppError(
      "Alasan perubahan wajib diisi",
      400,
      "REASON_REQUIRED",
    );
  }
  return reason;
}

async function auditRegistration(db, {
  registrationId,
  action,
  before,
  after,
  reason,
  userId,
  pinId,
}) {
  await db.audit_events.create({
    data: {
      entity_type: "registration",
      entity_id: registrationId,
      action,
      before_data: before,
      after_data: after,
      reason,
      performed_by: userId,
      authorized_pin_id: pinId,
    },
  });
}

async function normalizedRegistrationData(db, bom, subline) {
  if (!bom.model_id || !bom.order_quantity) return null;
  const [line, routeStep] = await Promise.all([
    db.line.findFirst({
      where: { line: { equals: subline, mode: "insensitive" } },
    }),
    db.bomlist_route_steps.findFirst({
      where: {
        bomlist_id: bom.id,
        name: { equals: subline, mode: "insensitive" },
      },
    }),
  ]);
  if (!line || !routeStep) {
    throw new AppError(
      "Line atau route Production Order belum tersedia",
      409,
      "NORMALIZED_LINK_MISSING",
    );
  }
  return {
    bomlist_id: bom.id,
    line_id: line.id,
    route_step_id: routeStep.id,
    production_date: jakartaDate(),
  };
}

async function createComponentSnapshots(db, registrationId, bomId, payload) {
  const rules = await db.bomlist_components.findMany({
    where: { bomlist_id: bomId },
    include: { component_type: true },
  });
  if (rules.length === 0) {
    throw new AppError(
      "BOM Requirement normalized belum tersedia",
      409,
      "NORMALIZED_LINK_MISSING",
    );
  }
  await db.registscan_components.createMany({
    data: rules.map((rule) => {
      const reference = normalize(payload[rule.component_type.code]);
      return {
        id_regist: registrationId,
        component_type_id: rule.component_type_id,
        reference_value: reference,
        expected_length: reference?.length || null,
        is_required: rule.is_required,
        prefix_snapshot: rule.prefix,
      };
    }),
  });
}

module.exports = {
  assertPlanNotBelowScans,
  auditRegistration,
  authorizePin,
  referenceChanges,
  requireReason,
  createComponentSnapshots,
  normalizedRegistrationData,
  structuralChanges,
};
