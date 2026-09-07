const AppError = require("../../lib/AppError");

const AC_FIELDS = [
  ["sn", "Serial Number", null, true],
  ["sn_odu", "Serial Number (ODU)", "ODU", false],
  ["sn_carton", "SN Carton", null, false],
  ["pcb_idu", "SN PCB", "IDU", false],
  ["sn_box", "SN Electrical Box", "IDU", false],
  ["sn_motor", "SN Motor", "ODU", false],
  ["sn_accessories", "SN Accessories", null, false],
];
const WM_FIELDS = [
  ["sn", "Serial Number", null, true],
  ["sn_drum", "SN Drum", null, true],
  ["sn_pump", "SN Pump", null, false],
];

const definitions = {
  ac: { bomDelegate: "ac_bom_spec", registrationDelegate: "ac_registration_spec", scanDelegate: "recordscan_ac", fields: AC_FIELDS },
  wm: { bomDelegate: "wm_bom_spec", registrationDelegate: "wm_registration_spec", scanDelegate: "recordscan_wm", fields: WM_FIELDS },
};

function categoryKey(category) {
  const raw = String(category || "").trim().toLowerCase();
  const key = { ai: "ac", an: "ac", washing: "wm" }[raw] ?? raw;
  if (!definitions[key]) throw new AppError("Kategori produk tidak didukung", 400, "UNSUPPORTED_CATEGORY");
  return key;
}

function isSupportedCategory(category) {
  try {
    categoryKey(category);
    return true;
  } catch {
    return false;
  }
}

function definition(category) {
  return definitions[categoryKey(category)];
}

function fieldsForCategory(category, bomSpec) {
  return definition(category).fields.map(([key, label, defaultUnit, defaultRequired]) => {
    const unit = category === "ac" ? (bomSpec?.[`${key}_unit`] ?? defaultUnit) : defaultUnit;
    const prefix = bomSpec?.[`${key}_prefix`] ?? "";
    const required = bomSpec?.[`${key}_required`] ?? defaultRequired;
    return { key, label, unit, prefix, required: Boolean(required && prefix) };
  });
}

function fieldsForUnit(fields, currentUnit) {
  return fields.filter((field) => !field.unit || field.unit === currentUnit);
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalize(value) {
  return present(value) ? String(value).trim().toUpperCase() : null;
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function validatePayload(category, bomSpec, payload, currentUnit) {
  const allFields = fieldsForCategory(category, bomSpec);
  const fields = fieldsForUnit(allFields, currentUnit);
  // A registration can carry references for the other AC unit, even though the
  // current line validates only its own fields.
  const allowed = new Set(allFields.map((field) => field.key));
  for (const field of fields) {
    const value = payload[field.key];
    if (field.required && !present(value)) throw new AppError(`Wajib diisi: ${field.label}`, 400, "MISSING_REQUIRED");
    if (present(field.prefix) && present(value) && !String(value).toUpperCase().includes(String(field.prefix).toUpperCase())) {
      throw new AppError(`${field.key} tidak sesuai BOM (diharapkan mengandung: ${field.prefix})`, 400, "BOM_MISMATCH");
    }
  }
  const knownMetadata = new Set(["model", "order_number", "po_number", "subline", "userid", "shift", "plan", "id_regist", "product_category"]);
  const unknown = Object.keys(payload).filter((key) => !knownMetadata.has(key) && present(payload[key]) && !allowed.has(key));
  if (unknown.length) throw new AppError(`Field tidak dikenal kategori: ${unknown.join(", ")}`, 400, "UNKNOWN_FIELD");
  return fields;
}

function typedData(category, payload, { partial = false } = {}) {
  return Object.fromEntries(
    definition(category).fields
      .filter(([key]) => !partial || Object.hasOwn(payload, key))
      .map(([key]) => [key, normalize(payload[key])]),
  );
}

function bomSpecData(category, payload) {
  const data = {};
  for (const [key, , defaultUnit, defaultRequired] of definition(category).fields) {
    data[`${key}_prefix`] = normalize(payload[key]);
    data[`${key}_required`] = parseBoolean(payload[`${key}_required`], defaultRequired);
    if (category === "ac") data[`${key}_unit`] = payload[`${key}_unit`] ?? defaultUnit;
  }
  return data;
}

function scanDelegate(category, db) {
  return db[definition(category).scanDelegate];
}

module.exports = {
  categoryKey, isSupportedCategory, definition, fieldsForCategory, fieldsForUnit, validatePayload,
  typedData, bomSpecData, scanDelegate, normalize, present,
};
