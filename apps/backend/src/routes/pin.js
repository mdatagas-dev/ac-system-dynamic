const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");

router.get("/", async (req, res) => {
  const result = await prisma.pin.findMany({
    orderBy: {
      date: "desc",
    },
  });

  const parsedResult = result.map((item) => ({
    ...item,
    pin: Number(item.pin),
  }));
  res.status(200).json({ message: "data berhasil", data: parsedResult });
});

router.post("/post", async (req, res) => {
  const { date, pin } = req.body;
  const dateIn = new Date(date);

  const findDate = await prisma.pin.findFirst({
    where: {
      date: dateIn,
    },
  });
  if (findDate) {
    throw new AppError("Tanggal sudah tersedia", 409, "DUPLICATE");
  }
  const result = await prisma.pin.create({
    data: {
      date: dateIn,
      pin: Number(pin),
    },
  });
  res.status(200).json({
    message: "Simpan data berhasil",
    result: {
      ...result,
      pin: Number(result.pin),
    },
  });
});

router.post("/compare", async (req, res) => {
  const { pin } = req.body;
  const today = new Date();
  const date = today.toISOString().split("T")[0];

  const getData = await prisma.pin.findFirst({
    where: {
      date: new Date(date),
    },
  });

  if (!getData) {
    throw new AppError("Pin untuk hari ini belum dibuat", 404, "NOT_FOUND");
  }

  if (Number(getData.pin) !== Number(pin)) {
    throw new AppError("Pin tidak sesuai", 400, "VALIDATION");
  }
  res.status(200).json(true);
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  const result = await prisma.pin.delete({
    where: {
      id: id,
    },
  });
  res.status(200).json({
    message: "Deleted Successfully",
    result: {
      ...result,
      pin: Number(result.pin),
    },
  });
});

module.exports = router;
