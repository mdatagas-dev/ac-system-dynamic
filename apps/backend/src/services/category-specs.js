const AppError = require("../../lib/AppError");

const SUPPORTED_CATEGORIES = new Set(["ac", "wm"]);

function categoryKey(category) {
  const raw = String(category || "").trim().toLowerCase();
  const key = { ai: "ac", an: "ac", washing: "wm" }[raw] ?? raw;
  if (!SUPPORTED_CATEGORIES.has(key)) {
    throw new AppError(
      "Kategori produk tidak didukung",
      400,
      "UNSUPPORTED_CATEGORY",
    );
  }
  return key;
}

function present(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalize(value) {
  return present(value) ? String(value).trim().toUpperCase() : null;
}

module.exports = { categoryKey, normalize, present };
