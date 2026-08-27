const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const redis = require("../config/redis");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");
const { accessClaims, refreshedClaims } = require("../services/auth.claims");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const MAX_ATTEMPTS = 5;
const LOCKOUT_TTL = 10 * 60;

router.post("/", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username dan password wajib diisi" });
  }

  // Rate limit: 5x gagal per akun -> lockout 10 menit (per IP + username)
  const failKey = `login_fail:${req.ip}:${username}`;
  const fails = Number(await redis.get(failKey)) || 0;
  if (fails >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Terlalu banyak percobaan, coba lagi nanti" });
  }

  try {
    // mencari user di table users
    const findUser = await prisma.users.findFirst({
      where: { username: username.trim() },
    });

    // Pesan seragam untuk user-tidak-ada dan password-salah, biar tak bocorkan info
    if (!findUser || !findUser.hash || !(await bcrypt.compare(password, findUser.hash))) {
      await redis.incr(failKey);
      await redis.expire(failKey, LOCKOUT_TTL);
      return res.status(401).json({ error: "Username atau password salah" });
    }

    // membuat token key untuk permission request
    const accessToken = jwt.sign(accessClaims(findUser), process.env.JWT_SECRET, {
      expiresIn: "20m",
    });

    const refreshToken = jwt.sign(accessClaims(findUser), process.env.JWT_REFRESH, {
      expiresIn: "7d",
    });

    // sukses -> reset counter kegagalan
    await redis.del(failKey);

    res
      .status(200)
      .json({ message: "login successful", accessToken, refreshToken });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", message_error: error.message });
  }
});

router.post("/refresh_token", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH);

    const newAccessToken = jwt.sign(
      refreshedClaims(decoded),
      process.env.JWT_SECRET,
      { expiresIn: "20m" },
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ message: "Refresh token invalid" });
  }
});

module.exports = router;
