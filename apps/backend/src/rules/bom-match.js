// Pure. The BOM rule (one bomlist row per model+order) declares the universe of scan fields.
// Fixed columns are prefix templates for the standard SNs; `components` JsonB holds dynamic
// field definitions: { [key]: { label, prefix, required } }.

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

const METADATA_KEYS = new Set([
  "id", "model", "order_number", "po_number", "subline", "userid", "shift",
  "plan", "product_category", "productCategory", "components", "id_regist",
  "timestamps",
]);

const isPresent = (v) => v !== undefined && v !== null && v !== "";

/**
 * Declared fields of a BOM rule: non-empty fixed columns + components keys.
 * @param {{ [key: string]: any }} rule bomlist row
 * @returns {Array<{ key: string, label: string, prefix: string, required: boolean }>}
 */
function ruleFields(rule) {
  const fields = [];
  for (const f of FIXED_FIELDS) {
    if (isPresent(rule[f.key])) {
      fields.push({ key: f.key, label: f.label, prefix: String(rule[f.key]), required: true });
    }
  }
  const comps = rule.components && typeof rule.components === "object" ? rule.components : {};
  for (const [key, def] of Object.entries(comps)) {
    const d = def && typeof def === "object" ? def : {};
    fields.push({
      key,
      label: d.label || key,
      prefix: isPresent(d.prefix) ? String(d.prefix) : "",
      required: d.required !== false,
    });
  }
  return fields;
}

/** @returns {{ key: string, label: string } | null} first declared-but-missing required field */
function missingRequired(rule, payload) {
  for (const f of ruleFields(rule)) {
    if (f.required && !isPresent(payload[f.key])) return { key: f.key, label: f.label };
  }
  return null;
}

/** @returns {{ key: string, expected: string } | null} first shared field whose value misses the BOM prefix */
function findBomMismatch(rule, payload) {
  for (const f of ruleFields(rule)) {
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

module.exports = { FIXED_FIELDS, METADATA_KEYS, ruleFields, missingRequired, findBomMismatch, unknownKeys };