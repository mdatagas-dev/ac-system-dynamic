const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertSafeDatabaseUrl,
  assertTestQuarantineWriteAllowed,
  buildPreflightReport,
  hasBlockingIssues,
  persistQuarantineEntries,
  quarantineEntries,
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

test("quarantine writes require a test database and exact confirmation", () => {
  assert.throws(
    () =>
      assertTestQuarantineWriteAllowed(
        "postgresql://user:pass@localhost/ac_system_test",
      ),
    /confirmation/i,
  );
  assert.throws(
    () =>
      assertTestQuarantineWriteAllowed(
        "postgresql://user:pass@localhost/ac_production",
        "WRITE_TEST_QUARANTINE",
      ),
    /test database/i,
  );
  assert.doesNotThrow(() =>
    assertTestQuarantineWriteAllowed(
      "postgresql://user:pass@localhost/ac_system_test",
      "WRITE_TEST_QUARANTINE",
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

test("blocking findings become deterministic quarantine entries", () => {
  const report = buildPreflightReport({
    duplicateOrderNumbers: [
      { order_number: "ORD-1", count: 2, ids: ["b-1", "b-2"] },
    ],
    missingModels: [{ id: "b-3", order_number: "ORD-2", model: "MISSING" }],
    registrationsOverPlan: [{ id: "r-1", plan: 10, scan_count: 12 }],
  });

  const entries = quarantineEntries(report);
  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map(({ source_table, source_id, reason_code }) => ({
      source_table,
      source_id,
      reason_code,
    })),
    [
      {
        source_table: "preflight_duplicate_order_numbers",
        source_id: "order:ORD-1",
        reason_code: "DUPLICATE_ORDER_NUMBERS",
      },
      {
        source_table: "bomlist",
        source_id: "b-3",
        reason_code: "MISSING_MODELS",
      },
    ],
  );
});

test("quarantine persistence uses an idempotent bulk insert", async () => {
  const calls = [];
  const prisma = {
    migration_quarantine: {
      createMany: async (args) => {
        calls.push(args);
        return { count: args.data.length };
      },
    },
  };
  const entries = [
    {
      source_table: "bomlist",
      source_id: "b-1",
      reason_code: "MISSING_MODELS",
      details: { id: "b-1" },
    },
  ];

  const result = await persistQuarantineEntries(prisma, entries);
  assert.deepEqual(result, { attempted: 1, inserted: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].skipDuplicates, true);
});
