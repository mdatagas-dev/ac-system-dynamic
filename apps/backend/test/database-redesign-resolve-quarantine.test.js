const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CONFIRMATION,
  assertResolutionWriteAllowed,
  normalizeResolutions,
  resolveQuarantine,
} = require("../scripts/database-redesign-resolve-quarantine");

const id = "00000000-0000-0000-0000-000000000001";

test("quarantine resolution requires a confirmed test database", () => {
  assert.throws(
    () => assertResolutionWriteAllowed("postgresql://user@localhost/ac_production", CONFIRMATION),
    /test database/i,
  );
  assert.throws(
    () => assertResolutionWriteAllowed("postgresql://user@localhost/ac_system_test"),
    /confirmation/i,
  );
});

test("quarantine resolutions require unique IDs and explicit explanations", () => {
  assert.deepEqual(normalizeResolutions([{ id, resolution: "Mapped to approved model" }]), [
    { id, resolution: "Mapped to approved model" },
  ]);
  assert.throws(() => normalizeResolutions([{ id, resolution: " " }]), /blank/i);
  assert.throws(
    () => normalizeResolutions([{ id, resolution: "one" }, { id, resolution: "two" }]),
    /duplicate/i,
  );
});

test("resolution writes once and is idempotent for the same decision", async () => {
  const row = { id, resolved_at: null, resolution: null };
  const prisma = {
    $transaction: (work) => work(prisma),
    migration_quarantine: {
      findMany: async () => [row],
      update: async ({ data }) => Object.assign(row, data),
    },
  };
  assert.deepEqual(
    await resolveQuarantine(prisma, [{ id, resolution: "Approved correction" }]),
    { requested: 1, updated: 1 },
  );
  assert.deepEqual(
    await resolveQuarantine(prisma, [{ id, resolution: "Approved correction" }]),
    { requested: 1, updated: 0 },
  );
  await assert.rejects(
    resolveQuarantine(prisma, [{ id, resolution: "Conflicting correction" }]),
    /different resolution/i,
  );
});
