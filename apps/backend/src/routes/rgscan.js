const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  let params = [];
  let optionQuery = "";
  let sql = "";
  let sqlcount = "";
  const isSuperuser =
    req.user.roleuser && req.user.roleuser.toLowerCase() === "superuser";

  if (isSuperuser) {
    if (keyword) {
      params.push(
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
      );
      optionQuery = ` AND (
      rgs.model ILIKE $1
      OR rgs.id::text ILIKE $2
      OR rgs.order_number ILIKE $3
      OR rgs.po_number ILIKE $4
      OR rgs.subline ILIKE $5
    )`;
    }
    params.push(Number(limit), Number(skip));
    sqlcount = `
    SELECT COUNT(id)::INTEGER FROM registscan AS rgs WHERE 1=1 ${optionQuery}
    `;
    sql = `
      SELECT 
      rgs.*,
      COUNT(rcd.id_regist)::INTEGER AS total
    FROM registscan AS rgs
    LEFT JOIN recordscan AS rcd
      ON rgs.id = rcd.id_regist::uuid 
    WHERE 1=1
      ${optionQuery}
    GROUP BY rgs.id
    ORDER BY rgs.timestamps DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
  } else {
    params.push(req.user.id);
    if (keyword) {
      params.push(
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
        `%${keyword}%`,
      );
      optionQuery = ` AND (
      rgs.model ILIKE $2
      OR rgs.id::text ILIKE $3
      OR rgs.order_number ILIKE $4
      OR rgs.po_number ILIKE $5
      OR rgs.subline ILIKE $6
    )`;
    }
    params.push(Number(limit), Number(skip));

    sql = `
    SELECT
      rgs.*,
      COUNT(rcd.id_regist)::INTEGER AS total
    FROM registscan AS rgs
    LEFT JOIN recordscan AS rcd
      ON rgs.id = rcd.id_regist::uuid 
    WHERE rgs.userid = $1
      ${optionQuery}
    GROUP BY rgs.id, rgs.model, rgs.order_number, rgs.subline,rgs.plan, rgs.po_number
    ORDER BY rgs.timestamps DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    sqlcount = `
    SELECT COUNT(id)::INTEGER FROM registscan AS rgs WHERE userid = $1 ${optionQuery}
    `;
  }

  try {
    const result = await prisma.$queryRawUnsafe(sql, ...params);

    // count query tidak pakai limit/skip -> kirim subset params
    const total = await prisma.$queryRawUnsafe(
      sqlcount,
      ...params.slice(0, params.length - 2),
    );

    const resultIndex = result.map((item, index) => ({
      ...item,
      index: skip + index + 1,
    }));

    res.status(200).json({
      data: resultIndex,
      total: total[0].count,
      currentPage: Number(page),
      totalPages: Math.ceil(total[0].count / limit),
    });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/checkregist", async (req, res) => {
  const iduser = req.headers["iduser"];
  try {
    const result = await prisma.$queryRaw`
      SELECT 
      rgs.id AS id,
      rgs.model AS model,
      rgs.plan AS plan,
      COUNT(rcd.id_regist)::INT AS total
      FROM registscan AS rgs
        LEFT JOIN recordscan AS rcd
        ON rgs.id = rcd.id_regist::uuid
    WHERE rgs.userid = ${iduser}
    GROUP BY rgs.id, rgs.model, rgs.plan
    HAVING rgs.plan > COUNT(rcd.id_regist);
    `;

    res.status(200).json({ data: result });
  } catch (error) {
    // console.log("Handle error checkregist", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/post", async (req, res) => {
  const {
    model,
    order_number,
    po_number,
    subline,
    userid,
    shift,
    plan,
    sn,
    sn_odu,
    sn_motor,
    sn_box,
    pcb_idu,
    sn_carton,
    sn_accessories,
  } = req.body || {};

  if (
    !model ||
    !order_number ||
    !po_number ||
    !subline ||
    !userid ||
    !shift ||
    plan === undefined
  ) {
    return res
      .status(400)
      .json({ error: "model, order_number, po_number, subline, userid, shift, plan wajib diisi" });
  }

  const wajibSN = { sn, sn_odu, pcb_idu, sn_accessories, sn_motor, sn_box };
  const kosong = Object.entries(wajibSN).filter(([, v]) => !v || !String(v).trim());
  if (kosong.length) {
    return res
      .status(400)
      .json({ error: `Wajib diisi: ${kosong.map(([k]) => k).join(", ")}` });
  }

  try {
    const modelOnly = model.slice(0, model.length - 5);

    const od_eng = await prisma.bomlist.findMany({
      where: {
        model: modelOnly.trim(),
        order_number: order_number.trim(),
      },
    });

    if (od_eng <= 0) {
      return res.status(404).json({ error: "Batch tidak ada di bomlist" });
    }

    const planning = Number(plan);
    const result = await prisma.registscan.create({
      data: {
        model: model.trim(),
        order_number: order_number.trim(),
        po_number: po_number.trim(),
        subline: subline.trim(),
        userid,
        shift,
        plan: planning,
        sn: sn ? sn.trim() : null,
        sn_odu: sn_odu ? sn_odu.trim() : null,
        sn_motor: sn_motor ? sn_motor.trim() : null,
        sn_box: sn_box ? sn_box.trim() : null,
        sn_accessories: sn_accessories ? sn_accessories.trim() : null,
        sn_carton: sn_carton ? sn_carton.trim() : null,
        pcb_idu: pcb_idu ? pcb_idu.trim() : null,
      },
    });

    res
      .status(201)
      .json({ message: "Data Added Successfully", result: result });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const {
    model,
    order_number,
    po_number,
    subline,
    shift,
    plan,
    sn,
    sn_odu,
    sn_motor,
    sn_box,
    pcb_idu,
    sn_carton,
    sn_accessories,
  } = req.body || {};

  if (
    !model ||
    !order_number ||
    !po_number ||
    !subline ||
    !shift ||
    plan === undefined
  ) {
    return res
      .status(400)
      .json({ error: "model, order_number, po_number, subline, shift, plan wajib diisi" });
  }

  const wajibSN = { sn, sn_odu, pcb_idu, sn_accessories, sn_motor, sn_box };
  const kosong = Object.entries(wajibSN).filter(([, v]) => !v || !String(v).trim());
  if (kosong.length) {
    return res
      .status(400)
      .json({ error: `Wajib diisi: ${kosong.map(([k]) => k).join(", ")}` });
  }

  try {
    const modelOnly = model.slice(0, model.length - 5);

    const odf = await prisma.bomlist.findMany({
      where: {
        model: modelOnly.trim(),
        order_number: order_number.trim(),
      },
    });

    if (odf <= 0) {
      return res.status(404).json({ error: "Batch tidak ada di bomlist" });
    }

    const planning = Number(plan);
    const result = await prisma.registscan.update({
      where: {
        id: id,
      },
      data: {
        model: model.trim(),
        order_number: order_number.trim(),
        po_number: po_number.trim(),
        subline: subline.trim(),
        shift,
        plan: planning,
        sn: sn ? sn.trim() : null,
        sn_odu: sn_odu ? sn_odu.trim() : null,
        sn_motor: sn_motor ? sn_motor.trim() : null,
        sn_box: sn_box ? sn_box.trim() : null,
        sn_accessories: sn_accessories ? sn_accessories.trim() : null,
        sn_carton: sn_carton ? sn_carton.trim() : null,
        pcb_idu: pcb_idu ? pcb_idu.trim() : null,
      },
    });
    res
      .status(200)
      .json({ message: "data successfully changed", result: result });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await prisma.registscan.delete({
      where: { id },
    });
    res.status(200).json({ message: "Deleted Successfully", result: result });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
