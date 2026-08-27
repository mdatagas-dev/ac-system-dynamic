const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const {
  missingRequired,
  findBomMismatch,
  unknownKeys,
  ruleFields,
} = require("../rules/bom-match");
const { stripBrandSuffix } = require("../rules/model-code");
const { hasPermission } = require("../services/permissions");
const requirePermission = require("../../middlewares/requirePermission");
const { assertCanAccessRegistration } = require("../services/registration-access");

const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

router.get("/", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  let params = [];
  let optionQuery = "";
  let sql = "";
  let sqlcount = "";
  const isSuperuser = hasPermission(req.user, "registscan:read");

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

router.post("/post", requirePermission("registscan:write"), async (req, res) => {
  const {
    model,
    order_number,
    po_number,
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
    !userid ||
    !shift ||
    plan === undefined
  ) {
    return res
      .status(400)
      .json({ error: "model, order_number, po_number, userid, shift, plan wajib diisi" });
  }

  // subline otomatis dari section user (fallback ke body untuk kompatibilitas)
  const subline = (req.body.subline ?? req.user?.section ?? "").toString().trim();
  if (!subline) {
    return res.status(400).json({ error: "subline wajib diisi (isi section pada user)" });
  }

  // validasi mengikuti BOM rule (satu baris per model+order_number)
  const product_category = (req.body.product_category || req.body.productCategory || "").toString().trim().toLowerCase() || null;

  try {
    const modelOnly = stripBrandSuffix(String(model).trim());

    const od_eng = await prisma.bomlist.findFirst({
      where: {
        model: modelOnly,
        order_number: order_number.trim(),
        is_active: true,
      },
    });

    if (!od_eng) {
      return res.status(404).json({ error: "Batch tidak ada di bomlist" });
    }

    const missing = missingRequired(od_eng, req.body);
    if (missing) {
      return res.status(400).json({ error: `Wajib diisi: ${missing.label}` });
    }

    const mismatch = findBomMismatch(od_eng, req.body);
    if (mismatch) {
      return res.status(400).json({
        error: `${mismatch.key} tidak sesuai BOM (diharapkan mengandung: ${mismatch.expected})`,
      });
    }

    const unknown = unknownKeys(od_eng, req.body);
    if (unknown.length) {
      return res.status(400).json({ error: `Field tidak dikenal BOM: ${unknown.join(", ")}` });
    }

    const planning = Number(plan);
    // components JSONB = nilai field dinamis yang dideklarasikan BOM
    const declared = ruleFields(od_eng);
    const componentsData = {};
    for (const f of declared) {
      const val = req.body[f.key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        componentsData[f.key] = String(val).trim();
      }
    }

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
        product_category: product_category || null,
        components: Object.keys(componentsData).length ? componentsData : null,
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

router.put("/edit/:id", requirePermission("registscan:write"), async (req, res) => {
  const { id } = req.params;
  const {
    model,
    order_number,
    po_number,
    shift,
    plan,
    sn,
    sn_odu,
    sn_motor,
    sn_box,
    pcb_idu,
    sn_carton,
    sn_accessories,
    product_category,
  } = req.body || {};

  if (
    !model ||
    !order_number ||
    !po_number ||
    !shift ||
    plan === undefined
  ) {
    return res
      .status(400)
      .json({ error: "model, order_number, po_number, shift, plan wajib diisi" });
  }

  // subline otomatis dari section user (fallback ke body untuk kompatibilitas)
  const subline = (req.body.subline ?? req.user?.section ?? "").toString().trim();
  if (!subline) {
    return res.status(400).json({ error: "subline wajib diisi (isi section pada user)" });
  }

  const prodCat2 = (product_category || "").toString().trim().toLowerCase() || null;

  try {
    // akses: pemilik registrasi (atau superuser)
    const existingReg = await prisma.registscan.findUnique({ where: { id } });
    assertCanAccessRegistration(req.user, existingReg);

    const modelOnly = stripBrandSuffix(String(model).trim());
    const odf = await prisma.bomlist.findFirst({
      where: {
        model: modelOnly,
        order_number: order_number.trim(),
        is_active: true,
      },
    });

    if (!odf) {
      return res.status(404).json({ error: "Batch tidak ada di bomlist" });
    }

    const missing = missingRequired(odf, req.body);
    if (missing) {
      return res.status(400).json({ error: `Wajib diisi: ${missing.label}` });
    }

    const mismatch = findBomMismatch(odf, req.body);
    if (mismatch) {
      return res.status(400).json({
        error: `${mismatch.key} tidak sesuai BOM (diharapkan mengandung: ${mismatch.expected})`,
      });
    }

    const unknown = unknownKeys(odf, req.body);
    if (unknown.length) {
      return res.status(400).json({ error: `Field tidak dikenal BOM: ${unknown.join(", ")}` });
    }

    const planning = Number(plan);
    const declared = ruleFields(odf);
    const componentsData2 = {};
    for (const f of declared) {
      const val = req.body[f.key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        componentsData2[f.key] = String(val).trim();
      }
    }
    const result = await prisma.registscan.update({
      where: { id: id },
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
        product_category: product_category ? product_category.trim().toLowerCase() : undefined,
        components: Object.keys(componentsData2).length ? componentsData2 : undefined,
      },
    });
    res
      .status(200)
      .json({ message: "data successfully changed", result: result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Internal Server Error" });
  }
});

router.delete("/delete/:id", requirePermission("registscan:write"), async (req, res) => {
  const { id } = req.params;
  try {
    // akses: pemilik registrasi (atau superuser)
    const existingReg = await prisma.registscan.findUnique({ where: { id } });
    assertCanAccessRegistration(req.user, existingReg);
    const result = await prisma.$transaction([
      prisma.recordscan.deleteMany({ where: { id_regist: id } }),
      prisma.registscan.delete({ where: { id } }),
    ]);
    res.status(200).json({ message: "Deleted Successfully", result: result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Internal Server Error" });
  }
});

module.exports = router;
