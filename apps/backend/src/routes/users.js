const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const bcrypt = require("bcrypt");
const AppError = require("../../lib/AppError");

router.get("/", async (req, res) => {
  const { keyword = "", limit = 10, page = 1 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );
  const where = keyword
    ? {
        OR: [
          isUUID ? { id: { equals: keyword } } : undefined,
          { username: { contains: keyword, mode: "insensitive" } },
          { departement: { contains: keyword, mode: "insensitive" } },
          { section: { contains: keyword, mode: "insensitive" } },
          { roleuser: { contains: keyword, mode: "insensitive" } },
          { email: { contains: keyword, mode: "insensitive" } },
        ].filter(Boolean),
      }
    : {};

  const result = await prisma.users.findMany({
    where,
    skip,
    take: Number(limit),
    omit: { hash: true },
  });

  const resultIndex = result.map((item, index) => ({
    ...item,
    index: skip + index + 1,
  }));

  const total = await prisma.users.count({ where });
  res.status(200).json({
    data: resultIndex,
    total,
    currentPages: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});

router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { username, password, email, roleuser, departement, section } = req.body;

  const existingUser = await prisma.users.findFirst({
    where: {
      username,
      NOT: {
        id: id,
      },
    },
  });

  if (existingUser) {
    throw new AppError("Username sudah di gunakan", 400, "VALIDATION");
  }

  const currentUser = await prisma.users.findUnique({
    where: { id },
  });

  const setHash = password && password.trim() !== ""
    ? await bcrypt.hash(password, 10)
    : currentUser?.hash;
  const result = await prisma.users.update({
    where: { id: id },
    data: {
      username,
      departement,
      section,
      roleuser,
      email,
      hash: setHash,
    },
  });

  const { hash: _updatedHash, ...safeResult } = result;
  res.status(201).json({ message: "Updated success", result: safeResult });
});

router.post("/regist", async (req, res) => {
  const { username, password, email, roleuser, departement, section } =
    req.body || {};

  if (!username || !password) {
    throw new AppError("username dan password wajib diisi", 400, "VALIDATION");
  }

  const existingUser = await prisma.users.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
    },
  });

  if (existingUser) {
    throw new AppError("username are already registered", 400, "VALIDATION");
  }

  // enkripsi password agar aman
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.users.create({
    data: {
      username,
      hash: hashedPassword,
      email,
      roleuser,
      departement,
      section,
    },
  });
  const { hash: _hash, ...safeUser } = newUser;
  res.status(201).json({ message: "Registration successful", user: safeUser });
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  const result = await prisma.users.delete({
    where: { id },
  });
  const { hash: _deletedHash, ...safeResult } = result;
  res.status(200).json({ message: "delete successful", result: safeResult });
});

module.exports = router;
