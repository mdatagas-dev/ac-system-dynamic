const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  const where = keyword
    ? {
        OR: [
          { brand: { contains: keyword, mode: "insensitive" } },
          { model: { contains: keyword, mode: "insensitive" } },
        ],
      }
    : {};
  try {
    const total = await prisma.model.count({ where });
    const result = await prisma.model.findMany({
      where,
      skip: Number.isNaN(skip) ? 0 : skip,
      take: Number(limit),
    });

    const resultIndex = result.map((item, index) => ({
      ...item,
      index: skip + index + 1,
    }));
    res.status(200).json({
      data: resultIndex,
      total,
      currentPages: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  const { brand, model, pk, linkimage } = req.body;

  try {
    const checkModel = await prisma.model.findFirst({
      where: {
        model: model,
      },
    });

    if (checkModel !== null) {
      res.status(409).json({ error: "Double Model" });
      return;
    }

    const result = await prisma.model.create({
      data: {
        brand,
        model,
        pk: Number(pk),
        linkimage,
      },
    });
    res.status(200).json({ message: "Data berhasil ditambah", data: result });
  } catch (error) {
    // console.error(error.message);
    res.status(500).json({ error: "Gagal menambahkan data" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { brand, model, linkimage } = req.body;
  try {
    const result = await prisma.model.update({
      where: {
        id: id,
      },
      data: {
        brand,
        model,
        linkimage,
      },
    });
    res.status(201).json(result);
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await prisma.model.delete({
      where: {
        id: id,
      },
    });
    res.status(200).json({ result: result, message: "Deleted Succesfully" });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
