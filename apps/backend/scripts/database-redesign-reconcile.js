#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

function databaseName(databaseUrl) {
  try {
    return new URL(databaseUrl).pathname.split("/").filter(Boolean).at(-1) || "";
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
  }
}

function assertReconciliationDatabase(databaseUrl) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const name = databaseName(databaseUrl);
  if (!/test/i.test(name)) {
    throw new Error(`Reconciliation defaults to a test database; received ${JSON.stringify(name)}`);
  }
}

function countMap(rows = []) {
  return new Map(rows.map((row) => [row.source_table, Number(row.count)]));
}

function buildReconciliationReport(results = {}) {
  const source = countMap(results.sourceCounts);
  const target = countMap(results.targetCounts);
  const scanCountParity = [...new Set([...source.keys(), ...target.keys()])]
    .sort()
    .filter((table) => (source.get(table) || 0) !== (target.get(table) || 0))
    .map((source_table) => ({
      source_table,
      source_count: source.get(source_table) || 0,
      target_count: target.get(source_table) || 0,
    }));
  const checks = {
    scanCountParity,
    legacyWithoutEvent: results.legacyWithoutEvent || [],
    activeEventWithoutLegacy: results.activeEventWithoutLegacy || [],
    incompleteOrders: results.incompleteOrders || [],
    incompleteRegistrations: results.incompleteRegistrations || [],
    unitsAboveOrderQuantity: results.unitsAboveOrderQuantity || [],
    mainSerialMismatches: results.mainSerialMismatches || [],
    componentValueMismatches: results.componentValueMismatches || [],
    unresolvedQuarantine: results.unresolvedQuarantine || [],
  };
  const blocking = Object.values(checks).reduce((sum, rows) => sum + rows.length, 0);
  return {
    generatedAt: new Date().toISOString(),
    ready: blocking === 0,
    summary: { blocking },
    counts: {
      source: Object.fromEntries(source),
      target: Object.fromEntries(target),
    },
    checks,
  };
}

function compactReport(report, sampleSize = 20) {
  return {
    ...report,
    checks: Object.fromEntries(
      Object.entries(report.checks).map(([name, rows]) => [
        name,
        { count: rows.length, sample: rows.slice(0, sampleSize) },
      ]),
    ),
  };
}

async function collectReconciliationData(tx) {
  const queries = {
    sourceCounts: `
      SELECT source_table, count(*)::int AS count FROM (
        SELECT 'recordscan_ac'::text AS source_table FROM recordscan_ac
        UNION ALL SELECT 'recordscan_wm'::text FROM recordscan_wm
      ) source GROUP BY source_table ORDER BY source_table`,
    targetCounts: `
      SELECT legacy_source_table AS source_table, count(*)::int AS count
      FROM recordscan
      WHERE deleted_at IS NULL AND legacy_source_table IS NOT NULL
      GROUP BY legacy_source_table ORDER BY legacy_source_table`,
    legacyWithoutEvent: `
      SELECT source_table, id FROM (
        SELECT 'recordscan_ac'::text AS source_table, a.id FROM recordscan_ac a
        LEFT JOIN recordscan n ON n.legacy_source_table = 'recordscan_ac' AND n.legacy_source_id = a.id
        WHERE n.id IS NULL
        UNION ALL
        SELECT 'recordscan_wm'::text, w.id FROM recordscan_wm w
        LEFT JOIN recordscan n ON n.legacy_source_table = 'recordscan_wm' AND n.legacy_source_id = w.id
        WHERE n.id IS NULL
      ) missing ORDER BY source_table, id`,
    activeEventWithoutLegacy: `
      SELECT n.id, n.legacy_source_table, n.legacy_source_id
      FROM recordscan n
      LEFT JOIN recordscan_ac a ON n.legacy_source_table = 'recordscan_ac' AND a.id = n.legacy_source_id
      LEFT JOIN recordscan_wm w ON n.legacy_source_table = 'recordscan_wm' AND w.id = n.legacy_source_id
      WHERE n.deleted_at IS NULL AND n.legacy_source_table IS NOT NULL
        AND ((n.legacy_source_table = 'recordscan_ac' AND a.id IS NULL)
          OR (n.legacy_source_table = 'recordscan_wm' AND w.id IS NULL))
      ORDER BY n.id`,
    incompleteOrders: `
      SELECT id, order_number, model_id, order_quantity
      FROM bomlist
      WHERE model_id IS NULL OR order_quantity IS NULL OR order_quantity <= 0
      ORDER BY id`,
    incompleteRegistrations: `
      SELECT id, bomlist_id, line_id, route_step_id, production_date
      FROM registscan
      WHERE bomlist_id IS NULL OR line_id IS NULL OR route_step_id IS NULL OR production_date IS NULL
      ORDER BY id`,
    unitsAboveOrderQuantity: `
      SELECT b.id, b.order_number, b.order_quantity, count(u.id)::int AS unit_count
      FROM bomlist b JOIN production_units u ON u.bomlist_id = b.id
      GROUP BY b.id, b.order_number, b.order_quantity
      HAVING b.order_quantity IS NULL OR count(u.id) > b.order_quantity
      ORDER BY b.id`,
    mainSerialMismatches: `
      SELECT n.id AS event_id, n.legacy_source_table,
             source.serial_number AS legacy_value, u.serial_number AS normalized_value
      FROM recordscan n JOIN production_units u ON u.id = n.production_unit_id
      JOIN LATERAL (
        SELECT upper(trim(a.sn)) AS serial_number FROM recordscan_ac a
        WHERE n.legacy_source_table = 'recordscan_ac' AND a.id = n.legacy_source_id
        UNION ALL
        SELECT upper(trim(w.sn)) FROM recordscan_wm w
        WHERE n.legacy_source_table = 'recordscan_wm' AND w.id = n.legacy_source_id
      ) source ON true
      WHERE source.serial_number <> u.serial_number
      ORDER BY n.id`,
    componentValueMismatches: `
      WITH legacy AS (
        SELECT n.id AS event_id, ct.code, upper(trim(v.serial_number)) AS serial_number
        FROM recordscan n JOIN recordscan_ac a ON n.legacy_source_table = 'recordscan_ac' AND n.legacy_source_id = a.id
        CROSS JOIN LATERAL (VALUES ('sn_carton',a.sn_carton),('pcb_idu',a.pcb_idu),('pcb_odu',a.pcb_odu),('sn_motor',a.sn_motor),('sn_accessories',a.sn_accessories)) v(code,serial_number)
        JOIN component_types ct ON ct.code = v.code WHERE v.serial_number IS NOT NULL AND trim(v.serial_number) <> ''
        UNION ALL
        SELECT n.id, ct.code, upper(trim(v.serial_number))
        FROM recordscan n JOIN recordscan_wm w ON n.legacy_source_table = 'recordscan_wm' AND n.legacy_source_id = w.id
        CROSS JOIN LATERAL (VALUES ('sn_drum',w.sn_drum),('sn_pump',w.sn_pump)) v(code,serial_number)
        JOIN component_types ct ON ct.code = v.code WHERE v.serial_number IS NOT NULL AND trim(v.serial_number) <> ''
      ), normalized AS (
        SELECT n.id AS event_id, ct.code, c.serial_number
        FROM recordscan n
        JOIN production_unit_components c ON c.production_unit_id = n.production_unit_id
        JOIN component_types ct ON ct.id = c.component_type_id
      )
      SELECT l.event_id, l.code, l.serial_number AS legacy_value, c.serial_number AS normalized_value
      FROM legacy l LEFT JOIN normalized c ON c.event_id = l.event_id AND c.code = l.code
      WHERE c.event_id IS NULL OR c.serial_number <> l.serial_number
      ORDER BY l.event_id, l.code`,
    unresolvedQuarantine: `
      SELECT id, source_table, source_id, reason_code
      FROM migration_quarantine WHERE resolved_at IS NULL ORDER BY created_at, id`,
  };
  return Object.fromEntries(await Promise.all(
    Object.entries(queries).map(async ([name, sql]) => [name, await tx.$queryRawUnsafe(sql)]),
  ));
}

async function runReconciliation(prisma) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    return buildReconciliationReport(await collectReconciliationData(tx));
  }, { timeout: 120_000 });
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
  assertReconciliationDatabase(process.env.DATABASE_URL);
  const prisma = require("../lib/prisma");
  try {
    const report = await runReconciliation(prisma);
    process.stdout.write(`${JSON.stringify(compactReport(report), null, 2)}\n`);
    if (!report.ready) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`Database reconciliation failed: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = {
  assertReconciliationDatabase,
  buildReconciliationReport,
  compactReport,
  collectReconciliationData,
  runReconciliation,
};
