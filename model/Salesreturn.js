const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema({
  originalItemId: { type: mongoose.Schema.Types.ObjectId },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  productName: { type: String, required: true },
  sku: { type: String },
  size: { type: String },
  color: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  gstPercent: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  refundAmount: { type: Number, required: true },
  reason: { type: String, default: "No reason provided" },
  restock: { type: Boolean, default: true },
});

const salesReturnSchema = new mongoose.Schema(
  {
    originalInvoiceNo: { type: String, required: true, index: true },
    originalInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesInvoice",
    },
    customerName: { type: String, default: "Walk-in Customer" },
    customerPhone: { type: String },
    items: [returnItemSchema],
    subTotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    totalRefund: { type: Number, required: true },
    refundMode: {
      type: String,
      enum: ["CASH", "CARD", "UPI", "STORE_CREDIT"],
      default: "CASH",
    },
    notes: { type: String },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

salesReturnSchema.index({ createdAt: -1 });
salesReturnSchema.index({ customerName: "text", originalInvoiceNo: "text" });

module.exports = mongoose.model("SalesReturn", salesReturnSchema);
