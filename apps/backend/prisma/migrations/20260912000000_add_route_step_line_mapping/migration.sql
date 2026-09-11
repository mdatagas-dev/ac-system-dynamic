-- Assign physical Lines explicitly to model and Production Order Route Steps.
ALTER TABLE "model_route_steps"
  ADD COLUMN "line_id" UUID;

ALTER TABLE "bomlist_route_steps"
  ADD COLUMN "line_id" UUID;

CREATE INDEX "model_route_steps_line_id_idx"
  ON "model_route_steps"("line_id");

CREATE INDEX "bomlist_route_steps_line_id_idx"
  ON "bomlist_route_steps"("line_id");

ALTER TABLE "model_route_steps"
  ADD CONSTRAINT "model_route_steps_line_id_fkey"
  FOREIGN KEY ("line_id") REFERENCES "line"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "bomlist_route_steps"
  ADD CONSTRAINT "bomlist_route_steps_line_id_fkey"
  FOREIGN KEY ("line_id") REFERENCES "line"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
