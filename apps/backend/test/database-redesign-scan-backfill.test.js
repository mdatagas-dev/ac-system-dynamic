const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  SCAN_BACKFILL_CONFIRMATION,
  assertScanBackfillWriteAllowed,
  buildScanBackfillPlan,
} = require("../scripts/database-redesign-scan-backfill");

const componentTypeIds = {
  sn_carton: "ct-carton",
  sn_motor: "ct-motor",
  sn_drum: "ct-drum",
  sn_pump: "ct-pump",
};

function scan(overrides = {}) {
  return {
    sourceTable: "recordscan_ac",
    sourceId: "00000000-0000-0000-0000-000000000001",
    registrationId: "reg-1",
    bomlistId: "bom-1",
    orderQuantity: 1000,
    routeStepId: "route-1",
    scannedBy: "user-1",
    timestamp: new Date("2026-09-10T01:00:00.000Z"),
    serialNumber: " ac-0001 ",
    category: "ac",
    values: { sn_carton: " box-1 ", sn_motor: " motor-1 " },
    ...overrides,
  };
}

test("scan backfill writes require a test database and exact confirmation", () => {
  assert.throws(
    () =>
      assertScanBackfillWriteAllowed(
        "postgresql://user:pass@localhost/ac_system_test",
      ),
    /confirmation/i,
  );
  assert.throws(
    () =>
      assertScanBackfillWriteAllowed(
        "postgresql://user:pass@localhost/ac_production",
        SCAN_BACKFILL_CONFIRMATION,
      ),
    /test database/i,
  );
  assert.doesNotThrow(() =>
    assertScanBackfillWriteAllowed(
      "postgresql://user:pass@localhost/ac_system_test",
      SCAN_BACKFILL_CONFIRMATION,
    ),
  );
});

test("one Production Unit can produce Unit Scans at successive route steps", () => {
  const plan = buildScanBackfillPlan(
    [
      scan(),
      scan({
        sourceId: "00000000-0000-0000-0000-000000000002",
        registrationId: "reg-2",
        routeStepId: "route-2",
        timestamp: new Date("2026-09-10T02:00:00.000Z"),
      }),
    ],
    componentTypeIds,
  );

  assert.equal(plan.conflicts.length, 0);
  assert.deepEqual(plan.units, [
    { serialNumber: "AC-0001", bomlistId: "bom-1" },
  ]);
  assert.equal(plan.components.length, 2);
  assert.deepEqual(
    plan.events.map(({ sourceId, routeStepId }) => ({ sourceId, routeStepId })),
    [
      {
        sourceId: "00000000-0000-0000-0000-000000000001",
        routeStepId: "route-1",
      },
      {
        sourceId: "00000000-0000-0000-0000-000000000002",
        routeStepId: "route-2",
      },
    ],
  );
});

test("planner rejects the same main serial across Production Orders", () => {
  const plan = buildScanBackfillPlan(
    [scan(), scan({ sourceId: "scan-2", bomlistId: "bom-2" })],
    componentTypeIds,
  );
  assert.deepEqual(
    plan.conflicts.map(({ reasonCode }) => reasonCode),
    ["SERIAL_ACROSS_ORDERS"],
  );
});

test("planner rejects Production Units above the Production Order quantity", () => {
  const plan = buildScanBackfillPlan(
    [
      scan({ orderQuantity: 1 }),
      scan({
        sourceId: "scan-2",
        serialNumber: "AC-0002",
        routeStepId: "route-2",
        orderQuantity: 1,
        values: {},
      }),
    ],
    componentTypeIds,
  );
  assert.deepEqual(
    plan.conflicts.map(({ reasonCode }) => reasonCode),
    ["ORDER_QUANTITY_EXCEEDED"],
  );
});

test("planner rejects component ownership conflicts", () => {
  const plan = buildScanBackfillPlan(
    [
      scan(),
      scan({
        sourceId: "scan-2",
        serialNumber: "AC-0002",
        values: { sn_carton: "BOX-1" },
      }),
    ],
    componentTypeIds,
  );
  assert.deepEqual(
    plan.conflicts.map(({ reasonCode }) => reasonCode),
    ["COMPONENT_OWNERSHIP_CONFLICT"],
  );
});

test("planner rejects a changed component on the same Production Unit", () => {
  const plan = buildScanBackfillPlan(
    [
      scan(),
      scan({
        sourceId: "scan-2",
        routeStepId: "route-2",
        values: { sn_carton: "BOX-2" },
      }),
    ],
    componentTypeIds,
  );
  assert.deepEqual(
    plan.conflicts.map(({ reasonCode }) => reasonCode),
    ["UNIT_COMPONENT_CONFLICT"],
  );
});

test("planner rejects duplicate Unit Scans at one route step", () => {
  const plan = buildScanBackfillPlan(
    [scan(), scan({ sourceId: "scan-2", registrationId: "reg-2" })],
    componentTypeIds,
  );
  assert.deepEqual(
    plan.conflicts.map(({ reasonCode }) => reasonCode),
    ["DUPLICATE_UNIT_ROUTE_STEP"],
  );
});

test("planner quarantines blank main serials and missing normalized links", () => {
  const plan = buildScanBackfillPlan(
    [
      scan({ sourceId: "scan-blank", serialNumber: " " }),
      scan({ sourceId: "scan-link", routeStepId: null }),
    ],
    componentTypeIds,
  );
  assert.deepEqual(
    plan.conflicts.map(({ reasonCode }) => reasonCode),
    ["BLANK_MAIN_SERIAL", "MISSING_NORMALIZED_LINK"],
  );
});

test("planner repairs a missing event for an existing Production Unit", () => {
  const plan = buildScanBackfillPlan([scan()], componentTypeIds, {
    units: [{ serialNumber: "AC-0001", bomlistId: "bom-1" }],
  });

  assert.equal(plan.conflicts.length, 0);
  assert.equal(plan.units.length, 0);
  assert.equal(plan.events.length, 1);
});
