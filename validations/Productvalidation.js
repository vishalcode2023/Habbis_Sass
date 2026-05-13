const Joi = require("joi");

// ─── Reusable sub-schemas ─────────────────────────────────────────────────────

const pricingSchema = Joi.object({
  purchasePrice: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  wholesalePrice: Joi.number().min(0).optional(),
});

const stockSchema = Joi.object({
  quantity: Joi.number().min(0).default(0),
});

const variantSchema = Joi.object({
  size: Joi.string().uppercase().optional().allow(""),
  color: Joi.string().optional().allow(""),
  colorCode: Joi.string()
    .pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .optional()
    .allow(""),
  stock: stockSchema.optional(),
  pricing: Joi.object({
    purchasePrice: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().min(0).optional(),
    wholesalePrice: Joi.number().min(0).optional(),
  }).optional(),
});

// ─── Add Product ──────────────────────────────────────────────────────────────

const productSchema = Joi.object({
  productName: Joi.string().trim().required(),
  category: Joi.string().trim().required(),
  subCategory: Joi.string().trim().optional().allow(""),
  sku: Joi.string().trim().uppercase().optional().allow(""),
  hsnCode: Joi.string().trim().optional().allow(""),
  unitType: Joi.string().valid("PCS", "MTR", "CUT", "ROLL").default("PCS"),
  gstPercent: Joi.number().valid(0, 5, 12, 18, 28).default(5),
  supplierName: Joi.string().trim().optional().allow(""),
  minimumStock: Joi.number().min(0).default(10),

  // Nested objects (already parsed by parseProductBody middleware)
  pricing: pricingSchema.required(),
  stock: stockSchema.optional(),

  // Variant-related arrays
  availableSizes: Joi.array()
    .items(Joi.string().uppercase())
    .optional()
    .default([]),
  availableColors: Joi.array().items(Joi.string()).optional().default([]),
  variants: Joi.array().items(variantSchema).optional().default([]),
});

// ─── Update Product ───────────────────────────────────────────────────────────

const updateProductSchema = Joi.object({
  productName: Joi.string().trim().optional(),
  category: Joi.string().trim().optional(),
  subCategory: Joi.string().trim().optional().allow(""),
  sku: Joi.string().trim().uppercase().optional().allow(""),
  hsnCode: Joi.string().trim().optional().allow(""),
  unitType: Joi.string().valid("PCS", "MTR", "CUT", "ROLL").optional(),
  gstPercent: Joi.number().valid(0, 5, 12, 18, 28).optional(),
  supplierName: Joi.string().trim().optional().allow(""),
  minimumStock: Joi.number().min(0).optional(),

  pricing: Joi.object({
    purchasePrice: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().min(0).optional(),
    wholesalePrice: Joi.number().min(0).optional(),
  }).optional(),
  stock: stockSchema.optional(),

  availableSizes: Joi.array().items(Joi.string().uppercase()).optional(),
  availableColors: Joi.array().items(Joi.string()).optional(),
  variants: Joi.array().items(variantSchema).optional(),
});

// ─── Bulk Insert ──────────────────────────────────────────────────────────────

const bulkProductSchema = Joi.object({
  products: Joi.array()
    .items(
      Joi.object({
        productName: Joi.string().trim().required(),
        category: Joi.string().trim().required(),
        subCategory: Joi.string().trim().optional().allow(""),
        sku: Joi.string().trim().uppercase().optional().allow(""),
        hsnCode: Joi.string().trim().optional().allow(""),
        unitType: Joi.string()
          .valid("PCS", "MTR", "CUT", "ROLL")
          .default("PCS"),
        gstPercent: Joi.number().valid(0, 5, 12, 18, 28).default(5),
        supplierName: Joi.string().trim().optional().allow(""),
        minimumStock: Joi.number().min(0).default(10),
        pricing: pricingSchema.required(),
        stock: stockSchema.optional(),
        availableSizes: Joi.array()
          .items(Joi.string().uppercase())
          .optional()
          .default([]),
        availableColors: Joi.array().items(Joi.string()).optional().default([]),
        variants: Joi.array().items(variantSchema).optional().default([]),
      }),
    )
    .min(1)
    .required(),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(15),
  search: Joi.string().trim().optional().allow(""),
  category: Joi.string().trim().optional().allow(""),
  sortBy: Joi.string().optional().allow(""),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

// ─── Add Variants ─────────────────────────────────────────────────────────────

const addVariantSchema = Joi.object({
  variants: Joi.array().items(variantSchema).min(1).required(),
});

// ─── Update Variant ───────────────────────────────────────────────────────────

const updateVariantSchema = Joi.object({
  size: Joi.string().uppercase().optional().allow(""),
  color: Joi.string().optional().allow(""),
  colorCode: Joi.string()
    .pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .optional()
    .allow(""),
  stock: stockSchema.optional(),
  pricing: Joi.object({
    purchasePrice: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().min(0).optional(),
    wholesalePrice: Joi.number().min(0).optional(),
  }).optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = {
  productSchema,
  updateProductSchema,
  bulkProductSchema,
  paginationSchema,
  addVariantSchema,
  updateVariantSchema,
};
