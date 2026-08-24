/**
 * Hapus user E2E + data dummy dari ac_production.
 */
import { execFileSync } from "node:child_process";

const DB = "postgresql://engineering@localhost:5433/ac_production";

export default function globalTeardown() {
  const sql =
    "DELETE FROM users WHERE username='e2e_test'; DELETE FROM model WHERE model LIKE 'E2E-%'; DELETE FROM line WHERE line LIKE 'E2E-%'; DELETE FROM bomlist WHERE model LIKE 'E2E-%'; DELETE FROM registscan WHERE order_number LIKE 'E2E-%'; DELETE FROM recordscan WHERE sn LIKE 'E2E-%';";
  execFileSync("psql", [DB, "-c", sql]);
  console.log("[e2e] cleanup selesai");
}
