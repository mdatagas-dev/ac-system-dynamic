const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PRODUCTION_BACKFILL_CONFIRMATION, assertProductionBackfillAllowed } = require("../scripts/database-redesign-production-backfill");

test("production backfill requires exact database identity and confirmation", () => {
  const base = {
    databaseUrl: "postgresql://user:pass@localhost/gas4_production",
    expectedDatabaseName: "gas4_production",
    confirmation: PRODUCTION_BACKFILL_CONFIRMATION,
    backupFile: __filename,
    verifyBackup() {},
  };
  assert.doesNotThrow(() => assertProductionBackfillAllowed(base));
  assert.throws(() => assertProductionBackfillAllowed({ ...base, expectedDatabaseName: "other" }), /expected/);
  assert.throws(() => assertProductionBackfillAllowed({ ...base, confirmation: "wrong" }), /confirmation/);
  assert.throws(() => assertProductionBackfillAllowed({ ...base, databaseUrl: "postgresql://user:pass@localhost/gas4_test" }), /non-test/);
});
