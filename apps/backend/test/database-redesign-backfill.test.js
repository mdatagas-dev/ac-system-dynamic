const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  BACKFILL_CONFIRMATION,
  assertBackfillWriteAllowed,
  buildQuantityAssignments,
  canonicalRoute,
  componentRows,
  normalizeText,
} = require("../scripts/database-redesign-backfill");

test("backfill writes require a test database and exact confirmation", () => {
  assert.throws(
    () =>
      assertBackfillWriteAllowed(
        "postgresql://user:pass@localhost/ac_system_test",
      ),
    /confirmation/i,
  );
  assert.throws(
    () =>
      assertBackfillWriteAllowed(
        "postgresql://user:pass@localhost/ac_production",
        BACKFILL_CONFIRMATION,
      ),
    /test database/i,
  );
  assert.doesNotThrow(() =>
    assertBackfillWriteAllowed(
      "postgresql://user:pass@localhost/ac_system_test",
      BACKFILL_CONFIRMATION,
    ),
  );
});

test("quantity assignments use existing totals or approved order input", () => {
  const orders = [
    { id: "b-1", order_number: " odf-1 ", order_quantity: null },
    { id: "b-2", order_number: "ODF-2", order_quantity: 250 },
  ];

  assert.deepEqual(buildQuantityAssignments(orders, { "ODF-1": 1000 }), [
    { id: "b-1", order_number: "ODF-1", order_quantity: 1000 },
    { id: "b-2", order_number: "ODF-2", order_quantity: 250 },
  ]);
});

test("quantity assignments reject missing, invalid, and conflicting input", () => {
  const missing = [{ id: "b-1", order_number: "ODF-1", order_quantity: null }];
  assert.throws(() => buildQuantityAssignments(missing, {}), /ODF-1/);
  assert.throws(
    () => buildQuantityAssignments(missing, { "ODF-1": 0 }),
    /positive integer/i,
  );
  assert.throws(
    () =>
      buildQuantityAssignments(
        [{ id: "b-1", order_number: "ODF-1", order_quantity: 100 }],
        { "ODF-1": 101 },
      ),
    /conflicts/i,
  );
  assert.throws(
    () =>
      buildQuantityAssignments(missing, { "odf-1": 100, " ODF-1 ": 100 }),
    /duplicate order/i,
  );
});

test("canonical route recognizes current AC and WM stages", () => {
  assert.deepEqual(canonicalRoute(" line idu assy input "), {
    code: "idu-assembly-input",
    name: "LINE IDU ASSY INPUT",
    processCode: "assembly",
    sequence: 10,
  });
  assert.deepEqual(canonicalRoute("LINE WM PACKING OUTPUT"), {
    code: "wm-packing-output",
    name: "LINE WM PACKING OUTPUT",
    processCode: "packing",
    sequence: 140,
  });
  assert.throws(() => canonicalRoute("LINE UNKNOWN"), /route stage/i);
});

test("component rows preserve required rules and derive reference lengths", () => {
  const bomSpec = {
    sn_prefix: " ac ",
    sn_required: true,
    sn_motor_prefix: "mot",
    sn_motor_required: false,
  };
  const registrationSpec = { sn: " ac-0001 ", sn_motor: null };

  assert.deepEqual(
    componentRows("ac", bomSpec, registrationSpec).filter((row) =>
      ["sn", "sn_motor"].includes(row.code),
    ),
    [
      {
        code: "sn",
        prefix: "AC",
        isRequired: true,
        referenceValue: "AC-0001",
        expectedLength: 7,
      },
      {
        code: "sn_motor",
        prefix: "MOT",
        isRequired: false,
        referenceValue: null,
        expectedLength: null,
      },
    ],
  );
  assert.equal(normalizeText(" abc "), "ABC");
});
