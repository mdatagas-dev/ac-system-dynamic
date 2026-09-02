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
    omit: { hash: true, password: true },
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

  let setHash;
  let setPassword;
  if (password && password.trim() !== "") {
    setHash = await bcrypt.hash(password, 10);
    setPassword = password;
  } else {
    setHash = currentUser?.hash;
    setPassword = currentUser?.password;
  }
  const result = await prisma.users.update({
    where: { id: id },
    data: {
      username,
      departement,
      section,
      roleuser,
      email,
      hash: setHash,
      password: setPassword,
    },
  });

  res.status(201).json({ message: "Updated success", result });
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
      password,
      email,
      roleuser,
      departement,
      section,
    },
  });
  res.status(201).json({ message: "Registration successful", user: newUser });
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  const result = await prisma.users.delete({
    where: { id },
  });
  res.status(200).json({ message: "delete successful", result });
});

module.exports = router;