const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const express = require("express");
const app = express();
const logger = require("../middlewares/logger");
const auth = require("../middlewares/auth");
const cors = require("cors");

const rdpsRoutes = require("./routes/rdps");
const loginRoutes = require("./routes/login");
const registscanRoutes = require("./routes/rgscan");
const usersRoutes = require("./routes/users");
const modelRoutes = require("./routes/model");
const lineRoutes = require("./routes/line");
const pinRoutes = require("./routes/pin");
const bomlistRoutes = require("./routes/bomlist");
const uphRoutes = require("./routes/uph");
const productCategoriesRoutes = require("./routes/product-categories");
const componentsRoutes = require("./routes/components");

const redis = require("./config/redis");
const requirePermission = require("../middlewares/requirePermission");

const port = process.env.PORT;

const allowedOrigins = [
  "http://localhost:3002",
  "http://localhost:3001",
  "http://localhost:3000",
  "http://36.93.58.122:3010",
  "http://127.0.0.1:3000",
  "http://192.168.0.45:3000",
  "http://192.168.0.45:3001",
  "http://192.168.0.45:3002",
];

const optionsCors = {
  origin: function (origin, callback) {
    // allow non-browser tools (Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(null, false);
    }
  },
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "idregist",
    "iduser",
    "X-Requested-With",
    "Accept",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(logger);
app.use(cors(optionsCors));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

app.use("/login", loginRoutes);
app.use("/users", auth, requirePermission("users:manage"), usersRoutes);
app.use("/bomlist", auth, requirePermission("master-data:write"), bomlistRoutes);
app.use("/line", auth, requirePermission("master-data:write"), lineRoutes);
app.use("/model", auth, requirePermission("master-data:write"), modelRoutes);
app.use("/pin", auth, requirePermission("pin:manage"), pinRoutes);
app.use("/uph", auth, requirePermission("master-data:write"), uphRoutes);
app.use("/product-categories", auth, requirePermission("master-data:write"), productCategoriesRoutes);
app.use("/components", auth, requirePermission("master-data:write"), componentsRoutes);
app.use(
  "/registscan",
  auth,
  requirePermission(["registscan:read", "registscan:read-own", "registscan:write"]),
  registscanRoutes,
);
app.use("/rdps", auth, requirePermission("scan:read"), rdpsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(err.code ? { code: err.code } : {}),
  });
});

const startServer = async () => {
  try {
    await redis.connect();
    console.log("Redis connected");

    app.listen(port, () => {
      console.log("API running on port", port);
    });
  } catch (err) {
    console.error("Fatal: Redis not available", err);
  }
};

startServer();
