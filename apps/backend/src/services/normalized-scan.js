const AppError = require("../../lib/AppError");
const { normalize } = require("./category-specs");

const RESPONSE_FIELDS = {
  ac: ["sn_carton", "pcb_idu", "pcb_odu", "sn_motor", "sn_accessories"],
  wm: ["sn_drum", "sn_pump"],
};

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

function legacyScanShape(event, category) {
  const componentValues = Object.fromEntries(
    (event.production_unit?.components || event.components || []).map((component) => [
      component.component_type.code,
      component.serial_number,
    ]),
  );
  return {
    id: event.id,
    id_regist: event.id_regist,
    sn: event.production_unit?.serial_number || null,
    ...Object.fromEntries(
      RESPONSE_FIELDS[category].map((code) => [code, componentValues[code] || null]),
    ),
    timestamps: event.timestamps,
  };
}

async function normalizedScanRows(db, registrationId, category) {
  const events = await db.recordscan.findMany({
    where: { id_regist: registrationId, deleted_at: null },
    include: {
      components: { include: { component_type: true } },
      production_unit: {
        include: { components: { include: { component_type: true } } },
      },
    },
    orderBy: { timestamps: "desc" },
  });
  return events.map((event) => legacyScanShape(event, category));
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
}) {
  const requiresMainSerial = registration.route_step.requires_main_serial;
  const serialNumber = normalize(payload.sn);
  if (requiresMainSerial && !serialNumber) {
    throw new AppError("Wajib diisi: Serial Number", 400, "MISSING_REQUIRED");
  }
  const applicableRules = requiresMainSerial
    ? registration.component_rules
    : registration.component_rules.filter(
        (rule) => rule.component_type.code !== "sn",
      );
  assertComponentRules(applicableRules, payload);
  const components = componentValues(registration.component_rules, payload);

  await lockOrder(tx, registration.bomlist_id);
  await advisoryLocks(tx, [
    ...(serialNumber ? [`unit:${serialNumber}`] : []),
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

  let unit = serialNumber
    ? await tx.production_units.findUnique({
        where: { serial_number: serialNumber },
        include: { components: true, scan_events: true },
      })
    : null;
  if (unit && unit.bomlist_id !== registration.bomlist_id) {
    throw new AppError(
      "Serial unit sudah terdaftar pada Production Order lain",
      409,
      "SERIAL_ACROSS_ORDERS",
    );
  }
  if (serialNumber && !unit) {
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

  if (unit) {
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
  }

  const created = await tx.recordscan.create({
    data: {
      id_regist: registration.id,
      production_unit_id: unit?.id || null,
      route_step_id: registration.route_step_id,
      scanned_by: await scannerId(tx, user?.id),
      components: {
        create: components.map((component) => ({
          component_type_id: component.componentTypeId,
          route_step_id: registration.route_step_id,
          serial_number: component.serialNumber,
        })),
      },
    },
    include: {
      components: { include: { component_type: true } },
      production_unit: {
        include: { components: { include: { component_type: true } } },
      },
    },
  });
  return {
    created: legacyScanShape(created, registration.product_category),
    unit,
  };
}

async function editNormalizedUnit(tx, {
  registration,
  category,
  recordId,
  payload,
  reason,
  userId,
  pinId,
}) {
  const allowedFields = new Set([
    "id_regist",
    "reason",
    "sn",
    ...RESPONSE_FIELDS[category],
  ]);
  const unknownFields = Object.keys(payload).filter(
    (key) => present(payload[key]) && !allowedFields.has(key),
  );
  if (unknownFields.length) {
    throw new AppError(
      `Field tidak dikenal kategori: ${unknownFields.join(", ")}`,
      400,
      "UNKNOWN_FIELD",
    );
  }
  const event = await tx.recordscan.findUnique({
    where: { id: recordId },
    include: {
      components: { include: { component_type: true } },
      production_unit: {
        include: {
          components: { include: { component_type: true } },
          scan_events: true,
        },
      },
    },
  });
  if (!event || event.deleted_at || event.id_regist !== registration.id) {
    throw new AppError("Unit Scan tidak ditemukan", 404, "NOT_FOUND");
  }

  const unit = event.production_unit;
  if (!unit) {
    throw new AppError(
      "Edit scan komponen tanpa serial utama belum didukung",
      409,
      "COMPONENT_EVENT_EDIT_UNSUPPORTED",
    );
  }
  const currentComponents = Object.fromEntries(
    unit.components.map((component) => [
      component.component_type.code,
      component.serial_number,
    ]),
  );
  const merged = {
    sn: Object.hasOwn(payload, "sn")
      ? normalize(payload.sn)
      : unit.serial_number,
    ...currentComponents,
  };
  for (const code of RESPONSE_FIELDS[category]) {
    if (Object.hasOwn(payload, code)) merged[code] = normalize(payload[code]);
  }
  assertComponentRules(registration.component_rules, merged);

  const nextSerial = merged.sn;
  const changedComponents = registration.component_rules
    .filter(
      (rule) =>
        rule.component_type.code !== "sn" &&
        Object.hasOwn(payload, rule.component_type.code),
    )
    .map((rule) => ({
      rule,
      serialNumber: merged[rule.component_type.code],
    }));

  await lockOrder(tx, registration.bomlist_id);
  await advisoryLocks(tx, [
    `unit:${unit.serial_number}`,
    `unit:${nextSerial}`,
    ...changedComponents
      .filter(({ serialNumber }) => serialNumber)
      .map(
        ({ rule, serialNumber }) =>
          `component:${rule.component_type_id}:${serialNumber}`,
      ),
  ]);

  if (nextSerial !== unit.serial_number) {
    const owner = await tx.production_units.findUnique({
      where: { serial_number: nextSerial },
    });
    if (owner && owner.id !== unit.id) {
      throw new AppError(
        "Serial unit sudah dipakai unit lain",
        409,
        "SERIAL_OWNERSHIP_CONFLICT",
      );
    }
    await tx.production_units.update({
      where: { id: unit.id },
      data: { serial_number: nextSerial },
    });
  }

  for (const { rule, serialNumber } of changedComponents) {
    const current = unit.components.find(
      (component) => component.component_type_id === rule.component_type_id,
    );
    if (!serialNumber) {
      if (current) {
        await tx.production_unit_components.delete({ where: { id: current.id } });
      }
      continue;
    }
    const owner = await tx.production_unit_components.findUnique({
      where: {
        component_type_id_serial_number: {
          component_type_id: rule.component_type_id,
          serial_number: serialNumber,
        },
      },
    });
    if (owner && owner.production_unit_id !== unit.id) {
      throw new AppError(
        `${rule.component_type.code} sudah dipakai unit lain`,
        409,
        "COMPONENT_OWNERSHIP_CONFLICT",
      );
    }
    if (current) {
      await tx.production_unit_components.update({
        where: { id: current.id },
        data: { serial_number: serialNumber },
      });
    } else {
      await tx.production_unit_components.create({
        data: {
          production_unit_id: unit.id,
          component_type_id: rule.component_type_id,
          serial_number: serialNumber,
        },
      });
    }
  }

  const compatibilityData = {
    sn: nextSerial,
    ...Object.fromEntries(
      RESPONSE_FIELDS[category].map((code) => [code, merged[code] || null]),
    ),
  };
  await tx.audit_events.create({
    data: {
      entity_type: "production_unit",
      entity_id: unit.id,
      action: "identity_edit",
      before_data: legacyScanShape(event, category),
      after_data: { ...compatibilityData, id: recordId },
      reason,
      performed_by: userId,
      authorized_pin_id: pinId,
    },
  });
  return {
    ...compatibilityData,
    id: recordId,
    id_regist: registration.id,
    timestamps: event.timestamps,
  };
}

module.exports = {
  assertComponentRules,
  assertRouteProgression,
  createNormalizedScan,
  editNormalizedUnit,
  legacyScanShape,
  normalizedReady,
  normalizedScanRows,
};
