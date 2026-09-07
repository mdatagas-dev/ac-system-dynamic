-- Add separate ODU PCB traceability without removing legacy AC fields.
ALTER TABLE ac_bom_spec
  ADD COLUMN IF NOT EXISTS pcb_odu_prefix varchar(255),
  ADD COLUMN IF NOT EXISTS pcb_odu_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pcb_odu_unit varchar(3);

ALTER TABLE ac_registration_spec
  ADD COLUMN IF NOT EXISTS pcb_odu varchar(255);

ALTER TABLE recordscan_ac
  ADD COLUMN IF NOT EXISTS pcb_odu varchar(255);

CREATE INDEX IF NOT EXISTS recordscan_ac_pcb_odu_idx ON recordscan_ac(pcb_odu);
