#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");
const { PrismaClient } = require("../src/generated/prisma");
const { backfillPhase3 } = require("./database-redesign-backfill");
const { backfillScans } = require("./database-redesign-scan-backfill");
const { runReconciliation } = require("./database-redesign-reconcile");
const {
  CONFIRMATION: MIGRATION_CONFIRMATION,
  assertSafeTarget,
  temporaryDatabaseName,
} = require("./database-redesign-verify-migrations");

const CONFIRMATION = "VERIFY_TEST_BACKFILL_END_TO_END";

function assertBackfillFixtureAllowed(databaseUrl, confirmation) {
  const url = assertSafeTarget(databaseUrl, MIGRATION_CONFIRMATION);
  if (confirmation !== CONFIRMATION) throw new Error(`Confirmation must be ${CONFIRMATION}`);
  return url;
}

function command(name, args, env = process.env) {
  const result = spawnSync(name, args, { env, encoding: "utf8", stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} exited with status ${result.status}`);
}

async function seedFixture(db) {
  const category = await db.product_categories.create({
    data: { slug: "ac", name: "Air Conditioner" },
  });
  const wmCategory = await db.product_categories.create({
    data: { slug: "wm", name: "Washing Machine" },
  });
  const model = await db.model.create({
    data: { model: "FIXTURE-MODEL", brand: "FIXTURE", category_id: category.id },
  });
  await db.line.create({ data: { line: "LINE IDU ASSY INPUT" } });
  await db.line.create({ data: { line: "LINE WM ASSY INPUT" } });
  await db.users.create({
    data: {
      username: "fixture-operator",
      hash: "fixture-only",
      email: "fixture@example.invalid",
      roleuser: "operator",
      departement: "Production",
    },
  });
  const order = await db.bomlist.create({
    data: {
      model: model.model,
      order_number: "FIXTURE-ORDER",
      product_category: "ac",
      ac_spec: {
        create: {
          sn_prefix: "AC-",
          sn_required: true,
          sn_carton_prefix: "BOX-",
          sn_carton_required: true,
        },
      },
    },
  });
  const registration = await db.registscan.create({
    data: {
      model: model.model,
      order_number: order.order_number,
      subline: "LINE IDU ASSY INPUT",
      userid: "fixture-operator",
      shift: "1",
      plan: 2,
      product_category: "ac",
      ac_spec: { create: { sn: "AC-0001", sn_carton: "BOX-001" } },
    },
  });
  await db.recordscan_ac.create({
    data: {
      id_regist: registration.id,
      sn: "AC-0001",
      sn_carton: "BOX-001",
    },
  });

  const wmModel = await db.model.create({
    data: { model: "FIXTURE-WM", brand: "FIXTURE", category_id: wmCategory.id },
  });
  const wmOrder = await db.bomlist.create({
    data: {
      model: wmModel.model,
      order_number: "FIXTURE-WM-ORDER",
      product_category: "wm",
      wm_spec: {
        create: {
          sn_prefix: "WM-",
          sn_required: true,
          sn_drum_prefix: "DRUM-",
          sn_drum_required: true,
        },
      },
    },
  });
  const wmRegistration = await db.registscan.create({
    data: {
      model: wmModel.model,
      order_number: wmOrder.order_number,
      subline: "LINE WM ASSY INPUT",
      userid: "fixture-operator",
      shift: "1",
      plan: 2,
      product_category: "wm",
      wm_spec: { create: { sn: "WM-0001", sn_drum: "DRUM-001" } },
    },
  });
  await db.recordscan_wm.create({
    data: {
      id_regist: wmRegistration.id,
      sn: "WM-0001",
      sn_drum: "DRUM-001",
    },
  });
}

async function verifyBackfillFixture(databaseUrl, confirmation) {
  const base = assertBackfillFixtureAllowed(databaseUrl, confirmation);
  const database = temporaryDatabaseName();
  const connectionArgs = ["-h", base.hostname, "-p", base.port || "5432", "-U", base.username];
  const target = new URL(base.toString());
  target.pathname = `/${database}`;
  const env = { ...process.env, DATABASE_URL: target.toString() };
  command("createdb", [...connectionArgs, database]);
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  try {
    command("npx", ["prisma", "migrate", "deploy"], env);
    await seedFixture(db);
    const quantities = { "FIXTURE-ORDER": 2, "FIXTURE-WM-ORDER": 2 };
    const phase3First = await backfillPhase3(db, quantities);
    const phase4First = await backfillScans(db);
    const phase3Second = await backfillPhase3(db, quantities);
    const phase4Second = await backfillScans(db);
    const reconciliation = await runReconciliation(db);
    if (!phase4First.ready || !phase4Second.ready || !reconciliation.ready) {
      throw new Error("Fixture did not reach a reconciled state");
    }
    if (JSON.stringify(phase3First.after) !== JSON.stringify(phase3Second.after)) {
      throw new Error("Phase 3 backfill is not idempotent");
    }
    if (JSON.stringify(phase4First.after) !== JSON.stringify(phase4Second.after)) {
      throw new Error("Phase 4 backfill is not idempotent");
    }
    return { verified: true, phase3: phase3Second.after, phase4: phase4Second.after };
  } finally {
    await db.$disconnect();
    command("dropdb", [...connectionArgs, database]);
  }
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
  const result = await verifyBackfillFixture(
    process.env.DATABASE_URL,
    process.env.ALLOW_TEST_BACKFILL_VERIFY,
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`Backfill fixture verification failed: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { CONFIRMATION, assertBackfillFixtureAllowed, seedFixture, verifyBackfillFixture };
