#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

const ROLLBACK_DAYS = 7;
const SKIP_CONFIRMATION = "I_ACCEPT_NO_LEGACY_ROLLBACK_WINDOW";

function assertRollbackWindow(cutoverAt, now = new Date()) {
  const cutover = new Date(cutoverAt);
  if (!cutoverAt || Number.isNaN(cutover.getTime())) {
    throw new Error("CONTRACT_CUTOVER_AT must be a valid deployment timestamp");
  }
  const elapsedDays = (now.getTime() - cutover.getTime()) / 86_400_000;
  if (elapsedDays < ROLLBACK_DAYS) {
    throw new Error(
      `Legacy rollback window is ${ROLLBACK_DAYS} days; only ${Math.max(elapsedDays, 0).toFixed(2)} days elapsed`,
    );
  }
}

function buildContractReport(results = {}) {
  const checks = {
    incompleteOrders: results.incompleteOrders || [],
    incompleteRegistrations: results.incompleteRegistrations || [],
    registrationsWithoutRules: results.registrationsWithoutRules || [],
    legacyScansWithoutEvents: results.legacyScansWithoutEvents || [],
    unresolvedQuarantine: results.unresolvedQuarantine || [],
  };
  const blocking = Object.values(checks).reduce(
    (total, rows) => total + rows.length,
    0,
  );
  return { ready: blocking === 0, blocking, checks };
}

async function collectContractReadiness(db) {
  const queries = {
    incompleteOrders: `
      SELECT b.id, b.order_number
      FROM bomlist b
      WHERE b.model_id IS NULL OR b.order_quantity IS NULL
        OR NOT EXISTS (SELECT 1 FROM bomlist_components c WHERE c.bomlist_id = b.id)
        OR NOT EXISTS (SELECT 1 FROM bomlist_route_steps r WHERE r.bomlist_id = b.id)
      ORDER BY b.id`,
    incompleteRegistrations: `
      SELECT id, order_number FROM registscan
      WHERE bomlist_id IS NULL OR line_id IS NULL OR route_step_id IS NULL
        OR production_date IS NULL
      ORDER BY id`,
    registrationsWithoutRules: `
      SELECT r.id, r.order_number FROM registscan r
      WHERE NOT EXISTS (
        SELECT 1 FROM registscan_components c WHERE c.id_regist = r.id
      )
      ORDER BY r.id`,
    legacyScansWithoutEvents: `
      SELECT source_table, id FROM (
        SELECT 'recordscan_ac'::text AS source_table, a.id
        FROM recordscan_ac a
        WHERE NOT EXISTS (
          SELECT 1 FROM recordscan n
          WHERE n.legacy_source_table = 'recordscan_ac'
            AND n.legacy_source_id = a.id
        )
        UNION ALL
        SELECT 'recordscan_wm'::text, w.id
        FROM recordscan_wm w
        WHERE NOT EXISTS (
          SELECT 1 FROM recordscan n
          WHERE n.legacy_source_table = 'recordscan_wm'
            AND n.legacy_source_id = w.id
        )
      ) missing ORDER BY source_table, id`,
    unresolvedQuarantine: `
      SELECT id, source_table, source_id, reason_code
      FROM migration_quarantine WHERE resolved_at IS NULL
      ORDER BY created_at, id`,
  };
  const results = await Promise.all(
    Object.entries(queries).map(async ([name, sql]) => [
      name,
      await db.$queryRawUnsafe(sql),
    ]),
  );
  return buildContractReport(Object.fromEntries(results));
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  if (process.env.ALLOW_SKIP_ROLLBACK_WINDOW !== SKIP_CONFIRMATION) {
    assertRollbackWindow(process.env.CONTRACT_CUTOVER_AT);
  }
  const prisma = require("../lib/prisma");
  try {
    const report = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return collectContractReadiness(tx);
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ready) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Contract readiness failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  ROLLBACK_DAYS,
  SKIP_CONFIRMATION,
  assertRollbackWindow,
  buildContractReport,
  collectContractReadiness,
};
