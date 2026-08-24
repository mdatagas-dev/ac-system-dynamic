const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/", async (req, res) => {
  try {
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
  } catch (error) {
    // console.log("Handle error get pin:", error.message);
    res.status(500).json({ error: `Internal Server Error,${error.message}` });
  }
});

router.post("/post", async (req, res) => {
  const { date, pin } = req.body;
  const dateIn = new Date(date);
  try {
    const findDate = await prisma.pin.findFirst({
      where: {
        date: dateIn,
      },
    });
    if (findDate) {
      return res.status(409).json({ error: "Tanggal sudah tersedia" });
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
  } catch (error) {
    // console.log("handle error from pin:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/compare", async (req, res) => {
  const { pin } = req.body;
  const today = new Date();
  const date = today.toISOString().split("T")[0];
  try {
    const getData = await prisma.pin.findFirst({
      where: {
        date: new Date(date),
      },
    });

    if (!getData) {
      return res.status(404).json({ error: "Pin untuk hari ini belum dibuat" });
    }

    if (Number(getData.pin) === Number(pin)) {
      res.status(200).json(true);
    } else {
      res.status(400).json({ error: "Pin tidak sesuai" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
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
  } catch (error) {
    // console.log(error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
module.exports = router;
