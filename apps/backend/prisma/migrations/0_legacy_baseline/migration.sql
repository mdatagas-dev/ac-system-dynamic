-- Baseline for databases that existed before Prisma Migrate was introduced.
-- Existing production databases must mark this migration as applied; do not run
-- it against a database that already contains these tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  fields jsonb,
  created_at timestamp(6) DEFAULT now()
);

CREATE TABLE model (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand varchar(255),
  model varchar(255),
  pk decimal,
  linkimage varchar(255),
  product varchar,
  category_id uuid,
  CONSTRAINT model_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES product_categories(id)
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line varchar(255)
);

CREATE TABLE users (
  username varchar(255) NOT NULL,
  hash varchar(255) NOT NULL,
  password varchar(255),
  email varchar(255) NOT NULL,
  roleuser varchar(255) NOT NULL,
  departement varchar(255) NOT NULL,
  section varchar(255),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE pin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin integer,
  date date DEFAULT now()
);

CREATE TABLE bomlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sn_carton varchar(255),
  pcb_idu varchar(255),
  sn_box varchar(255),
  sn_motor varchar(255),
  sn_accessories varchar(255),
  order_number varchar(255),
  sn varchar(255),
  timestamps timestamp(6) DEFAULT now(),
  model varchar(255),
  product_category varchar(50),
  components jsonb,
  unit_map jsonb,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE registscan (
  timestamps timestamptz(6) DEFAULT now(),
  model varchar(255) NOT NULL,
  order_number varchar(255) NOT NULL,
  subline varchar(255) NOT NULL,
  userid varchar(255) NOT NULL,
  shift varchar(255),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sn varchar,
  sn_carton varchar,
  pcb_idu varchar,
  sn_box varchar,
  sn_motor varchar,
  sn_accessories varchar,
  sn_odu varchar,
  plan integer,
  po_number varchar(255),
  product_category varchar(50),
  components jsonb,
  fields_snapshot jsonb
);

CREATE TABLE recordscan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_regist varchar(255),
  sn_carton varchar(255),
  pcb_idu varchar(255),
  sn_box varchar(255),
  sn_motor varchar(255),
  sn_accessories varchar(255),
  sn varchar(255),
  sn_odu varchar(255),
  timestamps timestamptz(6) DEFAULT now(),
  product_category varchar(50),
  components jsonb
);

CREATE INDEX idx_recordscan_id_regist_trgm
  ON recordscan USING gin (id_regist gin_trgm_ops);
CREATE INDEX idx_recordscan_pcb_idu ON recordscan(pcb_idu);
CREATE INDEX idx_recordscan_sn ON recordscan(sn);
CREATE INDEX idx_recordscan_sn_accessories ON recordscan(sn_accessories);
CREATE INDEX idx_recordscan_sn_box ON recordscan(sn_box);
CREATE INDEX idx_recordscan_sn_carton ON recordscan(sn_carton);
CREATE INDEX idx_recordscan_sn_motor ON recordscan(sn_motor);
CREATE INDEX idx_recordscan_timestamps ON recordscan(timestamps);

CREATE TABLE uph (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model uuid,
  line uuid,
  uph integer,
  CONSTRAINT uph_model_fkey
    FOREIGN KEY (model) REFERENCES model(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT uph_line_fkey
    FOREIGN KEY (line) REFERENCES line(id)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE product_categories_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(50) NOT NULL,
  fields jsonb,
  changed_by varchar(255) NOT NULL,
  changed_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX product_categories_audit_slug_changed_at_idx
  ON product_categories_audit(slug, changed_at);
