#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");
const {
  assertSafeDatabaseUrl,
  persistQuarantineEntries,
} = require("./database-redesign-preflight");
const { normalizeText } = require("./database-redesign-backfill");

const SCAN_BACKFILL_CONFIRMATION = "WRITE_TEST_PHASE4_BACKFILL";
const COMPONENT_FIELDS = {
  ac: [
    "sn_odu",
    "sn_carton",
    "pcb_idu",
    "pcb_odu",
    "sn_box",
    "sn_motor",
    "sn_accessories",
  ],
  wm: ["sn_drum", "sn_pump"],
};

function assertScanBackfillWriteAllowed(databaseUrl, confirmation) {
  assertSafeDatabaseUrl(databaseUrl);
  if (confirmation !== SCAN_BACKFILL_CONFIRMATION) {
    throw new Error(
      `Scan backfill write confirmation must be ${SCAN_BACKFILL_CONFIRMATION}`,
    );
  }
}

function orderedScans(scans) {
  return [...scans].sort((left, right) => {
    const timestamp = new Date(left.timestamp) - new Date(right.timestamp);
    if (timestamp !== 0) return timestamp;
    const table = left.sourceTable.localeCompare(right.sourceTable);
    if (table !== 0) return table;
    return left.sourceId.localeCompare(right.sourceId);
  });
}

function conflict(scan, reasonCode, details = {}) {
  return {
    sourceTable: scan.sourceTable,
    sourceId: scan.sourceId,
    reasonCode,
    details: {
      registrationId: scan.registrationId,
      serialNumber: normalizeText(scan.serialNumber),
      ...details,
    },
  };
}

function existingState(state = {}) {
  return {
    units: state.units || [],
    components: state.components || [],
    events: state.events || [],
  };
}

function buildScanBackfillPlan(scans, componentTypeIds, currentState) {
  const state = existingState(currentState);
  const unitsBySerial = new Map(
    state.units.map((unit) => [normalizeText(unit.serialNumber), unit.bomlistId]),
  );
  const unitCountsByOrder = new Map();
  for (const unit of state.units) {
    unitCountsByOrder.set(
      unit.bomlistId,
      (unitCountsByOrder.get(unit.bomlistId) || 0) + 1,
    );
  }
  const componentsByIdentity = new Map();
  const ownersByComponent = new Map();
  for (const component of state.components) {
    const identity = `${normalizeText(component.ownerSerial)}|${component.componentTypeId}`;
    const ownership = `${component.componentTypeId}|${normalizeText(component.serialNumber)}`;
    componentsByIdentity.set(identity, normalizeText(component.serialNumber));
    ownersByComponent.set(ownership, normalizeText(component.ownerSerial));
  }
  const eventKeys = new Set(
    state.events.map(
      (event) => `${normalizeText(event.serialNumber)}|${event.routeStepId}`,
    ),
  );
  const legacyEventKeys = new Set(
    state.events
      .filter((event) => event.sourceTable && event.sourceId)
      .map((event) => `${event.sourceTable}|${event.sourceId}`),
  );

  const plan = { units: [], components: [], events: [], conflicts: [] };
  for (const scan of orderedScans(scans)) {
    const serialNumber = normalizeText(scan.serialNumber);
    if (!serialNumber) {
      plan.conflicts.push(conflict(scan, "BLANK_MAIN_SERIAL"));
      continue;
    }
    if (
      !scan.registrationId ||
      !scan.bomlistId ||
      !scan.routeStepId ||
      !Number.isInteger(scan.orderQuantity) ||
      scan.orderQuantity <= 0
    ) {
      plan.conflicts.push(conflict(scan, "MISSING_NORMALIZED_LINK"));
      continue;
    }
    if (!COMPONENT_FIELDS[scan.category]) {
      plan.conflicts.push(
        conflict(scan, "UNSUPPORTED_CATEGORY", { category: scan.category }),
      );
      continue;
    }

    const knownOrder = unitsBySerial.get(serialNumber);
    if (knownOrder && knownOrder !== scan.bomlistId) {
      plan.conflicts.push(
        conflict(scan, "SERIAL_ACROSS_ORDERS", {
          firstBomlistId: knownOrder,
          conflictingBomlistId: scan.bomlistId,
        }),
      );
      continue;
    }
    if (!knownOrder) {
      const nextUnitCount = (unitCountsByOrder.get(scan.bomlistId) || 0) + 1;
      if (nextUnitCount > scan.orderQuantity) {
        plan.conflicts.push(
          conflict(scan, "ORDER_QUANTITY_EXCEEDED", {
            orderQuantity: scan.orderQuantity,
            inferredUnitCount: nextUnitCount,
          }),
        );
        continue;
      }
      unitsBySerial.set(serialNumber, scan.bomlistId);
      unitCountsByOrder.set(scan.bomlistId, nextUnitCount);
      plan.units.push({ serialNumber, bomlistId: scan.bomlistId });
    }

    let componentConflict = false;
    const scanComponents = [];
    for (const code of COMPONENT_FIELDS[scan.category]) {
      const componentSerial = normalizeText(scan.values?.[code]);
      if (!componentSerial) continue;
      const componentTypeId = componentTypeIds[code];
      if (!componentTypeId) {
        plan.conflicts.push(
          conflict(scan, "MISSING_COMPONENT_TYPE", { componentCode: code }),
        );
        componentConflict = true;
        continue;
      }
      const identity = `${serialNumber}|${componentTypeId}`;
      const existingSerial = componentsByIdentity.get(identity);
      if (existingSerial && existingSerial !== componentSerial) {
        plan.conflicts.push(
          conflict(scan, "UNIT_COMPONENT_CONFLICT", {
            componentCode: code,
            firstSerial: existingSerial,
            conflictingSerial: componentSerial,
          }),
        );
        componentConflict = true;
        continue;
      }
      const ownership = `${componentTypeId}|${componentSerial}`;
      const existingOwner = ownersByComponent.get(ownership);
      if (existingOwner && existingOwner !== serialNumber) {
        plan.conflicts.push(
          conflict(scan, "COMPONENT_OWNERSHIP_CONFLICT", {
            componentCode: code,
            componentSerial,
            firstOwner: existingOwner,
            conflictingOwner: serialNumber,
          }),
        );
        componentConflict = true;
        continue;
      }
      componentsByIdentity.set(identity, componentSerial);
      ownersByComponent.set(ownership, serialNumber);
      if (!existingSerial) {
        scanComponents.push({
          ownerSerial: serialNumber,
          componentTypeId,
          serialNumber: componentSerial,
        });
      }
    }
    if (componentConflict) continue;
    plan.components.push(...scanComponents);

    const legacyKey = `${scan.sourceTable}|${scan.sourceId}`;
    if (legacyEventKeys.has(legacyKey)) continue;
    const eventKey = `${serialNumber}|${scan.routeStepId}`;
    if (eventKeys.has(eventKey)) {
      plan.conflicts.push(conflict(scan, "DUPLICATE_UNIT_ROUTE_STEP"));
      continue;
    }
    eventKeys.add(eventKey);
    legacyEventKeys.add(legacyKey);
    plan.events.push({
      sourceTable: scan.sourceTable,
      sourceId: scan.sourceId,
      registrationId: scan.registrationId,
      serialNumber,
      routeStepId: scan.routeStepId,
      scannedBy: scan.scannedBy || null,
      timestamp: scan.timestamp,
    });
  }
  return plan;
}

function scannerUser(registration, usersById, usersByName) {
  const raw = String(registration.userid || "").trim();
  if (usersById.has(raw)) return raw;
  const matches = usersByName.get(normalizeText(raw)) || [];
  return matches.length === 1 ? matches[0].id : null;
}

function legacyScan(row, sourceTable, category, usersById, usersByName) {
  const registration = row.registration;
  return {
    sourceTable,
    sourceId: row.id,
    registrationId: row.id_regist,
    bomlistId: registration.bomlist_id,
    orderQuantity: registration.order?.order_quantity,
    routeStepId: registration.route_step_id,
    scannedBy: scannerUser(registration, usersById, usersByName),
    timestamp: row.timestamps,
    serialNumber: row.sn,
    category,
    values: Object.fromEntries(
      COMPONENT_FIELDS[category].map((code) => [code, row[code]]),
    ),
  };
}

async function loadBackfillInput(prisma) {
  const registration = {
    select: {
      id: true,
      userid: true,
      bomlist_id: true,
      route_step_id: true,
      order: { select: { order_quantity: true } },
    },
  };
  const [acRows, wmRows, componentTypes, users, units, components, events] =
    await Promise.all([
      prisma.recordscan_ac.findMany({ include: { registration } }),
      prisma.recordscan_wm.findMany({ include: { registration } }),
      prisma.component_types.findMany({ select: { id: true, code: true } }),
      prisma.users.findMany({ select: { id: true, username: true } }),
      prisma.production_units.findMany({
        select: { serial_number: true, bomlist_id: true },
      }),
      prisma.production_unit_components.findMany({
        select: {
          serial_number: true,
          component_type_id: true,
          production_unit: { select: { serial_number: true } },
        },
      }),
      prisma.recordscan.findMany({
        select: {
          route_step_id: true,
          legacy_source_table: true,
          legacy_source_id: true,
          production_unit: { select: { serial_number: true } },
        },
      }),
    ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByName = new Map();
  for (const user of users) {
    const key = normalizeText(user.username);
    usersByName.set(key, [...(usersByName.get(key) || []), user]);
  }
  return {
    scans: [
      ...acRows.map((row) =>
        legacyScan(row, "recordscan_ac", "ac", usersById, usersByName),
      ),
      ...wmRows.map((row) =>
        legacyScan(row, "recordscan_wm", "wm", usersById, usersByName),
      ),
    ],
    componentTypeIds: Object.fromEntries(
      componentTypes.map((type) => [type.code, type.id]),
    ),
    currentState: {
      units: units.map((unit) => ({
        serialNumber: unit.serial_number,
        bomlistId: unit.bomlist_id,
      })),
      components: components.map((component) => ({
        ownerSerial: component.production_unit.serial_number,
        componentTypeId: component.component_type_id,
        serialNumber: component.serial_number,
      })),
      events: events.map((event) => ({
        serialNumber: event.production_unit.serial_number,
        routeStepId: event.route_step_id,
        sourceTable: event.legacy_source_table,
        sourceId: event.legacy_source_id,
      })),
    },
  };
}

function quarantineRows(conflicts) {
  return conflicts.map((item) => ({
    source_table: item.sourceTable,
    source_id: String(item.sourceId),
    reason_code: item.reasonCode,
    details: item.details,
  }));
}

async function normalizedCounts(db) {
  const [units, components, events] = await Promise.all([
    db.production_units.count(),
    db.production_unit_components.count(),
    db.recordscan.count(),
  ]);
  return { units, components, events };
}

async function writePlan(prisma, plan) {
  return prisma.$transaction(async (tx) => {
    const before = await normalizedCounts(tx);
    const units = new Map();
    async function unitId(serialNumber) {
      if (units.has(serialNumber)) return units.get(serialNumber);
      const unit = await tx.production_units.findUnique({
        where: { serial_number: serialNumber },
        select: { id: true },
      });
      if (!unit) throw new Error(`Production Unit ${serialNumber} is missing`);
      units.set(serialNumber, unit.id);
      return unit.id;
    }
    for (const item of plan.units) {
      const unit = await tx.production_units.upsert({
        where: { serial_number: item.serialNumber },
        create: {
          serial_number: item.serialNumber,
          bomlist_id: item.bomlistId,
        },
        update: {},
      });
      units.set(item.serialNumber, unit.id);
    }
    for (const item of plan.components) {
      const productionUnitId = await unitId(item.ownerSerial);
      await tx.production_unit_components.upsert({
        where: {
          production_unit_id_component_type_id: {
            production_unit_id: productionUnitId,
            component_type_id: item.componentTypeId,
          },
        },
        create: {
          production_unit_id: productionUnitId,
          component_type_id: item.componentTypeId,
          serial_number: item.serialNumber,
        },
        update: {},
      });
    }
    for (const item of plan.events) {
      const productionUnitId = await unitId(item.serialNumber);
      await tx.recordscan.upsert({
        where: {
          legacy_source_table_legacy_source_id: {
            legacy_source_table: item.sourceTable,
            legacy_source_id: item.sourceId,
          },
        },
        create: {
          id_regist: item.registrationId,
          production_unit_id: productionUnitId,
          route_step_id: item.routeStepId,
          scanned_by: item.scannedBy,
          timestamps: item.timestamp,
          legacy_source_table: item.sourceTable,
          legacy_source_id: item.sourceId,
        },
        update: {},
      });
    }
    return { before, after: await normalizedCounts(tx) };
  }, { timeout: 120_000 });
}

async function backfillScans(prisma) {
  const input = await loadBackfillInput(prisma);
  const plan = buildScanBackfillPlan(
    input.scans,
    input.componentTypeIds,
    input.currentState,
  );
  if (plan.conflicts.length > 0) {
    const quarantine = await persistQuarantineEntries(
      prisma,
      quarantineRows(plan.conflicts),
    );
    return {
      ready: false,
      sourceScans: input.scans.length,
      conflicts: plan.conflicts.length,
      quarantine,
    };
  }
  const reconciliation = await writePlan(prisma, plan);
  return {
    ready: true,
    sourceScans: input.scans.length,
    planned: {
      units: plan.units.length,
      components: plan.components.length,
      events: plan.events.length,
    },
    ...reconciliation,
  };
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
  assertScanBackfillWriteAllowed(
    process.env.DATABASE_URL,
    process.env.ALLOW_TEST_PHASE4_BACKFILL,
  );
  const prisma = require("../lib/prisma");
  try {
    const report = await backfillScans(prisma);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.ready) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Phase 4 scan backfill failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  SCAN_BACKFILL_CONFIRMATION,
  assertScanBackfillWriteAllowed,
  backfillScans,
  buildScanBackfillPlan,
  quarantineRows,
};
