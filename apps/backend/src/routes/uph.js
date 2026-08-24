const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/", async (req, res) => {
  try {
    const result = await prisma.uph.findMany({
      orderBy: { uph: "desc" },
    });
    res.status(200).json({ message: "success", data: result });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  const { model, line, uph } = req.body;

  try {
    const result = await prisma.uph.create({
      data: {
        model,
        line,
        uph: Number(uph),
      },
    });
    res.status(201).json({ message: "Data berhasil ditambah", data: result });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { model, line, uph } = req.body;

  try {
    const result = await prisma.uph.update({
      where: { id },
      data: {
        model,
        line,
        uph: Number(uph),
      },
    });
    res.status(200).json({ message: "Data berhasil diubah", data: result });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.uph.delete({ where: { id } });
    res.status(200).json({ message: "Deleted Succesfully" });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
