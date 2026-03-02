const express = require("express");
const app = express();
const dotenv = require("dotenv");
const logger = require("../middlewares/logger");
const auth = require("../middlewares/auth");
const cors = require("cors");
const path = require("path");

const rdpsRoutes = require("./routes/rdps");
const loginRoutes = require("./routes/login");
const registscanRoutes = require("./routes/rgscan");
const usersRoutes = require("./routes/users");
const modelRoutes = require("./routes/model");
const lineRoutes = require("./routes/line");
const pinRoutes = require("./routes/pin");
const bomlistRoutes = require("./routes/bomlist");

const redis = require("./config/redis");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const port = process.env.PORT;

const allowedOrigins = [
  "http://localhost:3002",
  "http://localhost:3001",
  "http://localhost:3000",
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
app.use("/users", auth, usersRoutes);
app.use("/bomlist", auth, bomlistRoutes);
app.use("/line", auth, lineRoutes);
app.use("/model", auth, modelRoutes);
app.use("/pin", auth, pinRoutes);
app.use("/rdps", auth, rdpsRoutes);
app.use("/registscan", auth, registscanRoutes);

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
