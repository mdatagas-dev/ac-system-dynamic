// Satu sumber kebenaran untuk "bagaimana field form diturunkan dari baris BOM (bomlist)".
// Struktur field datang dari template kategori (row.fields dari server); label/unit dari
// template, prefix dari kolom baris. Dipakai halaman regist & scan + master (BOM editor).

export interface BomRuleField {
  key: string;
  label: string;
  prefix: string;
  required: boolean;
  /** Unit AC (ODU/IDU) dari template — null = berlaku semua line. */
  unit: string | null;
}

export interface BomRule {
  id: string;
  model: string;
  order_number: string;
  sn?: string | null;
  sn_carton?: string | null;
  pcb_idu?: string | null;
  sn_box?: string | null;
  sn_motor?: string | null;
  sn_accessories?: string | null;
  sn_odu?: string | null;
  sn_drum?: string | null;
  sn_pump?: string | null;
  /** Typed category metadata returned by the backend. */
  fields?: Array<{ key: string; label?: string; prefix?: string; required?: boolean; unit?: string | null }> | null;
}

const FIXED_LABELS: Record<string, string> = {
  sn: "Serial Number",
  sn_carton: "SN Carton",
  pcb_idu: "SN PCB",
  sn_box: "SN Electrical Box",
  sn_motor: "SN Motor",
  sn_accessories: "SN Accessories",
  sn_odu: "Serial Number (ODU)",
};

/**
 * Field yang dideklarasikan untuk baris BOM: template kategori (wajib ada di row.fields
 * dari server) menentukan struktur; prefix dari kolom baris. Components custom tetap
 * dibaca dari row.components (sistem lama, tidak berubah).
 */
export function bomFields(row: BomRule | Record<string, unknown> | null | undefined): BomRuleField[] {
  if (!row || typeof row !== "object") return [];
  const r = row as Record<string, unknown>;
  const fields: BomRuleField[] = [];

  const template = Array.isArray(r.fields) ? (r.fields as Array<{ key: string; label?: string; prefix?: string; required?: boolean; unit?: string | null }>) : [];
  for (const t of template) {
    // Typed endpoints include prefix in field metadata. The fallback keeps the
    // reader compatible with legacy BOM responses during cutover.
    const raw = t.prefix ?? r[t.key];
    const prefix = raw !== undefined && raw !== null && String(raw).trim() !== "" ? String(raw) : "";
    fields.push({
      key: t.key,
      label: t.label || FIXED_LABELS[t.key] || t.key,
      prefix,
      required: t.required === true && prefix !== "",
      unit: t.unit ?? null,
    });
  }
  return fields;
}

/** Unit AC dari nama subline (ODU/IDU), null bila tidak menyebut unit. */
export function unitFromSubline(subline: string | null | undefined): string | null {
  const s = String(subline ?? "").toUpperCase();
  if (s.includes("ODU")) return "ODU";
  if (s.includes("IDU")) return "IDU";
  return null;
}

/** Field yang tampil untuk unit tertentu: field tanpa unit + field unit yang cocok. */
export function bomFieldsForUnit(fields: BomRuleField[], unit: string | null): BomRuleField[] {
  return fields.filter((f) => !f.unit || f.unit === unit);
}