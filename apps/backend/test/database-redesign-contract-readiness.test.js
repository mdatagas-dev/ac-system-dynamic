const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertRollbackWindow,
  buildContractReport,
} = require("../scripts/database-redesign-contract-readiness");

test("contract cleanup requires the full seven-day rollback window", () => {
  const now = new Date("2026-09-11T00:00:00.000Z");
  assert.throws(
    () => assertRollbackWindow("2026-09-05T00:00:00.000Z", now),
    /7 days/,
  );
  assert.doesNotThrow(() =>
    assertRollbackWindow("2026-09-04T00:00:00.000Z", now),
  );
});

test("contract cleanup blocks on any remaining legacy-only data", () => {
  assert.equal(buildContractReport({}).ready, true);
  const report = buildContractReport({
    incompleteOrders: [{ id: "order-1" }],
    legacyScansWithoutEvents: [{ id: "scan-1" }],
  });
  assert.equal(report.ready, false);
  assert.equal(report.blocking, 2);
});
