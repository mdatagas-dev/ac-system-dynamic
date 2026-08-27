// Akses registrasi: pemilik atau yang punya permission read-all.
const AppError = require("../../lib/AppError");
const { hasPermission } = require("./permissions");

function assertCanAccessRegistration(user, regist) {
  if (!regist) {
    throw new AppError("Regist tidak ditemukan", 404, "REGIST_NOT_FOUND");
  }
  if (hasPermission(user, "registscan:read")) return; // superuser lihat semua
  if (regist.userid !== user.id) {
    throw new AppError("Forbidden - bukan registrasi Anda", 403, "FORBIDDEN");
  }
}

module.exports = { assertCanAccessRegistration };