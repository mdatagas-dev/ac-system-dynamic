// Pure. `model.model` menyimpan nama model dengan akhiran brand 5 karakter;
// route memotong 5 karakter terakhir sebelum join ke bomlist.
// ponytail: konvensi "5 karakter brand suffix" adalah celah bawaan — migrasi
// ke kolom brand terpisah diperlukan untuk menghapusnya. slice dengan indeks
// negatif otomatis aman (kembali "") untuk model yang lebih pendek dari 5.

const BRAND_SUFFIX_LEN = 5;

function stripBrandSuffix(model) {
  const s = String(model || "");
  return s.slice(0, s.length - BRAND_SUFFIX_LEN);
}

module.exports = { stripBrandSuffix, BRAND_SUFFIX_LEN };
