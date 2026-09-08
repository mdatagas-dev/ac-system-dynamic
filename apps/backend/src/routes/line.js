const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const AppError = require("../../lib/AppError");
const requirePermission = require("../../middlewares/requirePermission");

router.get("/", async (req, res) => {
  const lines = await prisma.line.findMany();
  res.status(200).json({ message: "success", data: lines });
});

router.post("/post", requirePermission("master-data:write"), async (req, res) => {
  const { line } = req.body;
  const upCaseLine = line.toUpperCase();

  const existingLine = await prisma.line.findFirst({
    where: { line: upCaseLine },
  });

  if (existingLine) {
    throw new AppError("Line already exists", 400, "VALIDATION");
  }

  const newLine = await prisma.line.create({
    data: {
      line: upCaseLine,
    },
  });
  res
    .status(201)
    .json({ message: "Line created successfully", data: newLine });
});

router.delete("/:id", requirePermission("master-data:write"), async (req, res) => {
  const { id } = req.params;
  const deletedLine = await prisma.line.delete({
    where: { id: id },
  });
  res
    .status(200)
    .json({ message: "Line deleted successfully", data: deletedLine });
});

module.exports = router;
