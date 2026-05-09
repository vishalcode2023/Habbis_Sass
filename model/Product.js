const mongoose = require("mongoose");
const { generateBarcode } = require("../utils/barcodeGenerator");

// ─── Variant Sub-Schema ──────────────────────────────────────────────────────
const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      trim: true,
      uppercase: true,
    },
    color: {
      type: String,
      trim: true,
    },
    colorCode: {
      type: String,
      trim: true,
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Invalid hex color code"],
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    stock: {
      quantity: { type: Number, default: 0, min: 0 },
    },
    pricing: {
      purchasePrice: { type: Number, min: 0 },
      sellingPrice: { type: Number, min: 0 },
      wholesalePrice: { type: Number, min: 0 },
    },
    // Cloudinary URLs for the generated barcode & QR images
    barcodeImage: {
      url: { type: String },
      publicId: { type: String },
    },
    qrImage: {
      url: { type: String },
      publicId: { type: String },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
);

// ─── Product Schema ──────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      unique: true,
      index: true,
    },
    hsnCode: {
      type: String,
      trim: true,
    },
    unitType: {
      type: String,
      enum: ["PCS", "MTR", "CUT", "ROLL"],
      required: [true, "Unit type is required"],
      default: "PCS",
    },

    // Master size/color lists for UI dropdowns
    availableSizes: {
      type: [String],
      default: [],
    },
    availableColors: {
      type: [String],
      default: [],
    },

    // Variants array — each variant = unique size+color combo
    // When populated: stock/pricing managed per-variant
    // When empty: product-level stock/pricing used
    variants: {
      type: [variantSchema],
      default: [],
    },

    // Product-level stock (used when no variants)
    stock: {
      quantity: { type: Number, default: 0, min: 0 },
    },

    // Product-level pricing (used when no variants / as fallback)
    pricing: {
      purchasePrice: {
        type: Number,
        required: [true, "Purchase price is required"],
        min: 0,
      },
      sellingPrice: {
        type: Number,
        required: [true, "Selling price is required"],
        min: 0,
      },
      wholesalePrice: { type: Number, min: 0 },
    },

    gstPercent: {
      type: Number,
      enum: [0, 5, 12, 18, 28],
      default: 5,
    },
    supplierName: {
      type: String,
      trim: true,
      index: true,
    },
    images: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],
    // Generated barcode & QR code images (product-level, for non-variant products)
    barcodeImage: {
      url: { type: String },
      publicId: { type: String },
    },
    qrImage: {
      url: { type: String },
      publicId: { type: String },
    },
    minimumStock: {
      type: Number,
      default: 10,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Virtuals ────────────────────────────────────────────────────────────────

productSchema.virtual("totalStock").get(function () {
  if (this.variants && this.variants.length > 0) {
    return this.variants
      .filter((v) => v.isActive)
      .reduce((sum, v) => sum + (v.stock?.quantity || 0), 0);
  }
  return this.stock.quantity;
});

productSchema.virtual("isLowStock").get(function () {
  const total =
    this.variants && this.variants.length > 0
      ? this.variants
          .filter((v) => v.isActive)
          .reduce((sum, v) => sum + (v.stock?.quantity || 0), 0)
      : this.stock.quantity;
  return total <= this.minimumStock;
});

productSchema.virtual("stockValue").get(function () {
  if (this.variants && this.variants.length > 0) {
    return +this.variants
      .filter((v) => v.isActive)
      .reduce((sum, v) => {
        const price = v.pricing?.purchasePrice ?? this.pricing.purchasePrice;
        return sum + (v.stock?.quantity || 0) * price;
      }, 0)
      .toFixed(2);
  }
  return +(this.stock.quantity * this.pricing.purchasePrice).toFixed(2);
});

productSchema.virtual("hasVariants").get(function () {
  return this.variants && this.variants.length > 0;
});

// ─── Pre-save: auto-generate barcodes ────────────────────────────────────────

productSchema.pre("save", function (next) {
  if (!this.barcode) {
    this.barcode = generateBarcode();
  }
  if (this.variants && this.variants.length > 0) {
    this.variants.forEach((v) => {
      if (!v.barcode) {
        v.barcode = generateBarcode();
      }
    });
  }
  next();
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

productSchema.index({
  productName: "text",
  supplierName: "text",
  category: "text",
});
productSchema.index({ "stock.quantity": 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ availableSizes: 1 });
productSchema.index({ availableColors: 1 });

productSchema.index({ "variants.sku": 1 });
productSchema.index({ "variants.color": 1 });
productSchema.index({ "variants.size": 1 });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
