-- AlterTable
ALTER TABLE "bomlist" ADD COLUMN     "model_id" UUID,
ADD COLUMN     "order_quantity" INTEGER,
ADD COLUMN     "order_status" VARCHAR(20) NOT NULL DEFAULT 'draft',
ADD COLUMN     "po_number" VARCHAR(255);

-- AlterTable
ALTER TABLE "registscan" ADD COLUMN     "bomlist_id" UUID,
ADD COLUMN     "delete_reason" VARCHAR(500),
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "line_id" UUID,
ADD COLUMN     "production_date" DATE,
ADD COLUMN     "route_step_id" UUID;

-- CreateTable
CREATE TABLE "component_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "category_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "component_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_bom_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" UUID NOT NULL,
    "component_type_id" UUID NOT NULL,
    "prefix" VARCHAR(255),
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "model_bom_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_route_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "model_route_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bomlist_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bomlist_id" UUID NOT NULL,
    "component_type_id" UUID NOT NULL,
    "prefix" VARCHAR(255),
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bomlist_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bomlist_route_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bomlist_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "template_step_id" UUID,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bomlist_route_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registscan_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_regist" UUID NOT NULL,
    "component_type_id" UUID NOT NULL,
    "reference_value" VARCHAR(255),
    "expected_length" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "prefix_snapshot" VARCHAR(255),

    CONSTRAINT "registscan_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bomlist_id" UUID NOT NULL,
    "serial_number" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "production_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_unit_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "production_unit_id" UUID NOT NULL,
    "component_type_id" UUID NOT NULL,
    "serial_number" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_unit_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordscan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_regist" UUID NOT NULL,
    "production_unit_id" UUID NOT NULL,
    "route_step_id" UUID NOT NULL,
    "scanned_by" UUID,
    "timestamps" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),
    "legacy_source_table" VARCHAR(64),
    "legacy_source_id" UUID,

    CONSTRAINT "recordscan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "reason" VARCHAR(500),
    "performed_by" UUID NOT NULL,
    "authorized_pin_id" UUID,
    "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_quarantine" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_table" VARCHAR(64) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "details" JSONB,
    "resolved_at" TIMESTAMPTZ(6),
    "resolution" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_quarantine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "component_types_code_key" ON "component_types"("code");

-- CreateIndex
CREATE INDEX "component_types_category_id_idx" ON "component_types"("category_id");

-- CreateIndex
CREATE INDEX "component_types_is_active_idx" ON "component_types"("is_active");

-- CreateIndex
CREATE INDEX "model_bom_templates_component_type_id_idx" ON "model_bom_templates"("component_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "model_bom_templates_model_id_component_type_id_key" ON "model_bom_templates"("model_id", "component_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "processes_code_key" ON "processes"("code");

-- CreateIndex
CREATE INDEX "model_route_steps_process_id_idx" ON "model_route_steps"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "model_route_steps_model_id_code_key" ON "model_route_steps"("model_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "model_route_steps_model_id_sequence_key" ON "model_route_steps"("model_id", "sequence");

-- CreateIndex
CREATE INDEX "bomlist_components_component_type_id_idx" ON "bomlist_components"("component_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "bomlist_components_bomlist_id_component_type_id_key" ON "bomlist_components"("bomlist_id", "component_type_id");

-- CreateIndex
CREATE INDEX "bomlist_route_steps_process_id_idx" ON "bomlist_route_steps"("process_id");

-- CreateIndex
CREATE INDEX "bomlist_route_steps_template_step_id_idx" ON "bomlist_route_steps"("template_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "bomlist_route_steps_bomlist_id_code_key" ON "bomlist_route_steps"("bomlist_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bomlist_route_steps_bomlist_id_sequence_key" ON "bomlist_route_steps"("bomlist_id", "sequence");

-- CreateIndex
CREATE INDEX "registscan_components_component_type_id_idx" ON "registscan_components"("component_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "registscan_components_id_regist_component_type_id_key" ON "registscan_components"("id_regist", "component_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_units_serial_number_key" ON "production_units"("serial_number");

-- CreateIndex
CREATE INDEX "production_units_bomlist_id_idx" ON "production_units"("bomlist_id");

-- CreateIndex
CREATE INDEX "production_units_status_idx" ON "production_units"("status");

-- CreateIndex
CREATE INDEX "production_unit_components_serial_number_idx" ON "production_unit_components"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_unit_components_production_unit_id_component_typ_key" ON "production_unit_components"("production_unit_id", "component_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_unit_components_component_type_id_serial_number_key" ON "production_unit_components"("component_type_id", "serial_number");

-- CreateIndex
CREATE INDEX "recordscan_id_regist_timestamps_idx" ON "recordscan"("id_regist", "timestamps");

-- CreateIndex
CREATE INDEX "recordscan_production_unit_id_idx" ON "recordscan"("production_unit_id");

-- CreateIndex
CREATE INDEX "recordscan_route_step_id_idx" ON "recordscan"("route_step_id");

-- CreateIndex
CREATE INDEX "recordscan_deleted_at_idx" ON "recordscan"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "recordscan_legacy_source_table_legacy_source_id_key" ON "recordscan"("legacy_source_table", "legacy_source_id");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_performed_at_idx" ON "audit_events"("entity_type", "entity_id", "performed_at");

-- CreateIndex
CREATE INDEX "audit_events_performed_by_idx" ON "audit_events"("performed_by");

-- CreateIndex
CREATE INDEX "audit_events_authorized_pin_id_idx" ON "audit_events"("authorized_pin_id");

-- CreateIndex
CREATE INDEX "migration_quarantine_resolved_at_idx" ON "migration_quarantine"("resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "migration_quarantine_source_table_source_id_reason_code_key" ON "migration_quarantine"("source_table", "source_id", "reason_code");

-- CreateIndex
CREATE INDEX "bomlist_model_id_idx" ON "bomlist"("model_id");

-- CreateIndex
CREATE INDEX "bomlist_order_number_idx" ON "bomlist"("order_number");

-- CreateIndex
CREATE INDEX "bomlist_po_number_idx" ON "bomlist"("po_number");

-- CreateIndex
CREATE INDEX "bomlist_order_status_idx" ON "bomlist"("order_status");

-- CreateIndex
CREATE INDEX "registscan_bomlist_id_idx" ON "registscan"("bomlist_id");

-- CreateIndex
CREATE INDEX "registscan_line_id_idx" ON "registscan"("line_id");

-- CreateIndex
CREATE INDEX "registscan_route_step_id_idx" ON "registscan"("route_step_id");

-- CreateIndex
CREATE INDEX "registscan_production_date_shift_idx" ON "registscan"("production_date", "shift");

-- CreateIndex
CREATE INDEX "registscan_deleted_at_idx" ON "registscan"("deleted_at");

-- AddForeignKey
ALTER TABLE "bomlist" ADD CONSTRAINT "bomlist_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registscan" ADD CONSTRAINT "registscan_bomlist_id_fkey" FOREIGN KEY ("bomlist_id") REFERENCES "bomlist"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registscan" ADD CONSTRAINT "registscan_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "line"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registscan" ADD CONSTRAINT "registscan_route_step_id_fkey" FOREIGN KEY ("route_step_id") REFERENCES "bomlist_route_steps"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registscan" ADD CONSTRAINT "registscan_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "component_types" ADD CONSTRAINT "component_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "model_bom_templates" ADD CONSTRAINT "model_bom_templates_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "model_bom_templates" ADD CONSTRAINT "model_bom_templates_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "component_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "model_route_steps" ADD CONSTRAINT "model_route_steps_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "model_route_steps" ADD CONSTRAINT "model_route_steps_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bomlist_components" ADD CONSTRAINT "bomlist_components_bomlist_id_fkey" FOREIGN KEY ("bomlist_id") REFERENCES "bomlist"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bomlist_components" ADD CONSTRAINT "bomlist_components_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "component_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bomlist_route_steps" ADD CONSTRAINT "bomlist_route_steps_bomlist_id_fkey" FOREIGN KEY ("bomlist_id") REFERENCES "bomlist"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bomlist_route_steps" ADD CONSTRAINT "bomlist_route_steps_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bomlist_route_steps" ADD CONSTRAINT "bomlist_route_steps_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "model_route_steps"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registscan_components" ADD CONSTRAINT "registscan_components_id_regist_fkey" FOREIGN KEY ("id_regist") REFERENCES "registscan"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "registscan_components" ADD CONSTRAINT "registscan_components_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "component_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "production_units" ADD CONSTRAINT "production_units_bomlist_id_fkey" FOREIGN KEY ("bomlist_id") REFERENCES "bomlist"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "production_unit_components" ADD CONSTRAINT "production_unit_components_production_unit_id_fkey" FOREIGN KEY ("production_unit_id") REFERENCES "production_units"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "production_unit_components" ADD CONSTRAINT "production_unit_components_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "component_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recordscan" ADD CONSTRAINT "recordscan_id_regist_fkey" FOREIGN KEY ("id_regist") REFERENCES "registscan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recordscan" ADD CONSTRAINT "recordscan_production_unit_id_fkey" FOREIGN KEY ("production_unit_id") REFERENCES "production_units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recordscan" ADD CONSTRAINT "recordscan_route_step_id_fkey" FOREIGN KEY ("route_step_id") REFERENCES "bomlist_route_steps"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recordscan" ADD CONSTRAINT "recordscan_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recordscan" ADD CONSTRAINT "recordscan_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_authorized_pin_id_fkey" FOREIGN KEY ("authorized_pin_id") REFERENCES "pin"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Domain checks. NOT VALID allows the additive migration to coexist with
-- legacy rows; PostgreSQL still enforces each constraint for new writes.
ALTER TABLE "bomlist"
  ADD CONSTRAINT "bomlist_order_quantity_positive"
  CHECK ("order_quantity" IS NULL OR "order_quantity" > 0) NOT VALID,
  ADD CONSTRAINT "bomlist_order_status_valid"
  CHECK ("order_status" IN ('draft', 'released', 'active', 'completed', 'cancelled'));

ALTER TABLE "registscan"
  ADD CONSTRAINT "registscan_plan_positive"
  CHECK ("plan" IS NULL OR "plan" > 0) NOT VALID;

ALTER TABLE "model_route_steps"
  ADD CONSTRAINT "model_route_steps_sequence_positive" CHECK ("sequence" > 0);

ALTER TABLE "bomlist_route_steps"
  ADD CONSTRAINT "bomlist_route_steps_sequence_positive" CHECK ("sequence" > 0);

ALTER TABLE "registscan_components"
  ADD CONSTRAINT "registscan_components_expected_length_positive"
  CHECK ("expected_length" IS NULL OR "expected_length" > 0);

ALTER TABLE "production_units"
  ADD CONSTRAINT "production_units_status_valid"
  CHECK ("status" IN ('active', 'completed', 'cancelled'));

-- These partial indexes protect the active operational identity while allowing
-- soft-deleted history to remain in place. New relation columns are nullable
-- until the backfill phase, so legacy rows do not participate yet.
CREATE UNIQUE INDEX "registscan_active_identity_key"
  ON "registscan" (
    "bomlist_id", "production_date", "shift", "line_id", "route_step_id"
  )
  WHERE "deleted_at" IS NULL
    AND "bomlist_id" IS NOT NULL
    AND "production_date" IS NOT NULL
    AND "shift" IS NOT NULL
    AND "line_id" IS NOT NULL
    AND "route_step_id" IS NOT NULL;

CREATE UNIQUE INDEX "recordscan_active_unit_route_step_key"
  ON "recordscan" ("production_unit_id", "route_step_id")
  WHERE "deleted_at" IS NULL;

-- Controlled seed catalog. `sn` is shared by all product categories; the
-- remaining types are scoped to their canonical category when it exists.
INSERT INTO "component_types" ("code", "label", "category_id") VALUES
  ('sn', 'Serial Number', NULL),
  ('sn_carton', 'SN Carton', (SELECT id FROM product_categories WHERE slug = 'ac')),
  ('pcb_idu', 'PCB IDU', (SELECT id FROM product_categories WHERE slug = 'ac')),
  ('pcb_odu', 'PCB ODU', (SELECT id FROM product_categories WHERE slug = 'ac')),
  ('sn_motor', 'SN Motor', (SELECT id FROM product_categories WHERE slug = 'ac')),
  ('sn_accessories', 'SN Accessories', (SELECT id FROM product_categories WHERE slug = 'ac')),
  ('sn_odu', 'SN ODU (Legacy)', (SELECT id FROM product_categories WHERE slug = 'ac')),
  ('sn_box', 'SN Box (Legacy)', (SELECT id FROM product_categories WHERE slug = 'ac')),
  ('sn_drum', 'SN Drum', (SELECT id FROM product_categories WHERE slug = 'wm')),
  ('sn_pump', 'SN Pump', (SELECT id FROM product_categories WHERE slug = 'wm'))
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "processes" ("code", "name") VALUES
  ('assembly', 'Assembly'),
  ('testing', 'Testing'),
  ('packing', 'Packing')
ON CONFLICT ("code") DO NOTHING;
