const express = require("express");
const router = express.Router();

const jwtVerify = require("../middleware/jwtVerify");
const { adminOnly, billingOrAdmin } = require("../middleware/Rolemiddleware");
const validate = require("../middleware/validate");
const { uploadProductImages, uploadExcel } = require("../config/cloudinary");

const {
  productSchema,
  updateProductSchema,
  bulkProductSchema,
  paginationSchema,
} = require("../validations/productValidation");

const {
  addProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  bulkInsertProducts,
  searchByBarcode,
  getLowStockProducts,
  excelBulkImport,
  getCategories,
} = require("../controller/productController");

// All routes require authentication
router.use(jwtVerify);

// ─── Utility / special routes (before :id to avoid conflicts) ────────────────
router.get(
  "/low-stock",
  billingOrAdmin,
  validate(paginationSchema, "query"),
  getLowStockProducts,
);
router.get("/barcode/:barcode", billingOrAdmin, searchByBarcode);
router.get("/categories", billingOrAdmin, getCategories);

// ─── Bulk routes ──────────────────────────────────────────────────────────────
router.post(
  "/bulk",
  adminOnly,
  validate(bulkProductSchema),
  bulkInsertProducts,
);
router.post("/bulk-import", adminOnly, uploadExcel, excelBulkImport);

// ─── CRUD ─────────────────────────────────────────────────────────────────────
router.post(
  "/",
  adminOnly,
  uploadProductImages,
  validate(productSchema),
  addProduct,
);
router.get(
  "/",
  billingOrAdmin,
  validate(paginationSchema, "query"),
  getAllProducts,
);
router.get("/:id", billingOrAdmin, getProduct);
router.put(
  "/:id",
  adminOnly,
  uploadProductImages,
  validate(updateProductSchema),
  updateProduct,
);
router.delete("/:id", adminOnly, deleteProduct);

// ─── Image management ─────────────────────────────────────────────────────────
router.delete("/:id/images/:publicId", adminOnly, deleteProductImage);

module.exports = router;
