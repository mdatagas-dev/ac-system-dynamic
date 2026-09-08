// Endpoint pelaporan: total scan per PO dan ekspor data ODF/PO (Excel-style).
const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const { hasPermission } = require("../services/permissions");
const ExcelJS = require("exceljs");

const jakartaTime = (value) => value ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "";

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

async function queryDataExport(user, { page = 1, limit = 20, keyword = "" }) {
  const params = [];
  const clauses = [];
  if (!hasPermission(user, "registscan:read")) {
    params.push(user.id);
    clauses.push(`rgs.userid = $${params.length}`);
  }
  if (keyword) {
    params.push(keyword);
    const marker = `$${params.length}`;
    clauses.push(`(${["rgs.model", "rgs.order_number", "rgs.po_number", "rgs.subline", "s.sn", "s.sn_carton", "s.pcb_idu", "s.pcb_odu", "s.sn_motor", "s.sn_accessories", "s.sn_drum", "s.sn_pump"].map((column) => `COALESCE(${column}, '') ILIKE '%' || ${marker} || '%'`).join(" OR ")})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const source = `
    SELECT id, id_regist, sn, sn_carton, pcb_idu, pcb_odu, sn_motor, sn_accessories, NULL::varchar AS sn_drum, NULL::varchar AS sn_pump, timestamps, 'ac'::varchar AS product_category, 'typed'::varchar AS source FROM recordscan_ac
    UNION ALL
    SELECT id, id_regist, sn, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, sn_drum, sn_pump, timestamps, 'wm'::varchar, 'typed'::varchar FROM recordscan_wm
    UNION ALL
    SELECT s.id, s.id_regist::uuid, s.sn, s.sn_carton, s.pcb_idu, NULL::varchar, s.sn_motor, s.sn_accessories, s.components->>'sn_drum', s.components->>'sn_pump', s.timestamps, r.product_category, 'legacy'::varchar
    FROM recordscan s JOIN registscan r ON r.id = s.id_regist::uuid
    WHERE s.id_regist ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND (r.product_category NOT IN ('ac', 'wm') OR r.product_category IS NULL)
  `;
  const base = `FROM (${source}) s JOIN registscan rgs ON rgs.id = s.id_regist ${where}`;
  const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total ${base}`, ...params);
  params.push((page - 1) * limit, limit);
  const data = await prisma.$queryRawUnsafe(`SELECT s.*, rgs.model, rgs.order_number, rgs.po_number, rgs.subline, rgs.plan ${base} ORDER BY s.timestamps DESC OFFSET $${params.length - 1} LIMIT $${params.length}`, ...params);
  return { data, total: Number(countRows[0]?.total ?? 0) };
}

router.get("/data-export", async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const { data, total } = await queryDataExport(req.user, { page, limit, keyword: String(req.query.keyword || "").trim() });
  res.status(200).json({ data, total, currentPage: page, totalPages: Math.ceil(total / limit) });
});

router.get("/data-export.xlsx", async (req, res) => {
  const { data } = await queryDataExport(req.user, { limit: 50000, keyword: String(req.query.keyword || "").trim() });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Production Data");
  sheet.columns = [
    { header: "Waktu Scan", key: "timestamps", width: 22 }, { header: "Kategori", key: "product_category", width: 12 },
    { header: "Model", key: "model", width: 18 }, { header: "Batch", key: "order_number", width: 18 },
    { header: "PO", key: "po_number", width: 18 }, { header: "Line", key: "subline", width: 28 },
  ];
  for (const row of data) sheet.addRow({ ...row, timestamps: jakartaTime(row.timestamps), product_category: ["wm", "washing"].includes(row.product_category) ? "WM" : "AC" });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="data-produksi-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

async function queryOdfPoAll({ model, order_number, po_number, subline }) {
  return prisma.$queryRaw`
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
}
// Kolom sama urutannya dengan ekspor datascan lama (sheetjs allHistory.xlsx).
const ODF_COLUMNS = [
  { header: "registTime", key: "registTime", width: 20 },
  { header: "model", key: "model", width: 18 },
  { header: "po_number", key: "po_number", width: 18 },
  { header: "order_number", key: "order_number", width: 18 },
  { header: "subline", key: "subline", width: 28 },
  { header: "scanTime", key: "scanTime", width: 20 },
  { header: "sn", key: "sn", width: 26 },
  { header: "sn_motor", key: "sn_motor", width: 26 },
  { header: "pcb_idu", key: "pcb_idu", width: 26 },
  { header: "sn_box", key: "sn_box", width: 26 },
  { header: "sn_accessories", key: "sn_accessories", width: 26 },
  { header: "sn_carton", key: "sn_carton", width: 26 },
];
async function sendOdfWorkbook(res, filters, filename) {
  const data = await queryOdfPoAll(filters);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ODF PO");
  sheet.columns = ODF_COLUMNS;
  for (const row of data) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}
router.get("/export-odf-po-all.xlsx", async (req, res) => {
  const { model, order_number, po_number, subline } = req.query;
  await sendOdfWorkbook(res, { model, order_number, po_number, subline }, `allHistory-${new Date().toISOString().slice(0, 10)}.xlsx`);
});
router.get("/export-odf-po-all", async (req, res) => {
  const { model, order_number, po_number, subline } = req.query;
  const result = await queryOdfPoAll({ model, order_number, po_number, subline });
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