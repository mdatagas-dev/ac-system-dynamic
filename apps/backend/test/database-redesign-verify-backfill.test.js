const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CONFIRMATION,
  assertBackfillFixtureAllowed,
} = require("../scripts/database-redesign-verify-backfill");

test("end-to-end backfill fixture is restricted to a confirmed test database", () => {
  assert.throws(
    () => assertBackfillFixtureAllowed("postgresql://user@localhost/ac_production", CONFIRMATION),
    /test database/i,
  );
  assert.throws(
    () => assertBackfillFixtureAllowed("postgresql://user@localhost/ac_system_test"),
    /confirmation/i,
  );
  assert.doesNotThrow(() =>
    assertBackfillFixtureAllowed("postgresql://user@localhost/ac_system_test", CONFIRMATION),
  );
});
