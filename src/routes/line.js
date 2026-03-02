const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/", async (req, res) => {
  try {
    const lines = await prisma.line.findMany();
    res.status(200).json({ message: "success", data: lines });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  const { line } = req.body;

  const upCaseLine = line.toUpperCase();
  try {
    //   validation
    const existingLine = await prisma.line.findFirst({
      where: { line: upCaseLine },
    });

    if (existingLine) {
      return res.status(400).json({ error: "Line already exists" });
    }

    const newLine = await prisma.line.create({
      data: {
        line: upCaseLine,
      },
    });
    res
      .status(201)
      .json({ message: "Line created successfully", data: newLine });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
    // console.error(error);
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  console.log(id);
  try {
    const deletedLine = await prisma.line.delete({
      where: { id: id },
    });
    res
      .status(200)
      .json({ message: "Line deleted successfully", data: deletedLine });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
