/* Test helpers: boot server in-process, request helper, cleanup registry. */
const path = require("path");
const dotenv = require("dotenv");
const crypto = require("crypto");

process.env.PORT = process.env.TEST_PORT || "3199";
dotenv.config({ path: path.resolve(__dirname, ".env") });
// DB khusus test — wajib, jangan pernah pakai DB produksi
dotenv.config({ path: path.resolve(__dirname, ".env.test"), override: true });

// Pengaman: wajib DB test. Tolak boot kalau bukan.
if (!process.env.DATABASE_URL || !/test/.test(process.env.DATABASE_URL)) {
  throw new Error(
    "DATABASE_URL harus menunjuk DB test (mis. ac_system_test). Cek .env.test",
  );
}

const redis = require("./src/config/redis");
require("./src/index.js"); // boot server

const BASE = `http://localhost:${process.env.PORT}`;
const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const SESSION_TTL = Number(process.env.SESSION_TTL) || 8 * 60 * 60;

// Buat session Redis + kembalikan session_id (dipakai header Cookie).
// Async: dipanggil inline di api() yang sudah await.
async function token(roleuser = "superuser", section = "TEST", id = "11111111-1111-1111-1111-111111111111") {
  const sessionId = crypto.randomBytes(32).toString("hex");
  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({
      id,
      username: "tester_" + uniq,
      roleuser,
      depart: "QA",
      section,
    }),
    { EX: SESSION_TTL },
  );
  return sessionId;
}

const created = [];
function track(label, id) {
  if (id) created.push({ label, id });
}

async function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + "/__nonexistent__");
      if (res.status === 404) return;
    } catch {
      /* server belum siap */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server tidak boot dalam batas waktu");
}

async function api(method, route, body, t, headers = {}) {
  // t bisa string session_id (dari token() yang sudah await) atau Promise (token() inline)
  const sessionId = t ? await t : await token();
  const res = await fetch(BASE + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${sessionId}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, data, headers: Object.fromEntries(res.headers) };
}

const deleteRoute = {
  users: "/users/delete/",
  model: "/model/delete/",
  line: "/line/",
  pin: "/pin/delete/",
  bomlist: "/bomlist/delete/",
  uph: "/uph/delete/",
  registscan: "/registscan/delete/",
  recordscan: "/rdps/delete/",
  product_categories: "/product-categories/delete/",
};

async function cleanupAll() {
  for (const { label, id } of [...created].reverse()) {
    try {
      await api("DELETE", deleteRoute[label] + id);
    } catch {
      /* abaikan */
    }
  }
  // bersihkan counter lockout login biar tak bocor antar-run
  try {
    const keys = await redis.keys("login_fail:*");
    if (keys.length) await redis.del(keys);
  } catch {
    /* abaikan */
  }
}

module.exports = { api, token, track, waitForServer, cleanupAll, uniq };