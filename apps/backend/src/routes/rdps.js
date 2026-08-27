const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");

const dotenv = require("dotenv");
const path = require("path");
const redis = require("../config/redis");
const { findBomMismatch } = require("../rules/bom-match");
const { stripBrandSuffix } = require("../rules/model-code");
const requirePermission = require("../../middlewares/requirePermission");
const { assertCanAccessRegistration } = require("../services/registration-access");
const AppError = require("../../lib/AppError");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

router.get("/scan", async (req, res) => {
  const idRegist = req.headers.idregist;

  if (idRegist === undefined || idRegist === null || !idRegist) {
    return res.status(404).json({ error: "tidak ada id regist" });
  }

  try {
    // validasi dari regist
    const resRegistScan = await prisma.registscan.findFirst({
      where: {
        id: idRegist,
      },
    });

    if (!resRegistScan) {
      return res.status(404).json({ error: "regist tidak ditemukan" });
    }

    // menghitung total scan
    const resRecordScanCount = await prisma.recordscan.count({
      where: {
        id_regist: idRegist,
      },
    });

    // scan terakhir
    const resRecordScanLast = await prisma.recordscan.findFirst({
      where: {
        id_regist: idRegist,
      },
      orderBy: {
        timestamps: "desc",
      },
    });

    const modelOnly = resRegistScan.model.slice(
      0,
      resRegistScan.model.length - 5,
    );

    const resBomlist = await prisma.bomlist.findMany({
      where: {
        model: modelOnly.trim(),
        order_number: resRegistScan.order_number.trim(),
        is_active: true,
      },
    });

    const cleanBomlist = resBomlist.map((item) => {
      const filterd = {};
      for (const key in item) {
        const value = item[key];
        if (value !== "" && value !== null && value !== undefined) {
          filterd[key] = value;
        }
      }
      return filterd;
    });

    res.status(200).json({
      validation: resRegistScan,
      total: resRecordScanCount,
      last: resRecordScanLast,
      bomlist: cleanBomlist,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/dashboard", async (req, res) => {
  const { keyword } = req.query;

  function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const now = new Date();

  // Hari ini (lokal)
  let todayStr = formatDateLocal(now);
  // Kemarin (lokal)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateLocal(yesterday);

  let hour = now.getHours();
  yesterday.setDate(now.getDate() - 1);

  // shift branch + tanggal menentukan hasil query — sertakan dalam key
  const cacheKey = `dashboardUphAC:${todayStr}:${hour}:${keyword}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    return res.status(200).json(JSON.parse(cached));
  }

  let query;
  let params = [];
  let whereClause1 = ``;
  let whereClause2 = ``;
  let whereClause3 = ``;

  if (keyword) {
    params.push(keyword);
    whereClause1 = `
    aln.line = UPPER($1) AND
    rgs.shift = '1'
    AND rgs.timestamps::date = '${todayStr}'::date`;

    whereClause2 = `
  	aln.line = UPPER($1)
	AND
	(rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = '${todayStr}'::date
	AND
  ( 
	  ( rgs.shift = '1' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 7 )
	  OR
	  (rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 16 )
  )
    `;

    whereClause3 = `
  rgs.subline = $1
	AND
  ( 
    ( 
      rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 16 
    AND
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = '${yesterdayStr}'::date 
    )
      OR
    (
        rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 0 
      AND
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = '${todayStr}'::date
    )
  )
    `;
  } else {
    whereClause1 = `
    rgs.shift = '1'
    AND rgs.timestamps::date = '${todayStr}'::date`;

    whereClause2 = `
	(rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = '${todayStr}'::date
	AND
  ( 
	  ( rgs.shift = '1' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 7 )
	  OR
	  (rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 16 )
  )
    `;

    whereClause3 = `
    ( 
      rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 16 
    AND
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = '${yesterdayStr}'::date 
    )
      OR
    (
        rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 0 
      AND
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = '${todayStr}'::date
    )
    `;
  }

  try {
    let subline;
    if (hour >= 7 && hour < 16) {
      subline = await prisma.$queryRaw`
    SELECT 
      rgs.subline
      FROM registscan AS rgs
      JOIN recordscan AS rcs 
      ON rgs.id = rcs.id_regist::uuid
    WHERE 
      rgs.shift = '1'
      AND rgs.timestamps::date = ${todayStr}::date
    GROUP BY rgs.subline
      `;

      query = `
        SELECT 
          suph.uph AS suph,
          rgs.subline,
          rgs.model,
            DATE_TRUNC('hour', rcs.timestamps) AS jam,
            COUNT(*)::INT AS total
        FROM registscan AS rgs
        JOIN recordscan AS rcs 
            ON rgs.id = rcs.id_regist::uuid
        JOIN model AS mdl
          ON rgs.model ILIKE mdl.model || '%'
        JOIN line AS aln
          ON aln.line ILIKE rgs.subline
        LEFT JOIN (
          SELECT DISTINCT model, line, uph
          FROM uph
        ) AS suph
        ON suph.model = mdl.id
        AND suph.line = aln.id
        WHERE
            ${whereClause1}
        GROUP BY rgs.model, jam, rgs.subline, suph.uph
        ORDER BY jam, rgs.model, rgs.subline;
  `;
    } else if (hour >= 16) {
      subline = await prisma.$queryRaw`
    SELECT 
      rgs.subline
      FROM registscan AS rgs
      JOIN recordscan AS rcs 
      ON rgs.id = rcs.id_regist::uuid
    WHERE 
    (
      rgs.shift = '1' OR rgs.shift = '2'
    )
    AND rgs.timestamps::date = ${todayStr}::date
    GROUP BY rgs.subline
    `;
      query = `
        SELECT 
          suph.uph AS suph,
          rgs.subline,
          rgs.model,
            DATE_TRUNC('hour', rcs.timestamps) AS jam,
            COUNT(*)::INT AS total
        FROM registscan AS rgs
        JOIN recordscan AS rcs 
            ON rgs.id = rcs.id_regist::uuid
        JOIN model AS mdl
          ON rgs.model ILIKE mdl.model || '%'
        JOIN line AS aln
          ON aln.line ILIKE rgs.subline
        LEFT JOIN (
          SELECT DISTINCT model, line, uph
          FROM uph
        ) AS suph
        ON suph.model = mdl.id
        AND suph.line = aln.id
        WHERE
            ${whereClause2}
        GROUP BY rgs.model, jam, rgs.subline, suph.uph
        ORDER BY jam, rgs.model, rgs.subline;
        `;
    } else {
      subline = await prisma.$queryRaw`
    SELECT 
      rgs.subline
      FROM registscan AS rgs
      JOIN recordscan AS rcs 
      ON rgs.id = rcs.id_regist::uuid
    WHERE 
    ( 
      rgs.shift = '2'
      AND rgs.timestamps::date = ${todayStr}::date
    )
    OR 
    (
      rgs.shift = '2' 
      AND rgs.timestamps::date = ${yesterdayStr}::date 
      AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 16
    )
    GROUP BY rgs.subline
      `;

      query = `
        SELECT 
          suph.uph AS suph,
          rgs.subline,
          rgs.model,
            DATE_TRUNC('hour', rcs.timestamps) AS jam,
            COUNT(*)::INT AS total
        FROM registscan AS rgs
        JOIN recordscan AS rcs 
            ON rgs.id = rcs.id_regist::uuid
        JOIN model AS mdl
          ON rgs.model ILIKE mdl.model || '%'
        JOIN line AS aln
          ON aln.line ILIKE rgs.subline
        LEFT JOIN (
          SELECT DISTINCT model, line, uph
          FROM uph
        ) AS suph
        ON suph.model = mdl.id
        AND suph.line = aln.id
        WHERE
            ${whereClause3}
        GROUP BY rgs.model, jam, rgs.subline, suph.uph
        ORDER BY jam, rgs.model, rgs.subline;
  `;
    }

    // use dinamis query for queryRawUnsafe
    const result = await prisma.$queryRawUnsafe(query, ...params);
    // function filter from data uph
    const validUph = [
      { start: 7, end: 8, time: 7 },
      { start: 8, end: 9, time: 8 },
      { start: 9, end: 10, time: 9 },
      { start: 10, end: 11, time: 10 },
      { start: 11, end: 12, time: 11 },
      { start: 12, end: 13, time: 12 },
      { start: 13, end: 14, time: 13 },
      { start: 14, end: 15, time: 14 },
      { start: 15, end: 16, time: 15 },
      { start: 16, end: 17, time: 16 },
      { start: 17, end: 18, time: 17 },
      { start: 18, end: 19, time: 18 },
      { start: 19, end: 20, time: 19 },
      { start: 20, end: 21, time: 20 },
      { start: 21, end: 22, time: 21 },
      { start: 22, end: 23, time: 22 },
      { start: 23, end: 24, time: 23 },
      { start: 0, end: 1, time: 24 },
      { start: 1, end: 2, time: 1 },
      { start: 2, end: 3, time: 2 },
      { start: 3, end: 4, time: 3 },
      { start: 4, end: 5, time: 4 },
      { start: 5, end: 6, time: 5 },
      { start: 6, end: 7, time: 6 },
    ];

    const grouped = result.reduce((acc, { suph, model, jam, total }) => {
      const hour = new Date(jam).getHours();

      // kalau model belum ada di acc, inisialisasi
      if (!acc[model]) {
        acc[model] = { suph: suph, total: 0 };
      }

      // tambahkan per jam
      acc[model][hour] = (acc[model][hour] || 0) + total;

      // tambahkan total keseluruhan
      acc[model].total += total;

      return acc;
    }, {});

    const outputs = Object.entries(grouped).map(([model, uphRecords]) => {
      const uph = validUph.map(({ time }) => ({
        time,
        record: String(uphRecords[time] || 0),
      }));
      return {
        model: model,
        uph,
        suph: uphRecords.suph,
        total: uphRecords.total || 0,
      };
    });

    const reverseOutputs = outputs.reverse();

    const finishResult = {
      data: reverseOutputs,
      subline,
    };

    await redis.set(cacheKey, JSON.stringify(finishResult), { EX: 60 });
    res.status(200).json(finishResult);
  } catch (error) {
    // console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/history", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;

  const idRegist = req.headers.idregist;

  const role = req.user.roleuser;

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      keyword,
    );

  const where = keyword
    ? {
        AND: [
          { id_regist: { contains: idRegist, mode: "insensitive" } },
          {
            OR: [
              isUUID ? { id: { equals: keyword } } : undefined,
              { sn: { contains: keyword, mode: "insensitive" } },
              { sn_carton: { contains: keyword, mode: "insensitive" } },
              { pcb_idu: { contains: keyword, mode: "insensitive" } },
              { sn_box: { contains: keyword, mode: "insensitive" } },
              { sn_motor: { contains: keyword, mode: "insensitive" } },
              { sn_accessories: { contains: keyword, mode: "insensitive" } },
            ].filter(Boolean),
          },
        ],
      }
    : {
        AND: [
          { id_regist: { contains: idRegist, mode: "insensitive" } },
          {
            OR: [
              isUUID ? { id: { equals: keyword } } : undefined,
              { sn: { contains: keyword, mode: "insensitive" } },
              { sn_carton: { contains: keyword, mode: "insensitive" } },
              { pcb_idu: { contains: keyword, mode: "insensitive" } },
              { sn_box: { contains: keyword, mode: "insensitive" } },
              { sn_motor: { contains: keyword, mode: "insensitive" } },
              { sn_accessories: { contains: keyword, mode: "insensitive" } },
            ].filter(Boolean),
          },
        ],
      };

  const queryOptions = {
    where,
    orderBy: {
      timestamps: "desc",
    },
  };

  if (limit) {
    const skip = (Number(page) - 1) * Number(limit);
    queryOptions.skip = skip;
    queryOptions.take = Number(limit);
  }

  const total = await prisma.recordscan.count({ where });
  const result = await prisma.recordscan.findMany(queryOptions);
  const resultRegist = await prisma.registscan.findFirst({
    where: {
      id: idRegist,
    },
  });

  return res.status(200).json({
    data: result,
    validation: resultRegist,
    currentPages: Number(page),
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/post", requirePermission("scan:write"), async (req, res) => {
  const { id_regist, pn_carton, ...searchField } = req.body;

  // validasi SN mengandung karakter unik
  if (/[%$#@!%*^]/.test(searchField.sn)) {
    return res
      .status(400)
      .json({ error: "SN mengandung karakter tidak valid" });
  }

  try {
    // check subline is packing
    let marge = {};
    let brandtv = "";
    let valueRegist = null;

    const txResult = await prisma.$transaction(async (tx) => {
      // query 1
      await tx.$queryRaw`
      SELECT * FROM "recordscan"
      WHERE "id_regist" = ${id_regist}
      FOR UPDATE
    `;

      // get regist
      valueRegist = await tx.registscan.findUnique({
        where: {
          id: id_regist,
        },
      });

      // akses: pemilik registrasi (atau superuser); 404 bila tidak ada
      assertCanAccessRegistration(req.user, valueRegist);

      // BOM check: nilai yang di-scan harus mengikuti BOM rule batch ini
      const bomRule = await tx.bomlist.findFirst({
        where: {
          model: stripBrandSuffix(String(valueRegist.model).trim()),
          order_number: valueRegist.order_number.trim(),
          is_active: true,
        },
      });
      if (!bomRule) {
        throw Object.assign(new Error("Batch tidak ada di bomlist"), { status: 404 });
      }
      const scanMismatch = findBomMismatch(bomRule, searchField);
      if (scanMismatch) {
        throw Object.assign(
          new Error(`${scanMismatch.key} tidak sesuai BOM (diharapkan mengandung: ${scanMismatch.expected})`),
          { status: 400 },
        );
      }

      brandtv = await tx.model.findFirst({
        where: {
          model: valueRegist.model,
        },
      });

      // console.log("sn yang di terima: ", searchField.sn.trim().toUpperCase());
      //get subline from sn
      const allSubline = await tx.$queryRaw`
        SELECT rgs.subline, rcs.sn
        FROM registscan AS rgs
        JOIN recordscan AS rcs
        ON rgs.id = rcs.id_regist::uuid
        WHERE rcs.sn = ${searchField.sn.trim().toUpperCase()}
      `;

      // get line from regist scan
      let isLine = valueRegist.subline.toUpperCase();
      const throwBadRequest = (message) => {
        const err = new Error(message);
        err.status = 400;
        throw err;
      };

      // check double scan per subline
      const checkDoubleScan = (lineList) => {
        if (
          isLine.toUpperCase().includes(lineList) && // check if the current line is the same as the lineList
          allSubline.some((e) => e.subline.toUpperCase().includes(lineList)) // check if the lineList exists in the scanned sublines
        ) {
          const found = allSubline.find((e) =>
            e.subline.toUpperCase().includes(lineList),
          );
          throwBadRequest("Double Scan di " + (found?.subline || lineList));
        }
      };

      checkDoubleScan(valueRegist.subline.toUpperCase());

      // Rule: SN harus di-scan di INPUT dulu sebelum bisa di-scan di OUTPUT line yang sama.
      // Pengecualian PACKING OUTPUT (line terminal) - sudah dicek lewat checkMissedScan semua stage.
      const subUpper = valueRegist.subline.toUpperCase().trim();
      if (
        subUpper.endsWith("OUTPUT") &&
        !subUpper.includes("PACKING OUTPUT")
      ) {
        const inputStage = subUpper.replace(/OUTPUT$/, "INPUT").trim();
        const scannedInput = allSubline.some((e) =>
          e.subline.toUpperCase().includes(inputStage),
        );
        if (!scannedInput) {
          throwBadRequest(`unit belum di-scan di ${inputStage} - scan input dulu sebelum output`);
        }
      }

      // jika user regist adalah packing
      if (valueRegist.subline.toUpperCase().includes("PACKING OUTPUT")) {
        // search order number & model on registscan
        const searchRegist = await tx.registscan.findMany({
          select: {
            subline: true,
            model: true,
            po_number: true,
            order_number: true,
          },
          where: {
            order_number: valueRegist.order_number,
            model: valueRegist.model,
            po_number: valueRegist.po_number,
          },
        });

        // cek apakah unit terlewat di line sebelumnya

        // cari uniq dari subline by order number, model, po number dan cek apakah salah satu subline tidak ada sn
        // jika uniq yang di ambil malah uniq yang tidak ada sn dan yang tidak di ambil malah mengandung sn
        const checkMissedScan = (lineList) => {
          // diambil dari table regis, apakah lineList ada di subline regist

          // allSubline di ambil dari table regis join recordscan berdasarkan sn yang di scan

          if (
            searchRegist.some(
              (e) => e.subline.toUpperCase().includes(lineList), // false
            ) &&
            !allSubline.some((e) => e.subline.toUpperCase().includes(lineList))
          ) {
            throwBadRequest(`unit terlewat scan kembali di ${lineList}`);
          }
        };

        checkMissedScan("LINE IDU ASSY INPUT");
        checkMissedScan("LINE IDU ASSY OUTPUT");
        checkMissedScan("LINE ODU ASSY INPUT");
        checkMissedScan("LINE ODU ASSY OUTPUT");
        checkMissedScan("LINE IDU TESTING INPUT");
        checkMissedScan("LINE IDU TESTING OUTPUT");
        checkMissedScan("LINE ODU TESTING INPUT");
        checkMissedScan("LINE ODU TESTING OUTPUT");
        checkMissedScan("LINE IDU PACKING INPUT");
        checkMissedScan("LINE ODU PACKING INPUT");

        // mencari mainboard, panel2, atau bplane berdasarkan sn tertentu
        const materialCheck = await tx.recordscan.findMany({
          where: {
            sn: { equals: searchField.sn, mode: "insensitive" },
            OR: [
              { sn_carton: { not: null } },
              { pcb_idu: { not: null } },
              { sn_box: { not: null } },
              { sn_motor: { not: null } },
              { sn_accessories: { not: null } },
            ],
          },
        });

        // join array
        marge = materialCheck.reduce((acc, item) => {
          for (const key in item) {
            if ((!acc[key] || acc[key] === "") && item[key]) {
              acc[key] = item[key];
            }
          }
          return acc;
        }, {});
      }

      const knownScanCols = new Set(["sn","sn_odu","sn_carton","pcb_idu","sn_box","sn_motor","sn_accessories"]);
      const optionWhere = [].filter(Boolean);
      // check scan result — hanya kolom known, komponen dinamis skip (cek via JSONB tidak didukung di findMany contains, skip untuk MVP)
      for (let key in searchField) {
        const value = searchField[key];
        if (value !== undefined && value !== null && value !== "") {
          if (!knownScanCols.has(key)) continue;
          // push when has value
          optionWhere.push({
            [key]: { contains: value, mode: "insensitive" },
          });
        }
      }
      if (optionWhere.length === 0) {
        // jika hanya komponen dinamis (mis. washing sn_drum), jangan gagal — buat dummy yang tidak match
        optionWhere.push({ sn: { contains: "__no_match__" } });
      }

      // query 2 cek double sn by po
      const checkSN = await tx.recordscan.findMany({
        where: {
          AND: [
            { id_regist: { contains: id_regist, mode: "insensitive" } },
            {
              OR: optionWhere,
            },
          ],
        },
      });

      // check double sn material
      if (checkSN.length > 0) {
        let sameValue = "";
        for (let key in searchField) {
          const value = searchField[key];

          if (
            value === checkSN[0][key] &&
            value !== undefined &&
            value !== "" &&
            value !== null
          ) {
            sameValue = [key];
          }
        }
        throwBadRequest(`Double scan ${sameValue} di satu regist`);
      }

      // compare akurasi berdasarkan regist dan scan
      for (let key in searchField) {
        const value = searchField[key];
        if (value !== undefined && value !== null && value !== "") {
          const regist = valueRegist[key];
          if (
            regist === undefined ||
            regist === null ||
            regist === ""
          ) {
            continue;
          }
          const minLength = Math.min(regist.length, value.length);
          let sameWord = [];
          // looping per word find same per word
          for (let i = 0; i < minLength; i++) {
            if (regist[i] === value[i]) {
              sameWord.push(value[i]);
            }
          }
          const accuration = sameWord.length / regist.length;
          if (accuration * 100 <= 5) {
            throwBadRequest(
              `Akurasi scan tidak sama butuh lebih 50%, akurasi ${key}:  ${(
                accuration * 100
              ).toFixed(2)}%`,
            );
          }
        }
      }

      // query 3 — support dynamic components + product_category
      const knownKeys = new Set(["sn","sn_odu","sn_carton","pcb_idu","sn_box","sn_motor","sn_accessories","product_category","productCategory","components"]);
      const dynComp = {};
      for (const k of Object.keys(searchField)) {
        if (!knownKeys.has(k) && searchField[k]) dynComp[k] = String(searchField[k]).toUpperCase();
      }
      if (searchField.components && typeof searchField.components === "object") {
        for (const [k,v] of Object.entries(searchField.components)) if (v) dynComp[k] = String(v).toUpperCase();
      }
      const prodCat = (searchField.product_category || searchField.productCategory || valueRegist.product_category || "").toString().toLowerCase() || null;
      const created = await tx.recordscan.create({
        data: {
          id_regist: id_regist,
          sn: (searchField.sn || "").toUpperCase(),
          sn_odu: (searchField.sn_odu || "").toUpperCase(),
          sn_carton: (searchField.sn_carton || "").toUpperCase(),
          pcb_idu: (searchField.pcb_idu || "").toUpperCase(),
          sn_box: (searchField.sn_box || "").toUpperCase(),
          sn_motor: (searchField.sn_motor || "").toUpperCase(),
          sn_accessories: (searchField.sn_accessories || "").toUpperCase(),
          product_category: prodCat,
          components: Object.keys(dynComp).length ? dynComp : null,
        },
      });

      return {
        unit: marge,
        brand: brandtv ? brandtv.brand : null,
        po: valueRegist.po_number,
        odf: valueRegist.order_number,
        model: valueRegist.model,
        created,
      };
    });

    return res.status(201).json({
      message: "Data Added Successfully",
      data: txResult.created,
      unit: txResult.unit,
      brand: txResult.brand,
      po: txResult.po,
      odf: txResult.odf,
      model: txResult.model,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
    });
  }
});

// Bulk import scan (admin) — baris divalidasi BOM rule batch, lalu di-insert.
router.post("/import", requirePermission("registscan:import-sn"), async (req, res) => {
  const { id_regist, rows } = req.body || {};

  if (!id_regist || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "id_regist dan rows wajib diisi" });
  }
  if (rows.length > 5000) {
    return res.status(400).json({ error: "Maksimal 5000 baris" });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT * FROM "recordscan" WHERE "id_regist" = ${id_regist} FOR UPDATE`;
      const valueRegist = await tx.registscan.findUnique({ where: { id: id_regist } });
      assertCanAccessRegistration(req.user, valueRegist);

      const bomRule = await tx.bomlist.findFirst({
        where: {
          model: stripBrandSuffix(String(valueRegist.model).trim()),
          order_number: valueRegist.order_number.trim(),
          is_active: true,
        },
      });
      if (!bomRule) throw new AppError("Batch tidak ada di bomlist", 404, "BOMLIST_NOT_FOUND");

      const KNOWN = new Set([
        "id_regist", "sn", "sn_odu", "sn_carton", "pcb_idu", "sn_box",
        "sn_motor", "sn_accessories", "product_category", "productCategory", "components",
      ]);
      let count = 0;
      for (const row of rows) {
        const mismatch = findBomMismatch(bomRule, row);
        if (mismatch) {
          throw new AppError(
            `baris ${row.sn || "-"}: ${mismatch.key} tidak sesuai BOM (diharapkan mengandung: ${mismatch.expected})`,
            400,
            "BOM_MISMATCH",
          );
        }
        const dynComp = {};
        for (const k of Object.keys(row)) {
          if (!KNOWN.has(k) && row[k]) dynComp[k] = String(row[k]).toUpperCase();
        }
        if (row.components && typeof row.components === "object") {
          for (const [k, v] of Object.entries(row.components)) if (v) dynComp[k] = String(v).toUpperCase();
        }
        const prodCat = (row.product_category || row.productCategory || "").toString().toLowerCase() || null;
        await tx.recordscan.create({
          data: {
            id_regist,
            sn: (row.sn || "").toUpperCase(),
            sn_odu: (row.sn_odu || "").toUpperCase(),
            sn_carton: (row.sn_carton || "").toUpperCase(),
            pcb_idu: (row.pcb_idu || "").toUpperCase(),
            sn_box: (row.sn_box || "").toUpperCase(),
            sn_motor: (row.sn_motor || "").toUpperCase(),
            sn_accessories: (row.sn_accessories || "").toUpperCase(),
            product_category: prodCat,
            components: Object.keys(dynComp).length ? dynComp : null,
          },
        });
        count++;
      }
      return count;
    });

    return res.status(201).json({ message: `Imported ${created} rows`, created });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      ...(err.code ? { code: err.code } : {}),
    });
  }
});

router.put("/edit/:id", requirePermission("scan:write"), async (req, res) => {
  const { id } = req.params;
  const { id_regist, sn, ...handleRequest } = req.body;
  const optionWhere = [].filter(Boolean);

  for (let key in handleRequest) {
    const value = handleRequest[key];
    if (value !== undefined && value !== null && value !== "") {
      optionWhere.push({ [key]: { equals: value } });
    }
  }

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const excludeConditions = [];
  if (isUUID) {
    excludeConditions.push({ id: { equals: id } });
  }
  excludeConditions.push({ sn: { contains: sn, mode: "insensitive" } });

  const checkUnit = await prisma.recordscan.findMany({
    where: {
      NOT: excludeConditions,
      OR: optionWhere,
    },
  });

  if (checkUnit.length > 0) {
    return res.status(400).json({ error: "Double scan di satu regist" });
  }
  try {
    // akses: pemilik registrasi (atau superuser)
    const record = await prisma.recordscan.findUnique({ where: { id } });
    if (!record) {
      return res.status(404).json({ error: "Record tidak ditemukan" });
    }
    const reg = await prisma.registscan.findUnique({ where: { id: record.id_regist } });
    assertCanAccessRegistration(req.user, reg);
    const dynUpdate = {};
    const knownKnown = new Set(["sn_odu","sn_motor","pcb_idu","sn_box","sn_accessories","sn_carton","product_category","productCategory","components"]);
    for (const k of Object.keys(handleRequest)) {
      if (!knownKnown.has(k) && handleRequest[k] != null) dynUpdate[k] = String(handleRequest[k]).toUpperCase();
    }
    if (handleRequest.components && typeof handleRequest.components === "object") Object.assign(dynUpdate, handleRequest.components);
    const result = await prisma.recordscan.update({
      where: { id: id },
      data: {
        sn: sn,
        sn_odu: handleRequest.sn_odu,
        sn_motor: handleRequest.sn_motor,
        pcb_idu: handleRequest.pcb_idu,
        sn_box: handleRequest.sn_box,
        sn_accessories: handleRequest.sn_accessories,
        sn_carton: handleRequest.sn_carton,
        ...(handleRequest.product_category || handleRequest.productCategory ? { product_category: String(handleRequest.product_category || handleRequest.productCategory).toLowerCase() } : {}),
        ...(Object.keys(dynUpdate).length ? { components: dynUpdate } : {}),
      },
    });
    res.status(200).json({ message: "data update successful", data: result });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Internal Server Error" });
  }
});

router.delete("/delete/:id", requirePermission("scan:write"), async (req, res) => {
  const { id } = req.params;

  try {
    const check = await prisma.recordscan.findFirst({
      where: {
        id: id,
      },
    });

    if (!check || Object.keys(check).length < 1) {
      res.status(401).json({ error: "Id tidak terbaca di server" });
    } else {
      // akses: pemilik registrasi (atau superuser)
      const reg = await prisma.registscan.findUnique({ where: { id: check.id_regist } });
      assertCanAccessRegistration(req.user, reg);
      const result = await prisma.recordscan.delete({
        where: {
          id: id,
        },
      });
      res.status(200).json({ result: result, message: "Deleted Succesfully" });
    }
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Internal Server Error" });
  }
});

router.get("/total-po-scan", async (req, res) => {
  const { page = 1, limit = 10, keyword = "" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  let result = "";
  let count = [];

  try {
    if (keyword && keyword !== undefined && keyword !== null) {
      result = await prisma.$queryRaw`
        SELECT 
          rgs.model,
          rgs.order_number,
          rgs.po_number,
          rgs.subline,
          COUNT(rgs.subline)::int AS countsubline
        FROM recordscan AS rcd
        JOIN registscan AS rgs
        ON rcd.id_regist::uuid = rgs.id
        WHERE rcd.sn = ${keyword} OR rgs.order_number = ${keyword} OR rgs.po_number = ${keyword} OR rgs.model = ${keyword} OR rgs.subline = ${keyword}
        GROUP BY rgs.model, rgs.subline, rgs.po_number, rgs.order_number
        OFFSET ${skip} LIMIT ${Number(limit)}
      `;

      count = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT 1
          FROM recordscan AS rcd
          JOIN registscan AS rgs
          ON rcd.id_regist::uuid = rgs.id
          WHERE rgs.order_number = ${keyword} OR rgs.po_number = ${keyword} OR rgs.model = ${keyword} OR rgs.subline = ${keyword}
          GROUP BY rgs.model, rgs.subline, rgs.po_number, rgs.order_number
        ) AS subquery
      `;
    } else {
      result = await prisma.$queryRawUnsafe(`
      SELECT 
      rgs.model,
      rgs.order_number,
      rgs.po_number,
      rgs.subline,
      COUNT(rgs.subline)::int AS countsubline
      from recordscan AS rcd
      JOIN registscan AS rgs
      ON rcd.id_regist::uuid = rgs.id
        GROUP BY rgs.model,rgs.subline,rgs.po_number,rgs.order_number
        OFFSET ${skip} LIMIT ${Number(limit)}
        `);

      count = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT 1
          FROM recordscan AS rcd
          JOIN registscan AS rgs
          ON rcd.id_regist::uuid = rgs.id
          GROUP BY rgs.model, rgs.subline, rgs.po_number, rgs.order_number
        ) AS subquery
      `;
    }

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
  } catch (error) {
    console.error(`Handling Error count total po scan: ${error.message}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/export-odf-po-all", async (req, res) => {
  const { model, order_number, po_number, subline } = req.query;

  try {
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
  FROM recordscan AS rcd
  JOIN registscan AS rgs
    ON rcd.id_regist::uuid = rgs.id
  WHERE rgs.model = ${model}
    AND (${order_number}::text IS NULL OR rgs.order_number = ${order_number})
    AND (${po_number}::text IS NULL OR rgs.po_number = ${po_number})
    AND (${subline}::text IS NULL OR rgs.subline = ${subline});
`;

    res.status(200).json({ data: result });
  } catch (error) {
    console.log(`Handling Error export odf po all: ${error.message}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/export-odf-po-detail/", async (req, res) => {
  const { order_number, po_number, subline, model } = req.query;

  try {
    const result = await prisma.$queryRaw`
            SELECT 
			rgs.timestamps,
          rgs.model,
          rgs.order_number,
          rgs.po_number,
          rgs.subline,
          COUNT(rgs.subline)::int AS countsubline
        FROM recordscan AS rcd
        JOIN registscan AS rgs
        ON rcd.id_regist::uuid = rgs.id
        WHERE rgs.model = ${model} 
          AND (${order_number}::text IS NULL OR rgs.order_number = ${order_number})
          AND (${po_number}::text IS NULL OR rgs.po_number = ${po_number})
          AND (${subline}::text IS NULL OR rgs.subline = ${subline})
        GROUP BY rgs.id,rgs.model, rgs.subline, rgs.po_number, rgs.order_number
    `;

    res.status(200).json({ data: result });
  } catch (error) {
    // console.log(`Handling Error export odf po detail: ${error.message}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
