#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

const CONFIRMATION = "VERIFY_CLEAN_TEST_MIGRATIONS";

function assertSafeTarget(databaseUrl, confirmation) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const url = new URL(databaseUrl);
  const database = url.pathname.slice(1);
  if (!/test/i.test(database)) throw new Error("Base database must be a test database");
  if (confirmation !== CONFIRMATION) throw new Error(`Confirmation must be ${CONFIRMATION}`);
  return url;
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: "utf8", stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function temporaryDatabaseName() {
  return `ac_system_test_clean_${process.pid}_${Date.now()}`;
}

function verifyMigrations(databaseUrl, confirmation) {
  const base = assertSafeTarget(databaseUrl, confirmation);
  const database = temporaryDatabaseName();
  const connectionArgs = ["-h", base.hostname, "-p", base.port || "5432", "-U", base.username];
  const target = new URL(base.toString());
  target.pathname = `/${database}`;
  const env = { ...process.env, DATABASE_URL: target.toString() };
  run("createdb", [...connectionArgs, database]);
  try {
    run("npx", ["prisma", "migrate", "deploy"], env);
    run("npx", [
      "prisma", "migrate", "diff", "--exit-code",
      "--from-url", target.toString(),
      "--to-schema-datamodel", "prisma/schema.prisma",
    ], env);
    return { verified: true, migrations: "clean", schemaDiff: "none" };
  } finally {
    run("dropdb", [...connectionArgs, database]);
  }
}

function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
  const result = verifyMigrations(
    process.env.DATABASE_URL,
    process.env.ALLOW_CLEAN_MIGRATION_VERIFY,
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) main();

module.exports = { CONFIRMATION, assertSafeTarget, temporaryDatabaseName, verifyMigrations };
