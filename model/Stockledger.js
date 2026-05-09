const mongoose = require("mongoose");

const stockLedgerSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },
    type: {
      type: String,
      enum: ["PURCHASE", "SALE", "ADJUSTMENT"],
      required: [true, "Ledger type is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      // positive for PURCHASE/ADJUSTMENT-in, negative for SALE/ADJUSTMENT-out
    },
    quantityBefore: {
      type: Number,
      required: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
    },
    invoiceNo: {
      type: String,
      trim: true,
      index: true,
    },
    unitPrice: {
      type: Number,
      min: 0,
    },
    totalValue: {
      type: Number,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

stockLedgerSchema.index({ createdAt: -1 });
stockLedgerSchema.index({ productId: 1, createdAt: -1 });

const StockLedger = mongoose.model("StockLedger", stockLedgerSchema);
module.exports = StockLedger;
