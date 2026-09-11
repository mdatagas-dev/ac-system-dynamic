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
const dashboardRoutes = require("./routes/dashboard");
const exportsRoutes = require("./routes/exports");
const loginRoutes = require("./routes/login");
const registscanRoutes = require("./routes/rgscan");
const usersRoutes = require("./routes/users");
const modelRoutes = require("./routes/model");
const lineRoutes = require("./routes/line");
const pinRoutes = require("./routes/pin");
const bomlistRoutes = require("./routes/bomlist");
const uphRoutes = require("./routes/uph");
const productCategoriesRoutes = require("./routes/product-categories");
const modelRouteTemplatesRoutes = require("./routes/model-route-templates");

const redis = require("./config/redis");
const requirePermission = require("../middlewares/requirePermission");
const AppError = require("../lib/AppError");

const port = process.env.PORT;

// Origin boleh diakses — daftar dari env ALLOWED_ORIGINS (pisah koma),
// fallback ke daftar dev lokal bila env tidak diset.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [
      "http://localhost:3002",
      "http://localhost:3001",
      "http://localhost:3000",
      "http://36.93.58.122:3010",
      "http://127.0.0.1:3000",
      "http://192.168.0.45:3000",
      "http://192.168.0.45:3001",
      "http://192.168.0.45:3002",
      "http://192.128.69.69:3000",
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
    "X-PIN",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

app.use(logger);
app.use(cors(optionsCors));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

app.use("/auth", loginRoutes);
app.use("/users", auth, requirePermission("users:manage"), usersRoutes);
app.use("/bomlist", auth, bomlistRoutes);
app.use("/line", auth, lineRoutes);
app.use("/model", auth, modelRoutes);
app.use("/model-route-templates", auth, modelRouteTemplatesRoutes);
app.use("/pin", auth, pinRoutes);
app.use("/uph", auth, requirePermission("master-data:write"), uphRoutes);
app.use("/product-categories", auth, requirePermission("master-data:write"), productCategoriesRoutes);
app.use(
  "/registscan",
  auth,
  requirePermission(["registscan:read", "registscan:read-own", "registscan:write"]),
  registscanRoutes,
);
app.use("/rdps", auth, requirePermission("scan:read"), rdpsRoutes, dashboardRoutes, exportsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// global error handler — Express 5 async errors forward here automatically
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const expose = err instanceof AppError || status < 500;
  if (!expose) console.error("Unhandled error:", err);
  res.status(status).json({
    error: expose ? err.message : "Internal Server Error",
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
