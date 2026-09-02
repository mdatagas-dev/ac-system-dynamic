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

// ---------- bom-match (template kategori) ----------
test("ruleFields: template menentukan struktur, prefix dari baris", () => {
  const { ruleFields } = require("../src/rules/bom-match");
  const rule = {
    fields: [
      { key: "sn", label: "Serial Number", required: true, unit: null },
      { key: "sn_box", label: "SN Box", required: true, unit: "IDU" },
      { key: "sn_motor", label: "SN Motor", required: true, unit: "ODU" },
    ],
    sn: "ABC", sn_box: "BOX", sn_motor: "", // sn_motor prefix kosong di baris
    components: { drum: { label: "Drum", required: true } },
  };
  const fields = ruleFields(rule);
  assert.ok(fields.some((f) => f.key === "sn" && f.label === "Serial Number" && f.prefix === "ABC" && f.required));
  assert.ok(fields.some((f) => f.key === "sn_box" && f.prefix === "BOX" && f.unit === "IDU"));
  // template-is-law: sn_motor tetap dideklarasikan walau prefix baris kosong (prefix: "")
  assert.ok(fields.some((f) => f.key === "sn_motor" && f.prefix === "" && f.unit === "ODU"));
  // kolom tak dideklarasikan template → mati
  assert.ok(!fields.some((f) => f.key === "sn_carton"));
  // components custom tetap dari baris
  assert.ok(fields.some((f) => f.key === "drum" && f.label === "Drum" && f.required));
});
test("missingRequired: field kosong di payload", () => {
  const { missingRequired } = require("../src/rules/bom-match");
  const rule = { fields: [{ key: "sn" }, { key: "drum" }], sn: "ABC", components: { drum: { required: true } } };
  assert.ok(missingRequired(rule, {}));
  assert.ok(missingRequired(rule, { sn: "ABC" })); // drum missing
  assert.strictEqual(missingRequired(rule, { sn: "ABC", drum: "XYZ" }), null);
});
test("findBomMismatch: nilai tanpa prefix", () => {
  const { findBomMismatch } = require("../src/rules/bom-match");
  const rule = { fields: [{ key: "sn" }], sn: "ABC" };
  assert.ok(findBomMismatch(rule, { sn: "XYZ" }));
  assert.strictEqual(findBomMismatch(rule, { sn: "ABC123" }), null);
});
test("unknownKeys: field di luar BOM + metadata", () => {
  const { unknownKeys } = require("../src/rules/bom-match");
  const rule = { fields: [{ key: "sn" }], sn: "ABC" };
  assert.deepStrictEqual(unknownKeys(rule, { sn: "ABC123", extra: "VAL" }), ["extra"]);
  assert.deepStrictEqual(unknownKeys(rule, { sn: "ABC123", model: "X" }), []);
});
test("validateTemplate: wajib sn, key dikenal, unit valid", () => {
  const { validateTemplate } = require("../src/rules/bom-match");
  assert.ok(validateTemplate([])); // kosong
  assert.ok(validateTemplate([{ key: "sn_carton" }])); // tanpa sn
  assert.ok(validateTemplate([{ key: "sn" }, { key: "sn" }])); // duplikat
  assert.ok(validateTemplate([{ key: "sn" }, { key: "drum" }])); // key di luar 7 material
  assert.ok(validateTemplate([{ key: "sn", unit: "XYZ" }])); // unit tidak valid
  assert.strictEqual(validateTemplate([{ key: "sn" }]), null);
  assert.strictEqual(validateTemplate([{ key: "sn" }, { key: "sn_odu", unit: "ODU" }]), null);
});
test("normalizeTemplate: label default + unit null", () => {
  const { normalizeTemplate } = require("../src/rules/bom-match");
  const out = normalizeTemplate([{ key: "sn" }, { key: "sn_odu", unit: "ODU", label: " ODU SN " }]);
  assert.deepStrictEqual(out, [
    { key: "sn", label: "SN Unit", required: true, unit: null },
    { key: "sn_odu", label: "ODU SN", required: true, unit: "ODU" },
  ]);
});

// ---------- recordscan ----------
test("buildScanRecord: SN uppercased, components dari unknown key", async () => {
  const { buildScanRecord, productCategory } = require("../src/services/recordscan");
  const data = buildScanRecord({ sn: "abc", sn_odu: "", sn_carton: "cart", pcb_idu: "pcb", sn_box: "box", sn_motor: "motor", sn_accessories: "acc", drum: "d001", components: { pump: "p001" }  }, "ac" );
  assert.strictEqual(data.sn, "ABC");
  assert.strictEqual(data.sn_carton, "CART");
  assert.strictEqual(data.sn_odu, "");
  assert.strictEqual(data.product_category, "ac");
  assert.deepStrictEqual(data.components, { drum: "D001", pump: "P001" });
});
test("buildScanRecord: components null bila kosong", async () => {
  const { buildScanRecord } = require("../src/services/recordscan");
  const data = buildScanRecord({ sn: "x" }, null);
  assert.strictEqual(data.components, null);
});
test("productCategory: fallback ke value", async () => {
  const { productCategory } = require("../src/services/recordscan");
  assert.strictEqual(productCategory({ product_category: "AC" }), "ac");
  assert.strictEqual(productCategory({ productCategory: "AC" }), "ac");
  assert.strictEqual(productCategory({}, "AC"), "ac");
  assert.strictEqual(productCategory({}, ""), null);
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

// ---------- bom-match unit ----------
test("ruleFields: unit dari template field def", () => {
  const { ruleFields } = require("../src/rules/bom-match");
  const rule = {
    fields: [
      { key: "sn", unit: "IDU" },
      { key: "sn_carton", unit: null },
    ],
    sn: "ABC", sn_carton: "BOX",
    components: { sn_drum: { label: "SN Drum", required: true, unit: "ODU" } },
  };
  const fields = ruleFields(rule);
  assert.ok(fields.some((f) => f.key === "sn" && f.unit === "IDU"));
  assert.ok(fields.some((f) => f.key === "sn_drum" && f.unit === "ODU"));
  assert.ok(fields.some((f) => f.key === "sn_carton" && f.unit === null)); // tanpa unit
});
test("ruleFieldsForUnit: filter unit", () => {
  const { ruleFieldsForUnit } = require("../src/rules/bom-match");
  const rule = {
    fields: [{ key: "sn", unit: "IDU" }, { key: "sn_carton", unit: "ODU" }],
    sn: "ABC", sn_carton: "BOX",
  };
  assert.strictEqual(ruleFieldsForUnit(rule, "IDU").length, 1);
  assert.strictEqual(ruleFieldsForUnit(rule, "IDU")[0].key, "sn");
  assert.strictEqual(ruleFieldsForUnit(rule, "ODU").length, 1);
  assert.strictEqual(ruleFieldsForUnit(rule, "ODU")[0].key, "sn_carton");
  assert.strictEqual(ruleFieldsForUnit(rule, null).length, 0); // semua unit terisi, tak ada null
});