const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    productName: { type: String, required: true }, // snapshot
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitType: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchaseInvoiceSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
      index: true,
    },
    invoiceNo: {
      type: String,
      required: [true, "Invoice number is required"],
      trim: true,
      unique: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
      required: [true, "Invoice date is required"],
    },
    items: {
      type: [invoiceItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one item is required",
      },
    },
    subTotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    invoiceImage: {
      url: { type: String },
      publicId: { type: String },
    },
    status: {
      type: String,
      enum: ["DRAFT", "CONFIRMED", "CANCELLED"],
      default: "CONFIRMED",
    },
    notes: { type: String, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

purchaseInvoiceSchema.index({ invoiceDate: -1 });
purchaseInvoiceSchema.index({ createdAt: -1 });

const PurchaseInvoice = mongoose.model(
  "PurchaseInvoice",
  purchaseInvoiceSchema,
);
module.exports = PurchaseInvoice;
