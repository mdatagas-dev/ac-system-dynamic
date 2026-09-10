const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPlanNotBelowScans,
  structuralChanges,
} = require("../src/services/normalized-registration");

test("Registration plan cannot be reduced below active Unit Scans", () => {
  assert.doesNotThrow(() => assertPlanNotBelowScans(100, 100));
  assert.throws(
    () => assertPlanNotBelowScans(99, 100),
    (error) => error.code === "PLAN_BELOW_ACTUAL",
  );
});

test("only Production Order, line, and route changes are structural", () => {
  const existing = {
    bomlist_id: "order-1",
    line_id: "line-1",
    route_step_id: "route-1",
    shift: "1",
    plan: 100,
  };
  assert.deepEqual(
    structuralChanges(existing, {
      bomlist_id: "order-1",
      line_id: "line-1",
      route_step_id: "route-1",
      shift: "2",
      plan: 80,
    }),
    [],
  );
  assert.deepEqual(
    structuralChanges(existing, {
      bomlist_id: "order-2",
      line_id: "line-2",
      route_step_id: "route-1",
    }),
    ["bomlist_id", "line_id"],
  );
});
