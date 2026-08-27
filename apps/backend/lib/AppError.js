// Structured error: status HTTP + kode domain. Global error handler meneruskan keduanya.
class AppError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = AppError;