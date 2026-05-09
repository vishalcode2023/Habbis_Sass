const mongoose = require("mongoose");
const Product = require("../model/Product");
const SalesInvoice = require("../model/SalesInvoice");
const StockLedger = require("../model/StockLedger");
const { success, error } = require("../utils/Apiresponse");
const { getPagination, buildMeta } = require("../utils/Pagination");

// ─── Auto-generate invoice number ────────────────────────────────────────────

const generateInvoiceNo = async () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const dateStr = `${yyyy}${mm}${dd}`;

  const prefix = `BILL-${dateStr}-`;
  const last = await SalesInvoice.findOne(
    { invoiceNo: new RegExp(`^${prefix}`) },
    { invoiceNo: 1 },
    { sort: { invoiceNo: -1 } },
  ).lean();

  let seq = 1;
  if (last) {
    const parts = last.invoiceNo.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
};

// ─── Internal: deduct stock (variant-aware) ───────────────────────────────────

const deductStock = async (
  session,
  { product, variantId, quantity, invoiceNo, unitPrice, note, userId },
) => {
  if (variantId) {
    // Variant-level stock
    const variant = product.variants.id(variantId);
    if (!variant)
      throw new Error(`Variant not found in product "${product.productName}"`);

    const before = variant.stock.quantity;
    if (before < quantity) {
      throw new Error(
        `Insufficient stock for "${product.productName}" (${variant.size || ""} ${variant.color || ""}). Available: ${before}, Requested: ${quantity}`,
      );
    }
    variant.stock.quantity = before - quantity;
    await product.save({ session });

    await StockLedger.create(
      [
        {
          productId: product._id,
          type: "SALE",
          quantity: -quantity,
          quantityBefore: before,
          quantityAfter: before - quantity,
          invoiceNo,
          unitPrice,
          totalValue: unitPrice
            ? +(quantity * unitPrice).toFixed(2)
            : undefined,
          note,
          createdBy: userId,
        },
      ],
      { session },
    );
  } else {
    // Product-level stock
    const before = product.stock.quantity;
    if (before < quantity) {
      throw new Error(
        `Insufficient stock for "${product.productName}". Available: ${before}, Requested: ${quantity}`,
      );
    }
    product.stock.quantity = before - quantity;
    await product.save({ session });

    await StockLedger.create(
      [
        {
          productId: product._id,
          type: "SALE",
          quantity: -quantity,
          quantityBefore: before,
          quantityAfter: before - quantity,
          invoiceNo,
          unitPrice,
          totalValue: unitPrice
            ? +(quantity * unitPrice).toFixed(2)
            : undefined,
          note,
          createdBy: userId,
        },
      ],
      { session },
    );
  }
};

// ─── Create Sale (Billing) ────────────────────────────────────────────────────

exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      customerName = "Walk-in Customer",
      customerPhone,
      items,
      discountAmount = 0,
      paymentMode = "CASH",
      amountPaid = 0,
      notes,
      invoiceDate,
    } = req.body;

    if (!items || !items.length) {
      await session.abortTransaction();
      return error(res, 400, "At least one item is required");
    }

    const invoiceNo = await generateInvoiceNo();

    let subTotal = 0;
    let totalGst = 0;
    const enrichedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        await session.abortTransaction();
        return error(res, 404, `Product ${item.productId} not found`);
      }

      // Resolve pricing from variant or product level
      let resolvedPrice = item.unitPrice;
      let variantRef = null;

      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant) {
          await session.abortTransaction();
          return error(res, 404, `Variant ${item.variantId} not found`);
        }
        variantRef = variant;
        if (!resolvedPrice)
          resolvedPrice =
            variant.pricing?.sellingPrice ?? product.pricing.sellingPrice;
      } else {
        if (!resolvedPrice) resolvedPrice = product.pricing.sellingPrice;
      }

      const gstPct = item.gstPercent ?? product.gstPercent ?? 0;
      const itemDiscount = item.itemDiscount || 0;
      const baseAmount = +(item.quantity * resolvedPrice).toFixed(2);
      const afterDiscount = +(baseAmount - itemDiscount).toFixed(2);
      const gstAmount = +((afterDiscount * gstPct) / 100).toFixed(2);
      const totalAmount = +(afterDiscount + gstAmount).toFixed(2);

      subTotal += afterDiscount;
      totalGst += gstAmount;

      enrichedItems.push({
        productId: product._id,
        variantId: variantRef ? variantRef._id : null,
        productName: product.productName,
        sku: variantRef?.sku || product.sku,
        size: variantRef?.size,
        color: variantRef?.color,
        barcode: variantRef?.barcode || product.barcode,
        quantity: item.quantity,
        unitType: product.unitType,
        unitPrice: resolvedPrice,
        mrp: variantRef?.pricing?.sellingPrice || product.pricing.sellingPrice,
        gstPercent: gstPct,
        gstAmount,
        discountAmount: itemDiscount,
        totalAmount,
      });

      // Deduct stock
      await deductStock(session, {
        product,
        variantId: item.variantId || null,
        quantity: item.quantity,
        invoiceNo,
        unitPrice: resolvedPrice,
        note: `Sale invoice ${invoiceNo}`,
        userId: req.user._id,
      });
    }

    const totalAmount = +(subTotal + totalGst - discountAmount).toFixed(2);
    const change = +(amountPaid - totalAmount).toFixed(2);

    const [invoice] = await SalesInvoice.create(
      [
        {
          invoiceNo,
          invoiceDate: invoiceDate || new Date(),
          customerName,
          customerPhone,
          items: enrichedItems,
          subTotal: +subTotal.toFixed(2),
          gstAmount: +totalGst.toFixed(2),
          discountAmount,
          totalAmount,
          amountPaid,
          changeAmount: Math.max(0, change),
          paymentMode,
          notes,
          status: "COMPLETED",
          createdBy: req.user._id,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return success(res, 201, "Sale created successfully", invoice);
  } catch (err) {
    await session.abortTransaction();
    if (err.code === 11000)
      return error(res, 409, "Invoice number conflict, please retry");
    if (err.message.includes("Insufficient"))
      return error(res, 422, err.message);
    return error(res, 500, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Get All Sales ────────────────────────────────────────────────────────────

exports.getAllSales = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.customerName)
      filter.customerName = new RegExp(req.query.customerName, "i");
    if (req.query.customerPhone)
      filter.customerPhone = new RegExp(req.query.customerPhone, "i");
    if (req.query.invoiceNo)
      filter.invoiceNo = new RegExp(req.query.invoiceNo, "i");
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentMode) filter.paymentMode = req.query.paymentMode;

    if (req.query.from || req.query.to) {
      filter.invoiceDate = {};
      if (req.query.from) filter.invoiceDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.invoiceDate.$lte = new Date(req.query.to);
    }

    const [sales, total] = await Promise.all([
      SalesInvoice.find(filter)
        .populate("createdBy", "firstName lastName")
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SalesInvoice.countDocuments(filter),
    ]);

    return success(
      res,
      200,
      "Sales fetched",
      sales,
      buildMeta(total, page, limit),
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get Single Sale ──────────────────────────────────────────────────────────

exports.getSale = async (req, res) => {
  try {
    const sale = await SalesInvoice.findById(req.params.id)
      .populate("items.productId", "productName sku barcode unitType")
      .populate("createdBy", "firstName lastName email");

    if (!sale) return error(res, 404, "Sale not found");
    return success(res, 200, "Sale fetched", sale);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get Sale by Invoice Number ───────────────────────────────────────────────

exports.getSaleByInvoiceNo = async (req, res) => {
  try {
    const sale = await SalesInvoice.findOne({ invoiceNo: req.params.invoiceNo })
      .populate("items.productId", "productName sku barcode unitType")
      .populate("createdBy", "firstName lastName");

    if (!sale) return error(res, 404, "Sale not found");
    return success(res, 200, "Sale fetched", sale);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Cancel Sale ──────────────────────────────────────────────────────────────

exports.cancelSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await SalesInvoice.findById(req.params.id).session(session);
    if (!sale) return error(res, 404, "Sale not found");
    if (sale.status === "CANCELLED")
      return error(res, 400, "Sale already cancelled");

    // Reverse stock for each item
    for (const item of sale.items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) continue;

      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (variant) {
          variant.stock.quantity += item.quantity;
          await product.save({ session });
        }
      } else {
        product.stock.quantity += item.quantity;
        await product.save({ session });
      }

      await StockLedger.create(
        [
          {
            productId: item.productId,
            type: "ADJUSTMENT",
            quantity: +item.quantity,
            quantityBefore:
              (item.variantId
                ? product.variants.id(item.variantId)?.stock?.quantity
                : product.stock.quantity) - item.quantity,
            quantityAfter: item.variantId
              ? product.variants.id(item.variantId)?.stock?.quantity
              : product.stock.quantity,
            invoiceNo: sale.invoiceNo,
            note: `Reversal: cancelled sale ${sale.invoiceNo}`,
            createdBy: req.user._id,
          },
        ],
        { session },
      );
    }

    sale.status = "CANCELLED";
    await sale.save({ session });

    await session.commitTransaction();
    return success(res, 200, "Sale cancelled and stock reversed");
  } catch (err) {
    await session.abortTransaction();
    return error(res, 500, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Daily Sales Summary ──────────────────────────────────────────────────────

exports.getDailySummary = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const summary = await SalesInvoice.aggregate([
      {
        $match: {
          status: "COMPLETED",
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalSales: { $sum: "$totalAmount" },
          totalGst: { $sum: "$gstAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "CASH"] }, "$totalAmount", 0],
            },
          },
          cardSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "CARD"] }, "$totalAmount", 0],
            },
          },
          upiSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "UPI"] }, "$totalAmount", 0],
            },
          },
          avgBillValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    return success(
      res,
      200,
      "Daily summary",
      summary[0] || {
        totalBills: 0,
        totalSales: 0,
        totalGst: 0,
        totalDiscount: 0,
        cashSales: 0,
        cardSales: 0,
        upiSales: 0,
        avgBillValue: 0,
      },
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Overall Sales Stats ──────────────────────────────────────────────────────

exports.getSalesStats = async (req, res) => {
  try {
    const summary = await SalesInvoice.aggregate([
      { $match: { status: "COMPLETED" } },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalGst: { $sum: "$gstAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          avgBillValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    return success(res, 200, "Sales stats", summary[0] || {});
  } catch (err) {
    return error(res, 500, err.message);
  }
};
