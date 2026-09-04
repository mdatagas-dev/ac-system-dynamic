// Pure. Struktur field scan ditentukan TEMPLATE kategori (product_categories.fields:
// [{key, label, required, unit}] atas 7 kolom material), sedangkan bomlist baris memegang
// nilai prefix per order. ruleFields() menggabungkan keduanya; sistem `components`
// (custom key di luar 7 material) tetap dideklarasikan per baris seperti sebelumnya.

const FIXED_FIELDS = [
  { key: "sn", label: "SN Unit" },
  { key: "sn_carton", label: "SN Carton" },
  { key: "pcb_idu", label: "PCB IDU" },
  { key: "sn_box", label: "SN Box" },
  { key: "sn_motor", label: "SN Motor" },
  { key: "sn_accessories", label: "SN Accessories" },
  { key: "sn_odu", label: "SN ODU" },
];
const FIXED_KEYS = new Set(FIXED_FIELDS.map((f) => f.key));
const FIXED_LABELS = Object.fromEntries(FIXED_FIELDS.map((f) => [f.key, f.label]));

const METADATA_KEYS = new Set([
  "id", "model", "order_number", "po_number", "subline", "userid", "shift",
  "plan", "product_category", "productCategory", "components", "unit_map", "id_regist",
  "timestamps", "fields", "fields_snapshot",
]);

const isPresent = (v) => v !== undefined && v !== null && v !== "";

/**
 * Field efektif sebuah BOM rule: template kategori (wajib — resolver melempar error
 * bila kosong) menentukan struktur; prefix dari kolom baris. Components custom tetap
 * dari baris.
 * @param {{ [key: string]: any }} rule bomlist row + fields (template)
 * @returns {Array<{ key: string, label: string, prefix: string, required: boolean, unit: string | null }>}
 */
function ruleFields(rule) {
  const fields = [];
  const template = Array.isArray(rule.fields) ? rule.fields : [];
  for (const t of template) {
    const d = t && typeof t === "object" ? t : {};
    const prefix = isPresent(rule[d.key]) ? String(rule[d.key]) : "";
    fields.push({
      key: d.key,
      label: d.label || FIXED_LABELS[d.key] || d.key,
      prefix,
      // ponytail: wajib hanya bila baris BOM punya prefix — tanpa prefix tak ada
      // yang divalidasi, jadi field tak boleh memblokir simpan regist/scan
      required: d.required !== false && isPresent(prefix),
      unit: isPresent(d.unit) ? d.unit : null,
    });
  }
  const comps = rule.components && typeof rule.components === "object" ? rule.components : {};
  for (const [key, def] of Object.entries(comps)) {
    if (key === "_unit_map") continue;
    const c = def && typeof def === "object" ? def : {};
    fields.push({
      key,
      label: c.label || key,
      prefix: isPresent(c.prefix) ? String(c.prefix) : "",
      required: c.required !== false,
      unit: isPresent(c.unit) ? c.unit : null,
    });
  }
  return fields;
}

/**
 * Sama dengan ruleFields tetapi hanya untuk field yang cocok dengan unit tertentu
 * (unit = null → field tanpa unit, cocok untuk semua subline).
 */
function ruleFieldsForUnit(rule, currentUnit) {
  return ruleFields(rule).filter((f) => !f.unit || f.unit === currentUnit);
}

/** @returns {{ key: string, label: string } | null} first declared-but-missing required field */
function missingRequired(rule, payload, fields = ruleFields(rule)) {
  for (const f of fields) {
    if (f.required && !isPresent(payload[f.key])) return { key: f.key, label: f.label };
  }
  return null;
}

/** @returns {{ key: string, expected: string } | null} first shared field whose value misses the BOM prefix */
function findBomMismatch(rule, payload, fields = ruleFields(rule)) {
  for (const f of fields) {
    const scanned = payload[f.key];
    if (isPresent(f.prefix) && isPresent(scanned) && !String(scanned).includes(f.prefix)) {
      return { key: f.key, expected: f.prefix };
    }
  }
  return null;
}

/** @returns {string[]} payload keys not declared and not a standard column (junk dynamic keys) */
function unknownKeys(rule, payload) {
  const declared = new Set(ruleFields(rule).map((f) => f.key));
  return Object.keys(payload).filter(
    (k) =>
      !METADATA_KEYS.has(k) &&
      !FIXED_KEYS.has(k) &&
      !declared.has(k) &&
      isPresent(payload[k]),
  );
}

/**
 * Validasi template kategori: ≥1 field, wajib memuat sn, key ⊆ 7 material,
 * unit ∈ ODU|IDU|null. @returns {string | null} pesan error atau null bila valid.
 */
function validateTemplate(fields) {
  if (!Array.isArray(fields) || fields.length === 0) return "minimal 1 field";
  const keys = new Set();
  for (const f of fields) {
    if (!f || typeof f !== "object" || !FIXED_KEYS.has(f.key)) return `key tidak dikenal: ${f && f.key}`;
    if (keys.has(f.key)) return `key duplikat: ${f.key}`;
    keys.add(f.key);
    if (isPresent(f.unit) && f.unit !== "ODU" && f.unit !== "IDU") return `unit tidak valid pada ${f.key}: ${f.unit}`;
  }
  if (!keys.has("sn")) return "template wajib memuat sn";
  return null;
}

/** Normalisasi template: label default per key, required boolean, unit null. */
function normalizeTemplate(fields) {
  return fields.map((f) => ({
    key: f.key,
    label: isPresent(f.label) ? String(f.label).trim() : FIXED_LABELS[f.key],
    required: f.required !== false,
    unit: isPresent(f.unit) ? f.unit : null,
  }));
}

module.exports = {
  FIXED_FIELDS, METADATA_KEYS, ruleFields, ruleFieldsForUnit,
  missingRequired, findBomMismatch, unknownKeys, validateTemplate, normalizeTemplate,
};