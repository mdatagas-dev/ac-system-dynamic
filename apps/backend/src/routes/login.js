const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const redis = require("../config/redis");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const AppError = require("../../lib/AppError");

// Durasi session dalam detik (default 8 jam), bisa di-override lewat env SESSION_TTL
const SESSION_TTL = Number(process.env.SESSION_TTL) || 8 * 60 * 60;

// Baca satu cookie dari header "Cookie" (tanpa dependensi eksternal)
const parseCookie = (header, name) => {
  if (!header) return null;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

// POST /auth/login — alur:
// 1. validasi body (username + password wajib)
// 2. cari user di PostgreSQL + bcrypt.compare
// 3. sukses: buat session_id random -> simpan user payload di Redis session:<id>
// 4. Set-Cookie session_id (HttpOnly, SameSite=Lax, Secure di production)
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    throw new AppError("Username dan password wajib diisi", 400, "VALIDATION");
  }

  // Cari user berdasarkan username di tabel users
  const findUser = await prisma.users.findFirst({
    where: { username: username.trim() },
  });

  // User tidak ada / hash kosong -> anggap gagal, 401
  // (pesan sama untuk user-tidak-ada dan password-salah, biar tak bocorkan info)
  if (!findUser || !findUser.hash || !(await bcrypt.compare(password, findUser.hash))) {
    throw new AppError("Username atau password salah", 401, "AUTH_FAILED");
  }

  // Buat session id acak (32 byte hex) sebagai identitas session
  const sessionId = crypto.randomBytes(32).toString("hex");
  // Payload user yang disimpan di session (dipakai middleware auth sebagai req.user)
  const user = {
    id: findUser.id,
    username: findUser.username,
    roleuser: findUser.roleuser,
    depart: findUser.departement,
    section: findUser.section,
  };

  // Simpan session di Redis dengan TTL (SESSION_TTL detik)
  await redis.set(`session:${sessionId}`, JSON.stringify(user), { EX: SESSION_TTL });

  // Kirim session id via cookie HttpOnly -> JS browser tidak bisa baca
  // Secure hanya di production (HTTPS), SameSite=Lax cegah CSRF lintas situs
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax${secure}`,
  );

  res.status(200).json({ message: "login successful", user });
});

// POST /auth/logout — hapus session dari Redis + bersihkan cookie di browser
router.post("/logout", async (req, res) => {
  // Ambil session id dari cookie yang dikirim client
  const sessionId = parseCookie(req.headers.cookie || "", "session_id");

  // Hapus key session di Redis -> session langsung tidak valid
  if (sessionId) {
    await redis.del(`session:${sessionId}`);
  }
  // Set cookie kadaluarsa (Max-Age=0) di sisi browser
  res.setHeader(
    "Set-Cookie",
    "session_id=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
  );
  res.status(200).json({ message: "logout successful" });
});

// GET /auth/me — cek session aktif, kembalikan user payload (untuk restore sesi frontend)
router.get("/me", async (req, res) => {
  const sessionId = parseCookie(req.headers.cookie || "", "session_id");
  if (!sessionId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const data = await redis.get(`session:${sessionId}`);
  if (!data) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.status(200).json({ user: JSON.parse(data) });
});

module.exports = router;
