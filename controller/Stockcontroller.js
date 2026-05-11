const mongoose = require("mongoose");
const Product = require("../model/Product");
const StockLedger = require("../model/Stockledger");
const { success, error } = require("../utils/Apiresponse");
const { getPagination, buildMeta } = require("../utils/Pagination");

// ─── Internal helper: adjust stock + write ledger entry (reusable in invoice) ─

const adjustStock = async (
  session,
  { productId, type, quantity, invoiceNo, unitPrice, note, userId },
) => {
  const product = await Product.findById(productId).session(session);
  if (!product) throw new Error(`Product ${productId} not found`);

  const delta = type === "SALE" ? -quantity : quantity;
  const newQty = product.stock.quantity + delta;

  if (newQty < 0) {
    throw new Error(
      `Insufficient stock for "${product.productName}". Available: ${product.stock.quantity}, Requested: ${quantity}`,
    );
  }

  const ledgerEntry = {
    productId,
    type,
    quantity: delta,
    quantityBefore: product.stock.quantity,
    quantityAfter: newQty,
    invoiceNo,
    unitPrice,
    totalValue: unitPrice ? +(quantity * unitPrice).toFixed(2) : undefined,
    note,
    createdBy: userId,
  };

  await Product.findByIdAndUpdate(
    productId,
    { $set: { "stock.quantity": newQty } },
    { session },
  );

  await StockLedger.create([ledgerEntry], { session });

  return { product, newQuantity: newQty };
};

// ─── Purchase Stock ───────────────────────────────────────────────────────────

exports.purchaseStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { productId, quantity, invoiceNo, unitPrice, note } = req.body;

    const { product, newQuantity } = await adjustStock(session, {
      productId,
      type: "PURCHASE",
      quantity,
      invoiceNo,
      unitPrice,
      note,
      userId: req.user.id,
    });

    await session.commitTransaction();
    return success(res, 200, "Stock purchased successfully", {
      productId,
      productName: product.productName,
      quantityAdded: quantity,
      newStockQuantity: newQuantity,
    });
  } catch (err) {
    await session.abortTransaction();
    const status = err.message.includes("not found")
      ? 404
      : err.message.includes("Insufficient")
        ? 422
        : 500;
    return error(res, status, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Sale Stock ───────────────────────────────────────────────────────────────

exports.saleStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { productId, quantity, invoiceNo, unitPrice, note } = req.body;

    const { product, newQuantity } = await adjustStock(session, {
      productId,
      type: "SALE",
      quantity,
      invoiceNo,
      unitPrice,
      note,
      userId: req.user.id,
    });

    await session.commitTransaction();
    return success(res, 200, "Stock sold successfully", {
      productId,
      productName: product.productName,
      quantitySold: quantity,
      newStockQuantity: newQuantity,
    });
  } catch (err) {
    await session.abortTransaction();
    const status = err.message.includes("not found")
      ? 404
      : err.message.includes("Insufficient")
        ? 422
        : 500;
    return error(res, status, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Manual Stock Adjustment ──────────────────────────────────────────────────

exports.adjustStockManual = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { productId, quantity, note } = req.body;
    // quantity can be positive (add) or negative (subtract)
    const absQty = Math.abs(quantity);
    const type = "ADJUSTMENT";

    const product = await Product.findById(productId).session(session);
    if (!product) return error(res, 404, "Product not found");

    const newQty = product.stock.quantity + quantity;
    if (newQty < 0) {
      await session.abortTransaction();
      return error(res, 422, "Adjustment would result in negative stock");
    }

    await Product.findByIdAndUpdate(
      productId,
      { $set: { "stock.quantity": newQty } },
      { session },
    );

    await StockLedger.create(
      [
        {
          productId,
          type,
          quantity,
          quantityBefore: product.stock.quantity,
          quantityAfter: newQty,
          note,
          createdBy: req.user.id,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return success(res, 200, "Stock adjusted", {
      productId,
      productName: product.productName,
      adjustment: quantity,
      newStockQuantity: newQty,
    });
  } catch (err) {
    await session.abortTransaction();
    return error(res, 500, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Get Stock Ledger (with filter + pagination) ──────────────────────────────

exports.getStockLedger = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.productId) filter.productId = req.query.productId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.invoiceNo)
      filter.invoiceNo = new RegExp(req.query.invoiceNo, "i");

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [ledger, total] = await Promise.all([
      StockLedger.find(filter)
        .populate("productId", "productName sku barcode unitType")
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockLedger.countDocuments(filter),
    ]);

    return success(
      res,
      200,
      "Stock ledger",
      ledger,
      buildMeta(total, page, limit),
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get Ledger for Single Product ───────────────────────────────────────────

exports.getProductLedger = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { productId: req.params.productId };

    const [ledger, total] = await Promise.all([
      StockLedger.find(filter)
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockLedger.countDocuments(filter),
    ]);

    return success(
      res,
      200,
      "Product ledger",
      ledger,
      buildMeta(total, page, limit),
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// Export adjustStock for use in invoice controller
module.exports.adjustStock = adjustStock;
