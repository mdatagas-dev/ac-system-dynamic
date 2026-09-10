const prisma = require("../lib/prisma");
const AppError = require("../lib/AppError");

// PPC operators must provide today's PIN for edits or destructive actions.
// Superusers keep their existing administrative authorization path.
async function requirePpcPin(req, _res, next) {
  if (String(req.user?.roleuser || "").toLowerCase() !== "ppc") return next();
  const pin = String(req.headers["x-pin"] || "").trim();
  if (!pin) return next(new AppError("PIN harian wajib untuk mengubah atau menghapus data", 403, "PIN_REQUIRED"));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(`${today}T00:00:00.000Z`);
  const numericPin = Number(pin);
  const record = Number.isFinite(numericPin)
    ? await prisma.pin.findFirst({ where: { date, pin: numericPin } })
    : null;
  if (!record) {
    return next(new AppError("PIN harian tidak sesuai", 403, "PIN_INVALID"));
  }
  return next();
}

module.exports = requirePpcPin;
