const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertSafeDatabaseUrl,
  buildPreflightReport,
  hasBlockingIssues,
} = require("../scripts/database-redesign-preflight");

test("preflight rejects missing and non-test database URLs by default", () => {
  assert.throws(() => assertSafeDatabaseUrl(), /DATABASE_URL/);
  assert.throws(
    () => assertSafeDatabaseUrl("postgresql://user:pass@localhost/ac_production"),
    /test database/i,
  );
});

test("preflight accepts an explicitly named test database", () => {
  assert.doesNotThrow(() =>
    assertSafeDatabaseUrl("postgresql://user:pass@localhost/ac_system_test"),
  );
});

test("production inspection requires a separate explicit opt-in", () => {
  assert.throws(
    () =>
      assertSafeDatabaseUrl(
        "postgresql://user:pass@localhost/ac_production",
        { allowReadOnlyProduction: true, confirmation: "wrong" },
      ),
    /confirmation/i,
  );
  assert.doesNotThrow(() =>
    assertSafeDatabaseUrl(
      "postgresql://user:pass@localhost/ac_production",
      {
        allowReadOnlyProduction: true,
        confirmation: "READ_ONLY_PRODUCTION_PREFLIGHT",
      },
    ),
  );
});

test("report groups blocking conflicts and informational over-plan rows", () => {
  const report = buildPreflightReport({
    duplicateOrderNumbers: [{ order_number: "ORD-1", count: 2 }],
    blankOrderNumbers: [],
    missingModels: [],
    ambiguousRegistrations: [],
    unsupportedCategories: [],
    blankMainSerials: [],
    duplicateStageScans: [],
    componentOwnershipConflicts: [],
    registrationsOverPlan: [{ id: "reg-1", plan: 10, scan_count: 12 }],
    serialsAcrossOrders: [],
    unmappedSublines: [],
  });

  assert.equal(report.summary.blocking, 1);
  assert.equal(report.summary.warnings, 1);
  assert.equal(report.readyForBackfill, false);
  assert.equal(hasBlockingIssues(report), true);
  assert.equal(report.checks.duplicateOrderNumbers.severity, "blocking");
  assert.equal(report.checks.registrationsOverPlan.severity, "warning");
});

test("empty report is ready for backfill", () => {
  const report = buildPreflightReport({});
  assert.equal(report.summary.blocking, 0);
  assert.equal(report.summary.warnings, 0);
  assert.equal(report.readyForBackfill, true);
  assert.equal(hasBlockingIssues(report), false);
});
