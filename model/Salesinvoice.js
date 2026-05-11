const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    productName: { type: String, required: true },
    sku: { type: String },
    size: { type: String },
    color: { type: String },
    barcode: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitType: { type: String, default: "PCS" },
    unitPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    gstPercent: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const salesInvoiceSchema = new mongoose.Schema(
  {
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
      default: Date.now,
    },
    customerName: {
      type: String,
      trim: true,
      default: "Walk-in Customer",
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one item is required",
      },
    },
    subTotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    changeAmount: { type: Number, default: 0 },
    paymentMode: {
      type: String,
      enum: ["CASH", "CARD", "UPI", "SPLIT"],
      default: "CASH",
    },
    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED"],
      default: "COMPLETED",
    },
    soldBy: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

salesInvoiceSchema.index({ invoiceDate: -1 });
salesInvoiceSchema.index({ createdAt: -1 });
salesInvoiceSchema.index({ customerPhone: 1 });

const SalesInvoice = mongoose.model("SalesInvoice", salesInvoiceSchema);
module.exports = SalesInvoice;
