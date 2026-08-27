/**
 * Seed user E2E di DB ac_production (bcrypt hash precomputed).
 * execFileSync (tanpa shell) — hash berisi $ yang di-expand sh.
 */
import { execFileSync } from "node:child_process";

export const E2E_USER = {
  username: "e2e_test",
  password: "e2e_pass_2026",
  hash: "$2b$10$jv27RAvm/x7lbBOF/x9NDuEeRc2Twjk56t7RNRgfum0fOdQ/A2ODq",
};

export const E2E_PPC = {
  username: "e2e_ppc",
  password: "e2e_pass_2026",
  hash: "$2b$10$jv27RAvm/x7lbBOF/x9NDuEeRc2Twjk56t7RNRgfum0fOdQ/A2ODq",
};

const DB = "postgresql://acidjp@localhost:5432/ac_production";

export default function globalSetup() {
  const sql = `DELETE FROM users WHERE username IN ('${E2E_USER.username}','${E2E_PPC.username}'); INSERT INTO users (username, hash, email, roleuser, departement, section) VALUES ('${E2E_USER.username}', '${E2E_USER.hash}', 'e2e@test.id', 'superuser', 'QA', 'LINE IDU ASSY INPUT'), ('${E2E_PPC.username}', '${E2E_PPC.hash}', 'e2eppc@test.id', 'ppc', 'QA', 'LINE IDU ASSY INPUT')`;
  execFileSync("psql", [DB, "-c", sql]);
  console.log("[e2e] user disiapkan:", E2E_USER.username);
}
