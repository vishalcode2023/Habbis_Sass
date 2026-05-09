const Joi = require("joi");

// ─── Variant schema ───────────────────────────────────────────────────────────
const variantSchema = Joi.object({
  size: Joi.string().trim().uppercase().max(30).optional().allow(""),
  color: Joi.string().trim().max(50).optional().allow(""),
  colorCode: Joi.string()
    .trim()
    .pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .optional()
    .allow("")
    .messages({
      "string.pattern.base": "colorCode must be a valid hex e.g. #FF0000",
    }),
  sku: Joi.string().trim().uppercase().max(50).optional().allow(""),
  barcode: Joi.string().trim().optional().allow(""),
  stock: Joi.object({
    quantity: Joi.number().min(0).default(0),
  }).optional(),
  pricing: Joi.object({
    purchasePrice: Joi.number().min(0).optional(),
    sellingPrice: Joi.number().min(0).optional(),
    wholesalePrice: Joi.number().min(0).optional(),
  }).optional(),
  isActive: Joi.boolean().default(true),
});

// ─── Product schema ───────────────────────────────────────────────────────────
const productSchema = Joi.object({
  productName: Joi.string().trim().min(2).max(150).required().messages({
    "any.required": "Product name is required",
    "string.min": "Product name must be at least 2 characters",
  }),
  category: Joi.string().trim().min(2).max(80).required().messages({
    "any.required": "Category is required",
  }),
  subCategory: Joi.string().trim().max(80).optional().allow(""),
  sku: Joi.string().trim().uppercase().max(50).optional().allow(""),
  hsnCode: Joi.string().trim().max(20).optional().allow(""),
  unitType: Joi.string().valid("PCS", "MTR", "CUT", "ROLL").default("PCS"),

  // Size & Color master lists
  availableSizes: Joi.array()
    .items(Joi.string().trim().uppercase().max(30))
    .optional()
    .messages({ "array.base": "availableSizes must be an array of strings" }),
  availableColors: Joi.array()
    .items(Joi.string().trim().max(50))
    .optional()
    .messages({ "array.base": "availableColors must be an array of strings" }),

  // Variants
  variants: Joi.array().items(variantSchema).optional(),

  // Product-level stock (ignored when variants are used)
  stock: Joi.object({
    quantity: Joi.number().min(0).default(0),
  }).optional(),

  // Product-level pricing (required — acts as default for variants too)
  pricing: Joi.object({
    purchasePrice: Joi.number().min(0).required().messages({
      "any.required": "Purchase price is required",
    }),
    sellingPrice: Joi.number().min(0).required().messages({
      "any.required": "Selling price is required",
    }),
    wholesalePrice: Joi.number().min(0).optional(),
  }).required(),

  gstPercent: Joi.number().valid(0, 5, 12, 18, 28).default(5),
  supplierName: Joi.string().trim().max(150).optional().allow(""),
  minimumStock: Joi.number().min(0).default(10),
});

const updateProductSchema = productSchema.fork(
  ["productName", "category", "pricing"],
  (field) => field.optional(),
);

const bulkProductSchema = Joi.object({
  products: Joi.array()
    .items(productSchema)
    .min(1)
    .max(500)
    .required()
    .messages({
      "any.required": "products array is required",
      "array.min": "At least one product is required",
      "array.max": "Cannot insert more than 500 products at once",
    }),
});

const stockOperationSchema = Joi.object({
  productId: Joi.string().hex().length(24).required().messages({
    "any.required": "Product ID is required",
  }),
  variantId: Joi.string().hex().length(24).optional().messages({
    "string.hex": "variantId must be a valid ObjectId",
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    "any.required": "Quantity is required",
    "number.min": "Quantity must be at least 1",
  }),
  invoiceNo: Joi.string().trim().max(50).optional().allow(""),
  unitPrice: Joi.number().min(0).optional(),
  note: Joi.string().trim().max(255).optional().allow(""),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).optional().allow(""),
  category: Joi.string().trim().optional().allow(""),
  supplierName: Joi.string().trim().optional().allow(""),
  unitType: Joi.string().valid("PCS", "MTR", "CUT", "ROLL").optional(),
  size: Joi.string().trim().uppercase().optional().allow(""),
  color: Joi.string().trim().optional().allow(""),
  sortBy: Joi.string()
    .valid("productName", "createdAt", "stock.quantity", "pricing.sellingPrice")
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

// ─── Variant add/update schemas ───────────────────────────────────────────────
const addVariantSchema = Joi.object({
  variants: Joi.array().items(variantSchema).min(1).required().messages({
    "any.required": "variants array is required",
    "array.min": "At least one variant is required",
  }),
});

const updateVariantSchema = variantSchema.fork(["size", "color"], (field) =>
  field.optional(),
);

module.exports = {
  productSchema,
  updateProductSchema,
  bulkProductSchema,
  stockOperationSchema,
  paginationSchema,
  addVariantSchema,
  updateVariantSchema,
};
