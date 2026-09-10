const SCAN_REPORT_SOURCE = `
  WITH component_values AS (
    SELECT rs.id AS recordscan_id, puc.component_type_id, puc.serial_number
    FROM recordscan rs
    JOIN production_unit_components puc
      ON puc.production_unit_id = rs.production_unit_id
    UNION ALL
    SELECT rc.recordscan_id, rc.component_type_id, rc.serial_number
    FROM recordscan_components rc
  )
  SELECT
    rs.id,
    rs.id_regist,
    pu.serial_number AS sn,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'sn_carton') AS sn_carton,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'sn_box') AS sn_box,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'pcb_idu') AS pcb_idu,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'pcb_odu') AS pcb_odu,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'sn_motor') AS sn_motor,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'sn_accessories') AS sn_accessories,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'sn_drum') AS sn_drum,
    MAX(cv.serial_number) FILTER (WHERE ct.code = 'sn_pump') AS sn_pump,
    rs.timestamps,
    r.product_category,
    'normalized'::varchar AS source
  FROM recordscan rs
  JOIN registscan r ON r.id = rs.id_regist
  LEFT JOIN production_units pu ON pu.id = rs.production_unit_id
  LEFT JOIN component_values cv ON cv.recordscan_id = rs.id
  LEFT JOIN component_types ct ON ct.id = cv.component_type_id
  WHERE rs.deleted_at IS NULL
  GROUP BY rs.id, pu.serial_number, r.product_category
  UNION ALL
  SELECT
    a.id, a.id_regist, a.sn, a.sn_carton, a.sn_box, a.pcb_idu, a.pcb_odu,
    a.sn_motor, a.sn_accessories, NULL::varchar, NULL::varchar,
    a.timestamps, 'ac'::varchar, 'legacy'::varchar
  FROM recordscan_ac a
  WHERE NOT EXISTS (
    SELECT 1 FROM recordscan rs
    WHERE rs.legacy_source_table = 'recordscan_ac'
      AND rs.legacy_source_id = a.id
  )
  UNION ALL
  SELECT
    w.id, w.id_regist, w.sn, NULL::varchar, NULL::varchar, NULL::varchar,
    NULL::varchar, NULL::varchar, NULL::varchar, w.sn_drum, w.sn_pump,
    w.timestamps, 'wm'::varchar, 'legacy'::varchar
  FROM recordscan_wm w
  WHERE NOT EXISTS (
    SELECT 1 FROM recordscan rs
    WHERE rs.legacy_source_table = 'recordscan_wm'
      AND rs.legacy_source_id = w.id
  )
`;

module.exports = { SCAN_REPORT_SOURCE };
