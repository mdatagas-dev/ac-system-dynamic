#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");
const {
  assertTestQuarantineWriteAllowed,
  persistQuarantineEntries,
  quarantineEntries,
  runPreflight,
} = require("./database-redesign-preflight");

async function main() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  assertTestQuarantineWriteAllowed(
    process.env.DATABASE_URL,
    process.env.ALLOW_TEST_QUARANTINE,
  );

  const prisma = require("../lib/prisma");
  try {
    const report = await runPreflight(prisma);
    const entries = quarantineEntries(report);
    const result = await persistQuarantineEntries(prisma, entries);
    process.stdout.write(
      `${JSON.stringify({ ...result, blocking: report.summary.blocking })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Database redesign quarantine failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
