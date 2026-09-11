const { test } = require("node:test");
const assert = require("node:assert/strict");

const { parseOrderQuantity } = require("../src/services/normalized-bom");
const { ensureModelTemplates } = require("../src/services/model-templates");

test("Production Order quantity must be a positive whole number", () => {
  assert.strictEqual(parseOrderQuantity("1000"), 1000);
  for (const value of [undefined, null, 0, -1, 1.5, "many"]) {
    assert.throws(
      () => parseOrderQuantity(value),
      (error) => error.code === "VALIDATION",
    );
  }
});

test("empty model templates are provisioned from the AC catalog", async () => {
  const created = { components: [], routes: [] };
  const db = {
    model_bom_templates: {
      count: async () => 0,
      createMany: async ({ data }) => {
        created.components.push(...data);
      },
    },
    model_route_steps: {
      count: async () => 0,
      createMany: async ({ data }) => {
        created.routes.push(...data);
      },
    },
    component_types: {
      findMany: async () => [
        "sn",
        "sn_odu",
        "sn_carton",
        "pcb_idu",
        "pcb_odu",
        "sn_box",
        "sn_motor",
        "sn_accessories",
      ].map((code) => ({ id: `component-${code}`, code })),
    },
    processes: {
      findMany: async () => [
        { id: "process-assembly", code: "assembly" },
        { id: "process-testing", code: "testing" },
        { id: "process-packing", code: "packing" },
      ],
    },
  };

  await ensureModelTemplates(db, "model-1", "ac");

  assert.strictEqual(created.components.length, 8);
  assert.strictEqual(created.routes.length, 12);
  assert.strictEqual(created.components.find((row) => row.component_type_id === "component-sn").is_required, true);
  assert.strictEqual(created.routes[0].code, "idu-assembly-input");
});
