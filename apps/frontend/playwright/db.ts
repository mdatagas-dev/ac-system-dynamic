const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl || !/test/i.test(databaseUrl)) {
  throw new Error("E2E_DATABASE_URL harus menunjuk database test; production database dilarang.");
}

export const E2E_DATABASE_URL = databaseUrl;
