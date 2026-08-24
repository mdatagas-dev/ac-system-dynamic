const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

router.post("/", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username dan password wajib diisi" });
  }

  try {
    // mencari user di table users
    const findUser = await prisma.users.findFirst({
      where: { username: username.trim() },
    });

    // validasi jika tidak ada
    if (!findUser) {
      return res.status(401).json({ error: "Username Not Found" });
    }

    // engkripsi password dan compare dengan table users
    const pasCompare = await bcrypt.compare(password, findUser.hash);

    // validasi jika tidak ada
    if (!pasCompare) {
      return res.status(401).json({ error: "Wrong Password" });
    }

    // membuat token key untuk permission request
    const accessToken = jwt.sign(
      {
        id: findUser.id,
        username: findUser.username,
        roleuser: findUser.roleuser,
        depart: findUser.departement,
        section: findUser.section,
      },
      process.env.JWT_SECRET,
      { expiresIn: "20m" },
    );

    const refreshToken = jwt.sign(
      {
        id: findUser.id,
        username: findUser.username,
        roleuser: findUser.roleuser,
        depart: findUser.departement,
        section: findUser.section,
      },
      process.env.JWT_REFRESH,
      { expiresIn: "7d" },
    );

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
      {
        id: decoded.id,
        username: decoded.username,
        roleuser: decoded.roleuser,
        depart: decoded.depart,
        section: decoded.section,
      },
      process.env.JWT_SECRET,
      { expiresIn: "20m" },
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ message: "Refresh token invalid" });
  }
});

module.exports = router;
