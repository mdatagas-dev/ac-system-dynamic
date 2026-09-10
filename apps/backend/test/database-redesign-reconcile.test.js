const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertReconciliationDatabase,
  buildReconciliationReport,
  compactReport,
} = require("../scripts/database-redesign-reconcile");

test("reconciliation is read-only but defaults to a test database", () => {
  assert.throws(
    () => assertReconciliationDatabase("postgresql://user@localhost/ac_production"),
    /test database/i,
  );
  assert.doesNotThrow(() =>
    assertReconciliationDatabase("postgresql://user@localhost/ac_system_test"),
  );
});

test("reconciliation passes only when every database invariant is clean", () => {
  const report = buildReconciliationReport({
    sourceCounts: [{ source_table: "recordscan_ac", count: 4 }],
    targetCounts: [{ source_table: "recordscan_ac", count: 4 }],
  });
  assert.equal(report.ready, true);
  assert.equal(report.summary.blocking, 0);
});

test("reconciliation reports count drift and unresolved rows as blocking", () => {
  const report = buildReconciliationReport({
    sourceCounts: [{ source_table: "recordscan_ac", count: 4 }],
    targetCounts: [{ source_table: "recordscan_ac", count: 3 }],
    unresolvedQuarantine: [{ id: "q-1" }],
    legacyWithoutEvent: [{ source_table: "recordscan_ac", id: "s-1" }],
    scanGroupParity: [{ id_regist: "r-1" }],
  });
  assert.equal(report.ready, false);
  assert.equal(report.checks.scanCountParity.length, 1);
  assert.equal(report.summary.blocking, 4);
  const compact = compactReport(report, 0);
  assert.deepEqual(compact.checks.unresolvedQuarantine, { count: 1, sample: [] });
});
