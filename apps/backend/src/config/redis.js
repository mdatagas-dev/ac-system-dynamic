const { createClient } = require("redis");

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL tidak diset di .env");
}

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        return new Error("Retry limit reached");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

module.exports = redis;
