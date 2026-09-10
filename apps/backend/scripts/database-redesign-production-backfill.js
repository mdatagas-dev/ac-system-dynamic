#!/usr/bin/env node

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const dotenv = require("dotenv");
const { backfillPhase3 } = require("./database-redesign-backfill");
const { backfillScans } = require("./database-redesign-scan-backfill");
const { runPreflight, hasBlockingIssues } = require("./database-redesign-preflight");
const { runReconciliation } = require("./database-redesign-reconcile");

const PRODUCTION_BACKFILL_CONFIRMATION = "BACKFILL_VERIFIED_PRODUCTION_COPY";

function databaseName(databaseUrl) {
  return new URL(databaseUrl).pathname.split("/").filter(Boolean).at(-1) || "";
}

function assertProductionBackfillAllowed({ databaseUrl, expectedDatabaseName, confirmation, backupFile, verifyBackup }) {
  const actualName = databaseName(databaseUrl);
  if (!actualName || /test/i.test(actualName)) throw new Error("Production backfill requires a non-test database");
  if (!expectedDatabaseName || actualName !== expectedDatabaseName) {
    throw new Error(`Connected to ${actualName}; expected ${expectedDatabaseName || "(missing)"}`);
  }
  if (confirmation !== PRODUCTION_BACKFILL_CONFIRMATION) {
    throw new Error(`Production confirmation must be ${PRODUCTION_BACKFILL_CONFIRMATION}`);
  }
  if (!backupFile || !path.isAbsolute(backupFile) || !fs.statSync(backupFile).isFile()) {
    throw new Error("A verified absolute production backup file is required");
  }
  (verifyBackup || ((file) => execFileSync("pg_restore", ["--list", file], { stdio: "ignore" })))(backupFile);
}

async function runProductionBackfill(prisma, quantities) {
  const preflight = await runPreflight(prisma);
  if (hasBlockingIssues(preflight) || preflight.summary.warnings > 0) {
    throw new Error(`Production preflight is not clean: ${JSON.stringify(preflight.summary)}`);
  }
  const phase3 = await backfillPhase3(prisma, quantities);
  const phase4 = await backfillScans(prisma);
  if (!phase4.ready) throw new Error("Phase 4 produced quarantine blockers");
  const reconciliation = await runReconciliation(prisma);
  if (!reconciliation.ready) throw new Error("Production reconciliation failed");
  return { preflight: preflight.summary, phase3, phase4, reconciliation };
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  assertProductionBackfillAllowed({
    databaseUrl: process.env.DATABASE_URL,
    expectedDatabaseName: process.env.EXPECTED_PRODUCTION_DATABASE_NAME,
    confirmation: process.env.ALLOW_PRODUCTION_BACKFILL,
    backupFile: process.env.PRODUCTION_BACKUP_FILE,
  });
  const quantities = JSON.parse(fs.readFileSync(path.resolve(process.env.BACKFILL_ORDER_QUANTITIES_FILE), "utf8"));
  const prisma = require("../lib/prisma");
  try {
    process.stdout.write(`${JSON.stringify(await runProductionBackfill(prisma, quantities))}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`Production backfill failed: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { PRODUCTION_BACKFILL_CONFIRMATION, assertProductionBackfillAllowed, runProductionBackfill };
