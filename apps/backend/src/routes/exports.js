// Endpoint pelaporan: total scan per PO dan ekspor data ODF/PO (Excel-style).
const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

router.get("/total-po-scan", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const whereClause = keyword
    ? "WHERE rcd.sn = $1 OR rgs.order_number = $1 OR rgs.po_number = $1 OR rgs.model = $1 OR rgs.subline = $1"
    : "";
  const countWhereClause = keyword
    ? "WHERE rgs.order_number = $1 OR rgs.po_number = $1 OR rgs.model = $1 OR rgs.subline = $1"
    : "";
  const params = keyword ? [keyword] : [];

  const result = await prisma.$queryRawUnsafe(
    `
      SELECT
        rgs.model,
        rgs.order_number,
        rgs.po_number,
        rgs.subline,
        COUNT(rgs.subline)::int AS countsubline
      FROM recordscan_all AS rcd
      JOIN registscan AS rgs
        ON rcd.id_regist::uuid = rgs.id
      ${whereClause}
      GROUP BY rgs.model, rgs.subline, rgs.po_number, rgs.order_number
      OFFSET $${params.length + 1} LIMIT $${params.length + 2}
    `,
    ...params,
    skip,
    Number(limit),
  );

  const count = await prisma.$queryRawUnsafe(
    `
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT 1
        FROM recordscan_all AS rcd
        JOIN registscan AS rgs
          ON rcd.id_regist::uuid = rgs.id
        ${countWhereClause}
        GROUP BY rgs.model, rgs.subline, rgs.po_number, rgs.order_number
      ) AS subquery
    `,
    ...params,
  );

  const total = Number(count[0]?.total ?? 0);
  const resultIndex = result.map((item, index) => ({
    ...item,
    index: skip + index + 1,
  }));

  res.status(200).json({
    data: resultIndex,
    total: Number(total),
    currentPages: Number(page),
    totalPages: Math.ceil(total / limit),
  });
});

router.get("/export-odf-po-all", async (req, res) => {
  const { model, order_number, po_number, subline } = req.query;

  const result = await prisma.$queryRaw`
  SELECT 
	TO_CHAR(
	    (rgs.timestamps AT TIME ZONE 'Asia/Jakarta'),
	    'HH24:MI:ss DD-MM-YYYY'
  	) AS registTime,
	rgs.model,
	rgs.po_number,
	rgs.order_number,
	rgs.subline,
	TO_CHAR(
	    (rcd.timestamps AT TIME ZONE 'Asia/Jakarta'),
	    'HH24:MI:ss DD-MM-YYYY'
  	) AS scanTime,
	rcd.sn,
	rcd.sn_motor,
	rcd.pcb_idu,
	rcd.sn_box,
	rcd.sn_accessories,
	rcd.sn_carton
  FROM recordscan_all AS rcd
  JOIN registscan AS rgs
    ON rcd.id_regist::uuid = rgs.id
  WHERE rgs.model = ${model}
    AND (${order_number}::text IS NULL OR rgs.order_number = ${order_number})
    AND (${po_number}::text IS NULL OR rgs.po_number = ${po_number})
    AND (${subline}::text IS NULL OR rgs.subline = ${subline});
`;

  res.status(200).json({ data: result });
});

router.get("/export-odf-po-detail/", async (req, res) => {
  const { order_number, po_number, subline, model } = req.query;

  const result = await prisma.$queryRaw`
          SELECT 
			rgs.timestamps,
          rgs.model,
          rgs.order_number,
          rgs.po_number,
          rgs.subline,
          COUNT(rgs.subline)::int AS countsubline
        FROM recordscan_all AS rcd
        JOIN registscan AS rgs
        ON rcd.id_regist::uuid = rgs.id
        WHERE rgs.model = ${model} 
          AND (${order_number}::text IS NULL OR rgs.order_number = ${order_number})
          AND (${po_number}::text IS NULL OR rgs.po_number = ${po_number})
          AND (${subline}::text IS NULL OR rgs.subline = ${subline})
        GROUP BY rgs.id,rgs.model, rgs.subline, rgs.po_number, rgs.order_number
    `;

  res.status(200).json({ data: result });
});

module.exports = router;