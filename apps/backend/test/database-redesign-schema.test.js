const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("../src/generated/prisma");

const expectedModels = [
  "component_types",
  "model_bom_templates",
  "processes",
  "model_route_steps",
  "bomlist_components",
  "bomlist_route_steps",
  "registscan_components",
  "production_units",
  "production_unit_components",
  "recordscan",
  "audit_events",
  "migration_quarantine",
];

test("redesign models are exposed by the generated Prisma client", () => {
  const names = new Set(Prisma.dmmf.datamodel.models.map((model) => model.name));
  for (const name of expectedModels) {
    assert.equal(names.has(name), true, `missing Prisma model ${name}`);
  }
});

test("legacy AC and WM tables remain during the additive phase", () => {
  const names = new Set(Prisma.dmmf.datamodel.models.map((model) => model.name));
  for (const name of [
    "ac_bom_spec",
    "wm_bom_spec",
    "ac_registration_spec",
    "wm_registration_spec",
    "recordscan_ac",
    "recordscan_wm",
  ]) {
    assert.equal(names.has(name), true, `legacy model ${name} must remain`);
  }
});
