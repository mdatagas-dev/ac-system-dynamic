const AppError = require("../../lib/AppError");
const { normalize } = require("./category-specs");

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function assertComponentRules(rules, payload) {
  for (const rule of rules) {
    const { code, label } = rule.component_type;
    const value = payload[code];
    if (rule.is_required && !present(value)) {
      throw new AppError(`Wajib diisi: ${label}`, 400, "MISSING_REQUIRED");
    }
    if (!present(value)) continue;
    const normalized = normalize(value);
    if (rule.expected_length && normalized.length !== rule.expected_length) {
      throw new AppError(
        `Panjang ${label} harus ${rule.expected_length} karakter (sesuai registrasi)`,
        400,
        "LENGTH_MISMATCH",
      );
    }
    const prefix = normalize(rule.prefix_snapshot);
    if (prefix && !normalized.startsWith(prefix)) {
      throw new AppError(
        `${code} tidak sesuai BOM (diharapkan prefix: ${prefix})`,
        400,
        "BOM_MISMATCH",
      );
    }
  }
}

function assertRouteProgression(currentStep, configuredSteps, completedStepIds) {
  const completed = new Set(completedStepIds);
  if (completed.has(currentStep.id)) {
    throw new AppError(
      `Double Scan di ${currentStep.name}`,
      400,
      "DOUBLE_SCAN",
    );
  }
  const missing = configuredSteps.find(
    (step) =>
      step.is_required &&
      step.sequence < currentStep.sequence &&
      !completed.has(step.id),
  );
  if (missing) {
    throw new AppError(
      `unit belum melalui ${missing.name}`,
      400,
      "ORDER_VIOLATION",
    );
  }
}

function normalizedReady(registration) {
  return Boolean(
    registration?.bomlist_id &&
      registration?.route_step_id &&
      registration?.order &&
      registration?.route_step,
  );
}

async function advisoryLocks(tx, keys) {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`;
  }
}

async function lockOrder(tx, id) {
  const rows = await tx.$queryRaw`SELECT id FROM bomlist WHERE id = ${id}::uuid FOR UPDATE`;
  if (!rows.length) {
    throw new AppError("Production Order tidak ditemukan", 404, "ORDER_NOT_FOUND");
  }
}

function componentValues(rules, payload) {
  return rules
    .filter((rule) => rule.component_type.code !== "sn")
    .map((rule) => ({
      componentTypeId: rule.component_type_id,
      code: rule.component_type.code,
      serialNumber: normalize(payload[rule.component_type.code]),
    }))
    .filter((component) => component.serialNumber);
}

async function assertAndCreateComponents(tx, unit, components) {
  const existingByType = new Map(
    unit.components.map((component) => [
      component.component_type_id,
      component.serial_number,
    ]),
  );
  for (const component of components) {
    const existingSerial = existingByType.get(component.componentTypeId);
    if (existingSerial && existingSerial !== component.serialNumber) {
      throw new AppError(
        `${component.code} untuk unit ini sudah berbeda`,
        409,
        "UNIT_COMPONENT_CONFLICT",
      );
    }
    const owner = await tx.production_unit_components.findUnique({
      where: {
        component_type_id_serial_number: {
          component_type_id: component.componentTypeId,
          serial_number: component.serialNumber,
        },
      },
    });
    if (owner && owner.production_unit_id !== unit.id) {
      throw new AppError(
        `${component.code} sudah dipakai unit lain`,
        409,
        "COMPONENT_OWNERSHIP_CONFLICT",
      );
    }
    if (!existingSerial) {
      await tx.production_unit_components.create({
        data: {
          production_unit_id: unit.id,
          component_type_id: component.componentTypeId,
          serial_number: component.serialNumber,
        },
      });
    }
  }
}

async function scannerId(tx, userId) {
  if (!userId) return null;
  const user = await tx.users.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return user?.id || null;
}

async function createNormalizedScan(tx, {
  registration,
  user,
  payload,
  legacyDelegate,
  legacyData,
}) {
  const serialNumber = normalize(payload.sn);
  assertComponentRules(registration.component_rules, payload);
  const components = componentValues(registration.component_rules, payload);

  await lockOrder(tx, registration.bomlist_id);
  await advisoryLocks(tx, [
    `unit:${serialNumber}`,
    ...components.map(
      (component) =>
        `component:${component.componentTypeId}:${component.serialNumber}`,
    ),
  ]);

  const registrationCount = await tx.recordscan.count({
    where: { id_regist: registration.id, deleted_at: null },
  });
  if (registration.plan && registrationCount >= registration.plan) {
    throw new AppError(
      "Target plan registrasi sudah tercapai",
      400,
      "PLAN_REACHED",
    );
  }

  let unit = await tx.production_units.findUnique({
    where: { serial_number: serialNumber },
    include: { components: true, scan_events: true },
  });
  if (unit && unit.bomlist_id !== registration.bomlist_id) {
    throw new AppError(
      "Serial unit sudah terdaftar pada Production Order lain",
      409,
      "SERIAL_ACROSS_ORDERS",
    );
  }
  if (!unit) {
    const unitCount = await tx.production_units.count({
      where: { bomlist_id: registration.bomlist_id },
    });
    if (unitCount >= registration.order.order_quantity) {
      throw new AppError(
        "Jumlah Production Order sudah tercapai",
        400,
        "ORDER_QUANTITY_REACHED",
      );
    }
    unit = await tx.production_units.create({
      data: { bomlist_id: registration.bomlist_id, serial_number: serialNumber },
      include: { components: true, scan_events: true },
    });
  }

  const routeSteps = await tx.bomlist_route_steps.findMany({
    where: { bomlist_id: registration.bomlist_id },
    orderBy: { sequence: "asc" },
  });
  assertRouteProgression(
    registration.route_step,
    routeSteps,
    unit.scan_events
      .filter((event) => !event.deleted_at)
      .map((event) => event.route_step_id),
  );
  await assertAndCreateComponents(tx, unit, components);

  const created = await legacyDelegate.create({
    data: { id_regist: registration.id, ...legacyData },
  });
  await tx.recordscan.create({
    data: {
      id_regist: registration.id,
      production_unit_id: unit.id,
      route_step_id: registration.route_step_id,
      scanned_by: await scannerId(tx, user?.id),
      timestamps: created.timestamps,
      legacy_source_table:
        registration.product_category === "ac"
          ? "recordscan_ac"
          : "recordscan_wm",
      legacy_source_id: created.id,
    },
  });
  return { created, unit };
}

module.exports = {
  assertComponentRules,
  assertRouteProgression,
  createNormalizedScan,
  normalizedReady,
};
