const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertComponentRules,
  assertRouteProgression,
  legacyScanShape,
} = require("../src/services/normalized-scan");

const rules = [
  {
    component_type: { code: "sn", label: "Serial Number" },
    is_required: true,
    expected_length: 7,
    prefix_snapshot: "AC-",
  },
  {
    component_type: { code: "sn_motor", label: "SN Motor" },
    is_required: true,
    expected_length: 7,
    prefix_snapshot: "MTR-",
  },
];

test("normalized Unit Scan validates required, length, and prefix snapshots", () => {
  assert.doesNotThrow(() =>
    assertComponentRules(rules, { sn: "ac-0001", sn_motor: "mtr-001" }),
  );
  assert.throws(
    () => assertComponentRules(rules, { sn: "AC-0001" }),
    (error) => error.code === "MISSING_REQUIRED",
  );
  assert.throws(
    () =>
      assertComponentRules(rules, { sn: "AC-01", sn_motor: "MTR-001" }),
    (error) => error.code === "LENGTH_MISMATCH",
  );
  assert.throws(
    () =>
      assertComponentRules(rules, { sn: "XX-0001", sn_motor: "MTR-001" }),
    (error) => error.code === "BOM_MISMATCH",
  );
});

test("route progression requires every earlier configured route step", () => {
  const configured = [
    { id: "route-1", name: "Assembly Input", sequence: 10, is_required: true },
    { id: "route-2", name: "Assembly Output", sequence: 20, is_required: true },
    { id: "route-3", name: "Packing", sequence: 30, is_required: true },
  ];
  assert.doesNotThrow(() =>
    assertRouteProgression(configured[0], configured, []),
  );
  assert.doesNotThrow(() =>
    assertRouteProgression(configured[2], configured, ["route-1", "route-2"]),
  );
  assert.throws(
    () => assertRouteProgression(configured[2], configured, ["route-1"]),
    (error) => error.code === "ORDER_VIOLATION" && /Assembly Output/.test(error.message),
  );
  assert.throws(
    () => assertRouteProgression(configured[1], configured, ["route-2"]),
    (error) => error.code === "DOUBLE_SCAN",
  );
});

test("normalized Unit Scan preserves the existing AC response fields with normalized IDs", () => {
  assert.deepEqual(
    legacyScanShape(
      {
        id_regist: "reg-1",
        timestamps: new Date("2026-09-10T01:00:00.000Z"),
        id: "event-1",
        production_unit: {
          serial_number: "AC-0001",
          components: [
            {
              serial_number: "MTR-001",
              component_type: { code: "sn_motor" },
            },
          ],
        },
      },
      "ac",
    ),
    {
      id: "event-1",
      id_regist: "reg-1",
      sn: "AC-0001",
      sn_carton: null,
      pcb_idu: null,
      pcb_odu: null,
      sn_motor: "MTR-001",
      sn_accessories: null,
      timestamps: new Date("2026-09-10T01:00:00.000Z"),
    },
  );
});
