const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CONFIRMATION,
  assertSafeTarget,
  temporaryDatabaseName,
} = require("../scripts/database-redesign-verify-migrations");

test("clean migration verification requires a test DB and exact confirmation", () => {
  assert.throws(
    () => assertSafeTarget("postgresql://user@localhost/ac_production", CONFIRMATION),
    /test database/i,
  );
  assert.throws(
    () => assertSafeTarget("postgresql://user@localhost/ac_system_test"),
    /confirmation/i,
  );
  assert.equal(
    assertSafeTarget("postgresql://user@localhost/ac_system_test", CONFIRMATION).pathname,
    "/ac_system_test",
  );
});

test("temporary migration database names are always test-scoped", () => {
  assert.match(temporaryDatabaseName(), /^ac_system_test_clean_\d+_\d+$/);
});
