// Dashboard UPH per model/line dengan logika shift:
// 07–16 shift 1, ≥16 shift 2, dini hari lanjutan shift 2. Redis cache 60s.
const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const redis = require("../config/redis");

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

router.get("/dashboard", async (req, res) => {
  const { keyword } = req.query;

  const now = new Date();
  const todayStr = formatDateLocal(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateLocal(yesterday);
  let hour = now.getHours();

  const cacheKey = `dashboardUphAC:${todayStr}:${hour}:${keyword}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.status(200).json(JSON.parse(cached));
  }

  let params = [];
  let dateParams = [];
  let whereClause1 = ``;
  let whereClause2 = ``;
  let whereClause3 = ``;
  // tanggal selalu diparameterkan (jangan di-interpolasi ke string SQL)
  const dateToday = (keyword ? "$2" : "$1") + "::date";
  const dateYesterday = (keyword ? "$3" : "$2") + "::date";

  if (keyword) {
    params.push(keyword);
    whereClause1 = `
    aln.line = UPPER($1) AND
    rgs.shift = '1'
    AND rgs.timestamps::date = ${dateToday}`;

    whereClause2 = `
  	aln.line = UPPER($1)
	AND
	(rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = ${dateToday}
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
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = ${dateYesterday} 
    )
      OR
    (
        rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 0 
      AND
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = ${dateToday}
    )
  )
    `;
  } else {
    whereClause1 = `
    rgs.shift = '1'
    AND rgs.timestamps::date = ${dateToday}`;

    whereClause2 = `
	(rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = ${dateToday}
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
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = ${dateYesterday} 
    )
      OR
    (
        rgs.shift = '2' AND EXTRACT(HOUR FROM rcs.timestamps AT TIME ZONE 'Asia/Jakarta') >= 0 
      AND
      (rgs.timestamps AT TIME ZONE 'Asia/Jakarta')::date = ${dateToday}
    )
    `;
  }

  let subline;
  let whereClause;
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
    whereClause = whereClause1;
    dateParams.push(todayStr);
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
    whereClause = whereClause2;
    dateParams.push(todayStr);
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
    whereClause = whereClause3;
    dateParams.push(todayStr, yesterdayStr);
  }

  // satu query utama — yang membedakan tiap shift hanya whereClause + param tanggal
  const query = `
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
          ${whereClause}
      GROUP BY rgs.model, jam, rgs.subline, suph.uph
      ORDER BY jam, rgs.model, rgs.subline;
`;

  // use dinamis query for queryRawUnsafe
  const result = await prisma.$queryRawUnsafe(query, ...params, ...dateParams);
  const validUph = [
    { start: 7, end: 8, time: 7 }, { start: 8, end: 9, time: 8 },
    { start: 9, end: 10, time: 9 }, { start: 10, end: 11, time: 10 },
    { start: 11, end: 12, time: 11 }, { start: 12, end: 13, time: 12 },
    { start: 13, end: 14, time: 13 }, { start: 14, end: 15, time: 14 },
    { start: 15, end: 16, time: 15 }, { start: 16, end: 17, time: 16 },
    { start: 17, end: 18, time: 17 }, { start: 18, end: 19, time: 18 },
    { start: 19, end: 20, time: 19 }, { start: 20, end: 21, time: 20 },
    { start: 21, end: 22, time: 21 }, { start: 22, end: 23, time: 22 },
    { start: 23, end: 24, time: 23 }, { start: 0, end: 1, time: 24 },
    { start: 1, end: 2, time: 1 }, { start: 2, end: 3, time: 2 },
    { start: 3, end: 4, time: 3 }, { start: 4, end: 5, time: 4 },
    { start: 5, end: 6, time: 5 }, { start: 6, end: 7, time: 6 },
  ];

  const grouped = result.reduce((acc, { suph, model, jam, total }) => {
    const hour = new Date(jam).getHours();
    if (!acc[model]) {
      acc[model] = { suph: suph, total: 0 };
    }
    acc[model][hour] = (acc[model][hour] || 0) + total;
    acc[model].total += total;
    return acc;
  }, {});

  const outputs = Object.entries(grouped).map(([model, uphRecords]) => {
    const uph = validUph.map(({ time }) => ({
      time,
      record: String(uphRecords[time] || 0),
    }));
    return {
      model,
      uph,
      suph: uphRecords.suph,
      total: uphRecords.total || 0,
    };
  });

  const finishResult = { data: outputs.reverse(), subline };
  await redis.set(cacheKey, JSON.stringify(finishResult), { EX: 60 });
  res.status(200).json(finishResult);
});

module.exports = router;