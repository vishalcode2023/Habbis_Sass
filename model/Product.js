const mongoose = require("mongoose");
const { generateBarcode } = require("../utils/barcodeGenerator");

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
    stock: {
      quantity: { type: Number, default: 0, min: 0 },
    },
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
        publicId: { type: String }, // Cloudinary public_id for deletion
      },
    ],
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

// ─── Virtuals ───────────────────────────────────────────────────────────────

productSchema.virtual("isLowStock").get(function () {
  return this.stock.quantity <= this.minimumStock;
});

productSchema.virtual("stockValue").get(function () {
  return +(this.stock.quantity * this.pricing.purchasePrice).toFixed(2);
});

// ─── Pre-save hook: auto-generate barcode ───────────────────────────────────

productSchema.pre("save", function (next) {
  if (!this.barcode) {
    this.barcode = generateBarcode();
  }
  next();
});

// ─── Indexes ────────────────────────────────────────────────────────────────

productSchema.index({
  productName: "text",
  supplierName: "text",
  category: "text",
});
productSchema.index({ "stock.quantity": 1 });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
