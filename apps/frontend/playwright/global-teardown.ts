/**
 * Hapus user E2E + data dummy dari database test.
 */
import { execFileSync } from "node:child_process";
import { E2E_DATABASE_URL } from "./db";

export default function globalTeardown() {
  const sql =
    "DELETE FROM recordscan_ac WHERE sn LIKE 'E2E-%'; DELETE FROM recordscan_wm WHERE sn LIKE 'E2E-%'; DELETE FROM recordscan WHERE sn LIKE 'E2E-%'; DELETE FROM registscan WHERE order_number LIKE 'E2E-%'; DELETE FROM bomlist WHERE model LIKE 'E2E-%'; DELETE FROM model WHERE model LIKE 'E2E-%'; DELETE FROM line WHERE line LIKE 'E2E-%'; DELETE FROM users WHERE username IN ('e2e_test','e2e_ppc');";
  execFileSync("psql", [E2E_DATABASE_URL, "-c", sql]);
  console.log("[e2e] cleanup selesai");
}
