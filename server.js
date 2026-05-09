require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const app = express();

const { error } = require("./utils/Apiresponse");

// ================= MIDDLEWARE =================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  }),
);

app.use(cookieParser());

// ================= CORS =================

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],

    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ================= LOGGER =================

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ================= HEALTH CHECK =================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ================= DATABASE =================

const connectDB = require("./config/MongoDBConfig");

// ================= ROUTES =================

const authRoutes = require("./router/authRoutes");

app.use("/api/auth", authRoutes);

app.use("/api/products", require("./router/Productroutes"));

app.use("/api/stock", require("./router/stockRoutes"));

app.use("/api/invoices", require("./router/invoiceRoutes"));

app.use("/api/sales", require("./router/Salesroutes"));

app.use("/api/analytics", require("./router/Analyticsroutes"));

// ================= 404 =================

app.use((req, res) => {
  return error(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
});

// ================= GLOBAL ERROR HANDLER =================

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.name === "MulterError") {
    return error(res, 400, `File upload error: ${err.message}`);
  }

  if (err.name === "CastError") {
    return error(res, 400, "Invalid ID format");
  }

  return error(res, err.status || 500, err.message || "Internal Server Error");
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Error starting server:", err);

    process.exit(1);
  }
};

startServer();
