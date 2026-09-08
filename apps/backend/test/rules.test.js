// Pure unit tests untuk rules (tanpa DB/Redis). Bisa jalan sendiri: node --test test/rules.test.js
const { test } = require("node:test");
const assert = require("node:assert");

// ---------- accuracy ----------
test("accuracyPercent: identical string -> 100", async () => {
  const { accuracyPercent } = require("../src/rules/accuracy");
  assert.strictEqual(accuracyPercent("ABC123", "ABC123"), 100);
});
test("accuracyPercent: 3/6 match -> 50", async () => {
  const { accuracyPercent } = require("../src/rules/accuracy");
  assert.strictEqual(accuracyPercent("ABCDEF", "ABCXYZ"), 50);
});
test("accuracyPercent: 0 match -> 0", async () => {
  const { accuracyPercent } = require("../src/rules/accuracy");
  assert.strictEqual(accuracyPercent("ABCDEF", "GHIJKL"), 0);
});
test("accuracyPercent: empty registered -> 0", async () => {
  const { accuracyPercent } = require("../src/rules/accuracy");
  assert.strictEqual(accuracyPercent("", "ABC"), 0);
});
test("isAccuracyTooLow: 50% match -> false", () => {
  const { isAccuracyTooLow } = require("../src/rules/accuracy");
  assert.strictEqual(isAccuracyTooLow("ABCDEF", "ABC"), false);
});
test("isAccuracyTooLow: 0% match -> true", () => {
  const { isAccuracyTooLow } = require("../src/rules/accuracy");
  assert.strictEqual(isAccuracyTooLow("ABCDEF", "X"), true);
});

// ---------- model-code ----------
test("stripBrandSuffix: potong 5 karakter terakhir", () => {
  const { stripBrandSuffix } = require("../src/rules/model-code");
  assert.strictEqual(stripBrandSuffix("AC-1234X"), "AC-");
});
test("stripBrandSuffix: string pendek", async () => {
  const { stripBrandSuffix } = require("../src/rules/model-code");
  assert.strictEqual(stripBrandSuffix("AB"), "");
});

// ---------- unit ----------
test("unitFromSubline: ODU dari subline", () => {
  const { unitFromSubline } = require("../src/rules/unit");
  assert.strictEqual(unitFromSubline("LINE ODU ASSY INPUT"), "ODU");
  assert.strictEqual(unitFromSubline("LINE ODU PACKING INPUT"), "ODU");
});
test("unitFromSubline: IDU dari subline", () => {
  const { unitFromSubline } = require("../src/rules/unit");
  assert.strictEqual(unitFromSubline("LINE IDU ASSY INPUT"), "IDU");
  assert.strictEqual(unitFromSubline("LINE IDU TESTING OUTPUT"), "IDU");
});
test("unitFromSubline: tanpa unit -> null", () => {
  const { unitFromSubline } = require("../src/rules/unit");
  assert.strictEqual(unitFromSubline("LINE PACKING OUTPUT"), null);
  assert.strictEqual(unitFromSubline(""), null);
});

// ---------- typed category specifications ----------
test("typed category specs: WM has provisional typed fields only", () => {
  const { fieldsForCategory } = require("../src/services/category-specs");
  const fields = fieldsForCategory("wm", {
    sn_prefix: "WM-", sn_required: true,
    sn_drum_prefix: "DRM", sn_drum_required: true,
    sn_pump_prefix: "PMP", sn_pump_required: false,
  });
  assert.deepStrictEqual(fields.map((field) => field.key), ["sn", "sn_drum", "sn_pump"]);
  assert.strictEqual(fields.find((field) => field.key === "sn_drum").required, true);
  assert.strictEqual(fields.find((field) => field.key === "sn_pump").required, false);
});
test("typed category specs: AC metadata is complete before line filtering", () => {
  const { fieldsForCategory, fieldsForUnit } = require("../src/services/category-specs");
  const all = fieldsForCategory("ac", { pcb_idu_prefix: "PCB", pcb_idu_required: true, pcb_idu_unit: "IDU", pcb_odu_prefix: "PCBO", pcb_odu_required: true, pcb_odu_unit: "ODU", sn_motor_prefix: "MTR", sn_motor_required: true, sn_motor_unit: "ODU" });
  assert.deepStrictEqual(all.map((field) => field.key), ["sn", "sn_carton", "pcb_idu", "pcb_odu", "sn_motor", "sn_accessories"]);
  assert.deepStrictEqual(fieldsForUnit(all, "IDU").map((field) => field.key).includes("pcb_idu"), true);
  assert.deepStrictEqual(fieldsForUnit(all, "IDU").map((field) => field.key).includes("pcb_odu"), false);
  assert.deepStrictEqual(fieldsForUnit(all, "IDU").map((field) => field.key).includes("sn_motor"), false);
});
test("typed category specs: reject unknown fields and unsupported categories", () => {
  const { validatePayload, categoryKey } = require("../src/services/category-specs");
  assert.throws(
    () => validatePayload("wm", { sn_prefix: "WM-", sn_required: true }, { sn: "WM-1", sn_drum: "DRM-1", unknown: "x" }),
    /Field tidak dikenal kategori/,
  );
  assert.strictEqual(categoryKey("washing"), "wm");
  assert.strictEqual(categoryKey("an"), "ac");
  assert.throws(() => categoryKey("tv"), /Kategori produk tidak didukung/);
});