// Session auth (Redis + cookie) — sinkron dengan backend-ac reference.
// Baca session_id dari cookie HttpOnly, ambil user payload dari Redis,
// set req.user. Tidak ada JWT.
const redis = require("../src/config/redis");

const parseCookie = (header, name) => {
  if (!header) return null;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

const auth = async (req, res, next) => {
  try {
    const sessionId = parseCookie(req.headers.cookie || "", "session_id");

    if (!sessionId) {
      return res.status(401).json({ message: "Unauthorized - No session" });
    }

    const data = await redis.get(`session:${sessionId}`);

    if (!data) {
      return res.status(401).json({ message: "Unauthorized - Session invalid" });
    }

    req.user = JSON.parse(data);
    next();
  } catch (error) {
    console.error("Session verification error:", error.message);
    return res.status(401).json({ message: "Unauthorized - Session invalid" });
  }
};

module.exports = auth;