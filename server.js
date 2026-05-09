require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const morgan = require("morgan");

const { error } = require("./utils/Apiresponse");

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  cors({
    origin: "http://localhost:5173", // Update this to match your frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Database connection
const connectDB = require("./config/MongoDBConfig");

// Auth routes
const authRoutes = require("./router/authRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/auth", require("./router/authRoutes"));
app.use("/api/products", require("./router/Productroutes"));
app.use("/api/stock", require("./router/stockRoutes"));
app.use("/api/invoices", require("./router/invoiceRoutes"));

app.use((req, res) => {
  return error(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  // Multer errors
  if (err.name === "MulterError") {
    return error(res, 400, `File upload error: ${err.message}`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return error(res, 400, `Invalid ID format`);
  }

  return error(res, err.status || 500, err.message || "Internal Server Error");
});

const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1); // Exit the process with failure
  }
};
startServer();
