const express = require("express");
const router = express.Router();

const jwtVerify = require("../middleware/jwtVerify");
const { adminOnly, billingOrAdmin } = require("../middleware/Rolemiddleware");
const validate = require("../middleware/Validate");
const { uploadProductImages, uploadExcel } = require("../config/Cloudinary");

const {
  productSchema,
  updateProductSchema,
  bulkProductSchema,
  paginationSchema,
  addVariantSchema,
  updateVariantSchema,
} = require("../validations/Productvalidation");

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
  getSizes,
  getColors,
  addVariants,
  updateVariant,
  deleteVariant,
  regenerateBarcodeImages,
  getBarcodeImages,
  billingSearch,
} = require("../controller/Productcontroller");

// All routes require authentication
router.use(jwtVerify);

// ─── Billing search (name + barcode in one endpoint) ─────────────────────────
router.get("/billing/search", billingOrAdmin, billingSearch);

// ─── Utility / filter routes ──────────────────────────────────────────────────
router.get(
  "/low-stock",
  billingOrAdmin,
  validate(paginationSchema, "query"),
  getLowStockProducts,
);
router.get("/barcode/:barcode", billingOrAdmin, searchByBarcode);
router.get("/categories", billingOrAdmin, getCategories);
router.get("/sizes", billingOrAdmin, getSizes);
router.get("/colors", billingOrAdmin, getColors);

// ─── Bulk ─────────────────────────────────────────────────────────────────────
router.post(
  "/bulk",
  adminOnly,
  validate(bulkProductSchema),
  bulkInsertProducts,
);
router.post("/bulk-import", adminOnly, uploadExcel, excelBulkImport);

// ─── Product CRUD ─────────────────────────────────────────────────────────────
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

// ─── Variant management ───────────────────────────────────────────────────────
router.post(
  "/:id/variants",
  adminOnly,
  validate(addVariantSchema),
  addVariants,
);
router.put(
  "/:id/variants/:variantId",
  adminOnly,
  validate(updateVariantSchema),
  updateVariant,
);
router.delete("/:id/variants/:variantId", adminOnly, deleteVariant);

// ─── Barcode image routes ─────────────────────────────────────────────────────
// GET  /api/products/:id/barcodes          → fetch all barcode image URLs
// POST /api/products/:id/barcodes/regenerate → re-generate & re-upload images
router.get("/:id/barcodes", billingOrAdmin, getBarcodeImages);
router.post("/:id/barcodes/regenerate", adminOnly, regenerateBarcodeImages);

module.exports = router;
