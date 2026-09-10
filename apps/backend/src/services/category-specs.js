const AppError = require("../../lib/AppError");

const AC_FIELDS = [
  ["sn", "Serial Number", null, true],
  ["sn_carton", "SN Carton", null, false],
  ["pcb_idu", "PCB IDU", null, false],
  ["pcb_odu", "PCB ODU", null, false],
  ["sn_motor", "SN Motor", null, false],
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

function definition(category) {
  return definitions[categoryKey(category)];
}

function fieldsForCategory(category, bomSpec) {
  const keyCategory = categoryKey(category);
  return definition(keyCategory).fields.map(([key, label, , defaultRequired]) => {
    const prefix = bomSpec?.[`${key}_prefix`] ?? "";
    const required = bomSpec?.[`${key}_required`] ?? defaultRequired;
    return { key, label, unit: null, prefix, required: Boolean(required && prefix) };
  });
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

function validatePayload(category, bomSpec, payload, { skipPrefix = false } = {}) {
  const fields = fieldsForCategory(category, bomSpec);
  // A universal BOM validates the same field set on every production line.
  const allowed = new Set(fields.map((field) => field.key));
  for (const field of fields) {
    const value = payload[field.key];
    if (field.required && !present(value)) throw new AppError(`Wajib diisi: ${field.label}`, 400, "MISSING_REQUIRED");
    // Prefix check is deferred (skipPrefix) so length/duplicate validation can
    // surface first — an edited or rescanned SN often no longer contains the
    // BOM prefix, and the operator needs the more specific error.
    if (!skipPrefix && present(field.prefix) && present(value) && !String(value).toUpperCase().includes(String(field.prefix).toUpperCase())) {
      throw new AppError(`${field.key} tidak sesuai BOM (diharapkan mengandung: ${field.prefix})`, 400, "BOM_MISMATCH");
    }
  }
  const knownMetadata = new Set(["model", "order_number", "po_number", "subline", "userid", "shift", "plan", "id_regist", "product_category"]);
  const unknown = Object.keys(payload).filter((key) => !knownMetadata.has(key) && present(payload[key]) && !allowed.has(key));
  if (unknown.length) throw new AppError(`Field tidak dikenal kategori: ${unknown.join(", ")}`, 400, "UNKNOWN_FIELD");
  return fields;
}

// Standalone prefix check (dipanggil terakhir setelah length/duplicate).
function assertPrefixes(fields, payload) {
  for (const field of fields) {
    const value = payload[field.key];
    if (present(field.prefix) && present(value) && !String(value).toUpperCase().includes(String(field.prefix).toUpperCase())) {
      throw new AppError(`${field.key} tidak sesuai BOM (diharapkan mengandung: ${field.prefix})`, 400, "BOM_MISMATCH");
    }
  }
}
function typedData(category, payload, { partial = false } = {}) {
  return Object.fromEntries(
    definition(category).fields
      .filter(([key]) => !partial || Object.hasOwn(payload, key))
      .map(([key]) => [key, normalize(payload[key])]),
  );
}

function bomSpecData(category, payload) {
  const keyCategory = categoryKey(category);
  const data = {};
  for (const [key, , , defaultRequired] of definition(keyCategory).fields) {
    data[`${key}_prefix`] = normalize(payload[key]);
    data[`${key}_required`] = parseBoolean(payload[`${key}_required`], defaultRequired);
    if (keyCategory === "ac") data[`${key}_unit`] = null;
  }
  return data;
}

function scanDelegate(category, db) {
  return db[definition(category).scanDelegate];
}

module.exports = {
  categoryKey, definition, fieldsForCategory, validatePayload, assertPrefixes,
  typedData, bomSpecData, scanDelegate, normalize, present,
};
