const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "", archived = "false" } = req.query;
  const showArchived = String(archived) === "true";
  const skip = (Number(page) - 1) * Number(limit);
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  const where = {
    ...(showArchived ? {} : { is_active: true }),
    ...(keyword
      ? {
          OR: [
            isUUID ? { id: { equals: keyword } } : undefined,
            { sn_carton: { contains: keyword, mode: "insensitive" } },
            { model: { contains: keyword, mode: "insensitive" } },
            { pcb_idu: { contains: keyword, mode: "insensitive" } },
            { sn_box: { contains: keyword, mode: "insensitive" } },
            { sn_motor: { contains: keyword, mode: "insensitive" } },
            { sn_accessories: { contains: keyword, mode: "insensitive" } },
            { order_number: { contains: keyword, mode: "insensitive" } },
            { sn: { contains: keyword, mode: "insensitive" } },
          ].filter(Boolean),
        }
      : {}),
  };
  const total = await prisma.bomlist.count({ where });
  try {
    const result = await prisma.bomlist.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: {
        timestamps: "desc",
      },
    });

    res.status(200).json({
      data: result,
      total,
      currentPages: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    // console.log("Error In Read Bomlist", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  const handleData = req.body;
  const model = String(handleData.model || "").trim();
  const orderNumber = String(handleData.order_number || "").trim();

  try {
    if (!model || !orderNumber) {
      return res.status(400).json({ error: "model dan order_number wajib diisi" });
    }

    const master = await prisma.model.findFirst({ where: { model } });
    if (!master) {
      return res.status(400).json({ error: "Create the model first in Model Master" });
    }

    const existing = await prisma.bomlist.findFirst({
      where: { model, order_number: orderNumber, is_active: true },
    });
    if (existing) {
      return res.status(400).json({ error: "BOM rule already exists for this model and order" });
    }

    const components =
      handleData.components && typeof handleData.components === "object"
        ? handleData.components
        : undefined;

    const result = await prisma.bomlist.create({
      data: {
        sn_carton: handleData.sn_carton,
        model,
        pcb_idu: handleData.pcb_idu,
        sn_box: handleData.sn_box,
        sn_motor: handleData.sn_motor,
        sn_accessories: handleData.sn_accessories,
        order_number: orderNumber,
        sn: handleData.sn,
        components,
      },
    });
    res.status(200).json({ message: "success", data: result });
  } catch (error) {
    // console.log("Error In Create Bomlist: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const handleData = req.body;
  const model = String(handleData.model || "").trim();
  const orderNumber = String(handleData.order_number || "").trim();

  try {
    if (!model || !orderNumber) {
      return res.status(400).json({ error: "model dan order_number wajib diisi" });
    }

    const master = await prisma.model.findFirst({ where: { model } });
    if (!master) {
      return res.status(400).json({ error: "Create the model first in Model Master" });
    }

    const existing = await prisma.bomlist.findFirst({
      where: { model, order_number: orderNumber, is_active: true, NOT: { id } },
    });
    if (existing) {
      return res.status(400).json({ error: "BOM rule already exists for this model and order" });
    }

    const components =
      handleData.components !== undefined && typeof handleData.components === "object"
        ? handleData.components
        : undefined;

    const result = await prisma.bomlist.update({
      where: { id },
      data: {
        sn_carton: handleData.sn_carton,
        model,
        pcb_idu: handleData.pcb_idu,
        sn_box: handleData.sn_box,
        sn_motor: handleData.sn_motor,
        sn_accessories: handleData.sn_accessories,
        order_number: orderNumber,
        sn: handleData.sn,
        ...(components ? { components } : {}),
      },
    });
    res.status(200).json({ message: "success", data: result });
  } catch (error) {
    // console.log("Error In Update Bomlist", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // soft-delete: arsip, aturan lama tetap jadi sejarah tapi tak dipakai batch baru
    await prisma.bomlist.update({
      where: { id },
      data: { is_active: false },
    });
    res.status(200).json({ message: "success" });
  } catch (error) {
    // console.log("Error In Delete Bomlist", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
