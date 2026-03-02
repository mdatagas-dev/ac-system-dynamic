const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL || "redis://:Idnas77%23@127.0.0.1:6379",
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
