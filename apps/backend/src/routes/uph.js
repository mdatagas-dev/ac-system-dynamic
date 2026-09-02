const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/", async (req, res) => {
  const result = await prisma.uph.findMany({
    orderBy: { uph: "desc" },
  });
  res.status(200).json({ message: "success", data: result });
});

router.post("/post", async (req, res) => {
  const { model, line, uph } = req.body;
  const result = await prisma.uph.create({
    data: {
      model,
      line,
      uph: Number(uph),
    },
  });
  res.status(201).json({ message: "Data berhasil ditambah", data: result });
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { model, line, uph } = req.body;
  const result = await prisma.uph.update({
    where: { id },
    data: {
      model,
      line,
      uph: Number(uph),
    },
  });
  res.status(200).json({ message: "Data berhasil diubah", data: result });
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.uph.delete({ where: { id } });
  res.status(200).json({ message: "Deleted Succesfully" });
});

module.exports = router;
