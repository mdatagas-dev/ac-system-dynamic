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

// ---------- product categories ----------
test("categoryKey: normalize supported aliases", () => {
  const { categoryKey } = require("../src/services/category-specs");
  assert.strictEqual(categoryKey("washing"), "wm");
  assert.strictEqual(categoryKey("an"), "ac");
});
test("categoryKey: reject unsupported categories", () => {
  const { categoryKey } = require("../src/services/category-specs");
  assert.throws(() => categoryKey("tv"), /Kategori produk tidak didukung/);
});
