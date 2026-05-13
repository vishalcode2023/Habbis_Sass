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

// ✅ ADD THIS MIDDLEWARE — parses JSON strings from FormData before Joi validates
const parseProductBody = (req, res, next) => {
  try {
    if (typeof req.body.pricing === "string") {
      req.body.pricing = JSON.parse(req.body.pricing);
    }
    if (typeof req.body.stock === "string") {
      req.body.stock = JSON.parse(req.body.stock);
    }
    if (typeof req.body.variants === "string") {
      req.body.variants = JSON.parse(req.body.variants);
    }
    if (typeof req.body.availableSizes === "string") {
      try {
        req.body.availableSizes = JSON.parse(req.body.availableSizes);
      } catch {
        req.body.availableSizes = req.body.availableSizes
          .split(",")
          .map((s) => s.trim().toUpperCase());
      }
    }
    if (typeof req.body.availableColors === "string") {
      try {
        req.body.availableColors = JSON.parse(req.body.availableColors);
      } catch {
        req.body.availableColors = req.body.availableColors
          .split(",")
          .map((s) => s.trim());
      }
    }
    next();
  } catch (err) {
    return res
      .status(400)
      .json({ message: "Invalid JSON in body: " + err.message });
  }
};

// All routes require authentication
router.use(jwtVerify);

// ─── Billing search ───────────────────────────────────────────────────────────
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
  parseProductBody, // ✅ step 1: parse strings
  validate(productSchema), // ✅ step 2: now Joi sees real objects
  addProduct, // ✅ step 3: controller
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
  parseProductBody, // ✅ same fix for update
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
router.get("/:id/barcodes", billingOrAdmin, getBarcodeImages);
router.post("/:id/barcodes/regenerate", adminOnly, regenerateBarcodeImages);

module.exports = router;
