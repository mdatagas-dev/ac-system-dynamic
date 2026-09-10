#!/usr/bin/env node

const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

const PRODUCTION_CONFIRMATION = "READ_ONLY_PRODUCTION_PREFLIGHT";
const TEST_QUARANTINE_CONFIRMATION = "WRITE_TEST_QUARANTINE";

const CHECKS = {
  duplicateOrderNumbers: "blocking",
  blankOrderNumbers: "blocking",
  missingModels: "blocking",
  ambiguousRegistrations: "blocking",
  unsupportedCategories: "blocking",
  blankMainSerials: "blocking",
  duplicateStageScans: "blocking",
  componentOwnershipConflicts: "blocking",
  registrationsOverPlan: "warning",
  serialsAcrossOrders: "blocking",
  unmappedSublines: "blocking",
};

function databaseName(databaseUrl) {
  try {
    return new URL(databaseUrl).pathname.split("/").filter(Boolean).at(-1) || "";
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
  }
}

function assertSafeDatabaseUrl(
  databaseUrl,
  { allowReadOnlyProduction = false, confirmation } = {},
) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const name = databaseName(databaseUrl);
  if (/test/i.test(name)) return;
  if (!allowReadOnlyProduction) {
    throw new Error(
      `Preflight defaults to a test database; received database ${JSON.stringify(name)}`,
    );
  }
  if (confirmation !== PRODUCTION_CONFIRMATION) {
    throw new Error(
      `Production read-only inspection requires confirmation ${PRODUCTION_CONFIRMATION}`,
    );
  }
}

function assertTestQuarantineWriteAllowed(databaseUrl, confirmation) {
  assertSafeDatabaseUrl(databaseUrl);
  if (confirmation !== TEST_QUARANTINE_CONFIRMATION) {
    throw new Error(
      `Quarantine write confirmation must be ${TEST_QUARANTINE_CONFIRMATION}`,
    );
  }
}

function buildPreflightReport(results = {}) {
  const checks = {};
  let blocking = 0;
  let warnings = 0;

  for (const [name, severity] of Object.entries(CHECKS)) {
    const rows = Array.isArray(results[name]) ? results[name] : [];
    checks[name] = { severity, count: rows.length, rows };
    if (severity === "blocking") blocking += rows.length;
    else warnings += rows.length;
  }

  return {
    generatedAt: new Date().toISOString(),
    readyForBackfill: blocking === 0,
    summary: { blocking, warnings },
    checks,
  };
}

function hasBlockingIssues(report) {
  return report.summary.blocking > 0;
}

function reasonCode(checkName) {
  return checkName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

function fallbackSourceId(checkName, row) {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(row))
    .digest("hex")
    .slice(0, 32);
  return `${checkName}:${digest}`;
}

function quarantineSource(checkName, row) {
  if (checkName === "duplicateOrderNumbers") {
    return {
      source_table: "preflight_duplicate_order_numbers",
      source_id: `order:${row.order_number}`,
    };
  }
  if (checkName === "missingModels") {
    return { source_table: "bomlist", source_id: String(row.id) };
  }
  if (checkName === "ambiguousRegistrations") {
    return { source_table: "registscan", source_id: String(row.id) };
  }
  if (row.source_table && row.id) {
    return { source_table: row.source_table, source_id: String(row.id) };
  }
  return {
    source_table: `preflight_${reasonCode(checkName).toLowerCase()}`,
    source_id: fallbackSourceId(checkName, row),
  };
}

function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
}

function quarantineEntries(report) {
  const entries = [];
  for (const [checkName, check] of Object.entries(report.checks)) {
    if (check.severity !== "blocking") continue;
    for (const row of check.rows) {
      entries.push({
        ...quarantineSource(checkName, row),
        reason_code: reasonCode(checkName),
        details: jsonSafe(row),
      });
    }
  }
  return entries;
}

async function persistQuarantineEntries(prisma, entries) {
  if (entries.length === 0) return { attempted: 0, inserted: 0 };
  const result = await prisma.migration_quarantine.createMany({
    data: entries,
    skipDuplicates: true,
  });
  return { attempted: entries.length, inserted: result.count };
}

async function collectPreflightData(tx) {
  const queries = {
    duplicateOrderNumbers: `
      SELECT upper(trim(order_number)) AS order_number, count(*)::int AS count,
             array_agg(id ORDER BY id) AS ids
      FROM bomlist
      WHERE order_number IS NOT NULL AND trim(order_number) <> ''
      GROUP BY upper(trim(order_number))
      HAVING count(*) > 1
      ORDER BY count(*) DESC, order_number`,
    blankOrderNumbers: `
      SELECT id, order_number, model
      FROM bomlist
      WHERE order_number IS NULL OR trim(order_number) = ''
      ORDER BY id`,
    missingModels: `
      SELECT b.id, b.order_number, b.model
      FROM bomlist b
      LEFT JOIN model m ON upper(trim(m.model)) = upper(trim(b.model))
      WHERE m.id IS NULL
      ORDER BY b.order_number`,
    ambiguousRegistrations: `
      SELECT r.id, r.order_number, r.model, count(b.id)::int AS bom_matches
      FROM registscan r
      LEFT JOIN bomlist b
        ON upper(trim(b.order_number)) = upper(trim(r.order_number))
       AND upper(trim(b.model)) = upper(trim(r.model))
      GROUP BY r.id, r.order_number, r.model
      HAVING count(b.id) <> 1
      ORDER BY r.order_number, r.id`,
    unsupportedCategories: `
      SELECT 'bomlist' AS source_table, id, product_category
      FROM bomlist
      WHERE product_category IS NULL OR lower(trim(product_category)) NOT IN ('ac', 'wm')
      UNION ALL
      SELECT 'registscan' AS source_table, id, product_category
      FROM registscan
      WHERE product_category IS NULL OR lower(trim(product_category)) NOT IN ('ac', 'wm')
      ORDER BY source_table, id`,
    blankMainSerials: `
      SELECT 'recordscan_ac' AS source_table, id, id_regist
      FROM recordscan_ac
      WHERE sn IS NULL OR trim(sn) = ''
      UNION ALL
      SELECT 'recordscan_wm' AS source_table, id, id_regist
      FROM recordscan_wm
      WHERE sn IS NULL OR trim(sn) = ''
      ORDER BY source_table, id`,
    duplicateStageScans: `
      SELECT product_category, id_regist, serial_number, count(*)::int AS count
      FROM (
        SELECT 'ac'::text AS product_category, id_regist, upper(trim(sn)) AS serial_number
        FROM recordscan_ac WHERE sn IS NOT NULL AND trim(sn) <> ''
        UNION ALL
        SELECT 'wm'::text, id_regist, upper(trim(sn))
        FROM recordscan_wm WHERE sn IS NOT NULL AND trim(sn) <> ''
      ) scans
      GROUP BY product_category, id_regist, serial_number
      HAVING count(*) > 1
      ORDER BY count(*) DESC, product_category, id_regist`,
    componentOwnershipConflicts: `
      WITH component_values AS (
        SELECT upper(trim(sn)) AS main_serial, component_type, upper(trim(component_serial)) AS component_serial
        FROM recordscan_ac
        CROSS JOIN LATERAL (VALUES
          ('SN_ODU', sn_odu), ('SN_CARTON', sn_carton), ('PCB_IDU', pcb_idu),
          ('PCB_ODU', pcb_odu), ('SN_BOX', sn_box), ('SN_MOTOR', sn_motor),
          ('SN_ACCESSORIES', sn_accessories)
        ) AS component(component_type, component_serial)
        WHERE sn IS NOT NULL AND trim(sn) <> ''
          AND component_serial IS NOT NULL AND trim(component_serial) <> ''
        UNION ALL
        SELECT upper(trim(sn)), component_type, upper(trim(component_serial))
        FROM recordscan_wm
        CROSS JOIN LATERAL (VALUES
          ('SN_DRUM', sn_drum), ('SN_PUMP', sn_pump)
        ) AS component(component_type, component_serial)
        WHERE sn IS NOT NULL AND trim(sn) <> ''
          AND component_serial IS NOT NULL AND trim(component_serial) <> ''
      )
      SELECT component_type, component_serial,
             count(DISTINCT main_serial)::int AS owner_count,
             array_agg(DISTINCT main_serial ORDER BY main_serial) AS main_serials
      FROM component_values
      GROUP BY component_type, component_serial
      HAVING count(DISTINCT main_serial) > 1
      ORDER BY owner_count DESC, component_type, component_serial`,
    registrationsOverPlan: `
      SELECT r.id, r.order_number, r.model, r.subline, r.plan,
             (COALESCE(a.scan_count, 0) + COALESCE(w.scan_count, 0))::int AS scan_count
      FROM registscan r
      LEFT JOIN (
        SELECT id_regist, count(*)::int AS scan_count
        FROM recordscan_ac GROUP BY id_regist
      ) a ON a.id_regist = r.id
      LEFT JOIN (
        SELECT id_regist, count(*)::int AS scan_count
        FROM recordscan_wm GROUP BY id_regist
      ) w ON w.id_regist = r.id
      WHERE r.plan IS NOT NULL
        AND COALESCE(a.scan_count, 0) + COALESCE(w.scan_count, 0) > r.plan
      ORDER BY scan_count DESC, r.id`,
    serialsAcrossOrders: `
      SELECT serial_number, count(DISTINCT order_number)::int AS order_count,
             array_agg(DISTINCT order_number ORDER BY order_number) AS order_numbers
      FROM (
        SELECT upper(trim(s.sn)) AS serial_number, upper(trim(r.order_number)) AS order_number
        FROM recordscan_ac s JOIN registscan r ON r.id = s.id_regist
        WHERE s.sn IS NOT NULL AND trim(s.sn) <> ''
        UNION ALL
        SELECT upper(trim(s.sn)), upper(trim(r.order_number))
        FROM recordscan_wm s JOIN registscan r ON r.id = s.id_regist
        WHERE s.sn IS NOT NULL AND trim(s.sn) <> ''
      ) scans
      GROUP BY serial_number
      HAVING count(DISTINCT order_number) > 1
      ORDER BY order_count DESC, serial_number`,
    unmappedSublines: `
      SELECT DISTINCT r.subline
      FROM registscan r
      LEFT JOIN line l ON upper(trim(l.line)) = upper(trim(r.subline))
      WHERE l.id IS NULL
      ORDER BY r.subline`,
  };

  const entries = await Promise.all(
    Object.entries(queries).map(async ([name, sql]) => [
      name,
      await tx.$queryRawUnsafe(sql),
    ]),
  );
  return Object.fromEntries(entries);
}

async function runPreflight(prisma) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return buildPreflightReport(await collectPreflightData(tx));
    },
    { timeout: 120_000 },
  );
}

function json(value) {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? Number(item) : item),
    2,
  );
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  const allowReadOnlyProduction =
    process.env.ALLOW_READ_ONLY_PRODUCTION_PREFLIGHT === PRODUCTION_CONFIRMATION;
  assertSafeDatabaseUrl(process.env.DATABASE_URL, {
    allowReadOnlyProduction,
    confirmation: process.env.ALLOW_READ_ONLY_PRODUCTION_PREFLIGHT,
  });

  const prisma = require("../lib/prisma");
  try {
    const report = await runPreflight(prisma);
    process.stdout.write(`${json(report)}\n`);
    if (hasBlockingIssues(report)) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Database redesign preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  PRODUCTION_CONFIRMATION,
  TEST_QUARANTINE_CONFIRMATION,
  assertSafeDatabaseUrl,
  assertTestQuarantineWriteAllowed,
  buildPreflightReport,
  collectPreflightData,
  hasBlockingIssues,
  persistQuarantineEntries,
  quarantineEntries,
  runPreflight,
};
