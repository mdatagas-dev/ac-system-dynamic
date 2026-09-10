#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { assertSafeDatabaseUrl } = require("./database-redesign-preflight");

const CONFIRMATION = "RESOLVE_TEST_QUARANTINE";

function assertResolutionWriteAllowed(databaseUrl, confirmation) {
  assertSafeDatabaseUrl(databaseUrl);
  if (confirmation !== CONFIRMATION) throw new Error(`Confirmation must be ${CONFIRMATION}`);
}

function normalizeResolutions(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Resolution file must contain a non-empty JSON array");
  }
  const seen = new Set();
  return input.map((item, index) => {
    const id = String(item?.id || "").trim();
    const resolution = String(item?.resolution || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error(`Resolution ${index + 1} has an invalid quarantine id`);
    }
    if (!resolution) throw new Error(`Resolution ${index + 1} has a blank explanation`);
    if (resolution.length > 500) throw new Error(`Resolution ${index + 1} exceeds 500 characters`);
    if (seen.has(id)) throw new Error(`Duplicate quarantine id ${id}`);
    seen.add(id);
    return { id, resolution };
  });
}

async function resolveQuarantine(prisma, requested) {
  const resolutions = normalizeResolutions(requested);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.migration_quarantine.findMany({
      where: { id: { in: resolutions.map((item) => item.id) } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const item of resolutions) {
      const existing = byId.get(item.id);
      if (!existing) throw new Error(`Quarantine row ${item.id} was not found`);
      if (existing.resolved_at && existing.resolution !== item.resolution) {
        throw new Error(`Quarantine row ${item.id} already has a different resolution`);
      }
    }
    let updated = 0;
    for (const item of resolutions) {
      if (byId.get(item.id).resolved_at) continue;
      await tx.migration_quarantine.update({
        where: { id: item.id },
        data: { resolved_at: new Date(), resolution: item.resolution },
      });
      updated += 1;
    }
    return { requested: resolutions.length, updated };
  });
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
  assertResolutionWriteAllowed(
    process.env.DATABASE_URL,
    process.env.ALLOW_TEST_QUARANTINE_RESOLUTION,
  );
  const filename = process.env.QUARANTINE_RESOLUTIONS_FILE;
  if (!filename) throw new Error("QUARANTINE_RESOLUTIONS_FILE is required");
  const requested = JSON.parse(fs.readFileSync(path.resolve(filename), "utf8"));
  const prisma = require("../lib/prisma");
  try {
    process.stdout.write(`${JSON.stringify(await resolveQuarantine(prisma, requested))}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`Quarantine resolution failed: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = {
  CONFIRMATION,
  assertResolutionWriteAllowed,
  normalizeResolutions,
  resolveQuarantine,
};
