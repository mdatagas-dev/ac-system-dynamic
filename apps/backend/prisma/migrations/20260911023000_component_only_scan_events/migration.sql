-- Route snapshots decide whether a scan event must identify a Production Unit.
ALTER TABLE "model_route_steps"
  ADD COLUMN "requires_main_serial" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "bomlist_route_steps"
  ADD COLUMN "requires_main_serial" BOOLEAN NOT NULL DEFAULT true;

-- Component-only events intentionally have no Production Unit.
ALTER TABLE "recordscan"
  ALTER COLUMN "production_unit_id" DROP NOT NULL;

CREATE TABLE "recordscan_components" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recordscan_id" UUID NOT NULL,
  "component_type_id" UUID NOT NULL,
  "route_step_id" UUID NOT NULL,
  "serial_number" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recordscan_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recordscan_components_serial_not_blank"
    CHECK (length(trim("serial_number")) > 0),
  CONSTRAINT "recordscan_components_recordscan_id_fkey"
    FOREIGN KEY ("recordscan_id") REFERENCES "recordscan"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "recordscan_components_component_type_id_fkey"
    FOREIGN KEY ("component_type_id") REFERENCES "component_types"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "recordscan_components_route_step_id_fkey"
    FOREIGN KEY ("route_step_id") REFERENCES "bomlist_route_steps"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "recordscan_components_recordscan_id_component_type_id_key"
  ON "recordscan_components"("recordscan_id", "component_type_id");

-- A component may pass a given Route Step only once. This stays unique after
-- soft deletion so component identity remains reserved.
CREATE UNIQUE INDEX "recordscan_components_component_type_id_serial_number_route_key"
  ON "recordscan_components"("component_type_id", "serial_number", "route_step_id");

CREATE INDEX "recordscan_components_serial_number_idx"
  ON "recordscan_components"("serial_number");

CREATE INDEX "recordscan_components_route_step_id_idx"
  ON "recordscan_components"("route_step_id");
