// Pure. AC unit dibagi ODU (outdoor) & IDU (indoor). Nama subline menentukan unit:
// "LINE ODU ASSY INPUT" → ODU, "LINE IDU ASSY INPUT" → IDU. Bila subline tidak
// menyebut unit, kembalikan null (berlaku untuk kedua unit).

function unitFromSubline(subline) {
  const s = String(subline || "").toUpperCase();
  if (s.includes("ODU")) return "ODU";
  if (s.includes("IDU")) return "IDU";
  return null;
}

module.exports = { unitFromSubline };
