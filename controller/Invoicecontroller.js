const mongoose = require("mongoose");
const Product = require("../model/Product");
const PurchaseInvoice = require("../model/Purchaseinvoice");
const { adjustStock } = require("./stockController");
const { success, error } = require("../utils/Apiresponse");
const { getPagination, buildMeta } = require("../utils/Pagination");

// ─── Create Purchase Invoice ──────────────────────────────────────────────────

exports.createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      supplierName,
      invoiceNo,
      invoiceDate,
      items,
      discountAmount = 0,
      notes,
    } = req.body;

    // Resolve products and compute amounts
    let subTotal = 0;
    let totalGst = 0;
    const enrichedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        await session.abortTransaction();
        return error(res, 404, `Product ${item.productId} not found`);
      }

      const itemGstPct = item.gstPercent ?? product.gstPercent ?? 0;
      const baseAmount = +(item.quantity * item.unitPrice).toFixed(2);
      const gstAmount = +((baseAmount * itemGstPct) / 100).toFixed(2);
      const totalAmount = +(baseAmount + gstAmount).toFixed(2);

      subTotal += baseAmount;
      totalGst += gstAmount;

      enrichedItems.push({
        productId: product._id,
        productName: product.productName,
        sku: product.sku,
        quantity: item.quantity,
        unitType: product.unitType,
        unitPrice: item.unitPrice,
        gstPercent: itemGstPct,
        gstAmount,
        totalAmount,
      });
    }

    const totalAmount = +(subTotal + totalGst - discountAmount).toFixed(2);

    // Build invoice image payload if uploaded
    const invoiceImage = req.file
      ? { url: req.file.path, publicId: req.file.filename }
      : undefined;

    const [invoice] = await PurchaseInvoice.create(
      [
        {
          supplierName,
          invoiceNo,
          invoiceDate,
          items: enrichedItems,
          subTotal: +subTotal.toFixed(2),
          gstAmount: +totalGst.toFixed(2),
          discountAmount,
          totalAmount,
          invoiceImage,
          notes,
          status: "CONFIRMED",
          createdBy: req.user.id,
        },
      ],
      { session },
    );

    // Update stock for each item
    for (const item of enrichedItems) {
      await adjustStock(session, {
        productId: item.productId,
        type: "PURCHASE",
        quantity: item.quantity,
        invoiceNo,
        unitPrice: item.unitPrice,
        note: `Purchase invoice ${invoiceNo}`,
        userId: req.user.id,
      });
    }

    await session.commitTransaction();
    return success(res, 201, "Purchase invoice created successfully", invoice);
  } catch (err) {
    await session.abortTransaction();
    if (err.code === 11000)
      return error(res, 409, "Invoice number already exists");
    return error(res, 500, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Get All Invoices ─────────────────────────────────────────────────────────

exports.getAllInvoices = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.supplierName)
      filter.supplierName = new RegExp(req.query.supplierName, "i");
    if (req.query.invoiceNo)
      filter.invoiceNo = new RegExp(req.query.invoiceNo, "i");
    if (req.query.status) filter.status = req.query.status;

    if (req.query.from || req.query.to) {
      filter.invoiceDate = {};
      if (req.query.from) filter.invoiceDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.invoiceDate.$lte = new Date(req.query.to);
    }

    const [invoices, total] = await Promise.all([
      PurchaseInvoice.find(filter)
        .populate("createdBy", "firstName lastName")
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseInvoice.countDocuments(filter),
    ]);

    return success(
      res,
      200,
      "Invoices fetched",
      invoices,
      buildMeta(total, page, limit),
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get Single Invoice ───────────────────────────────────────────────────────

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id)
      .populate("items.productId", "productName sku barcode unitType")
      .populate("createdBy", "firstName lastName email");

    if (!invoice) return error(res, 404, "Invoice not found");
    return success(res, 200, "Invoice fetched", invoice);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Cancel Invoice ────────────────────────────────────────────────────────────

exports.cancelInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id).session(
      session,
    );
    if (!invoice) return error(res, 404, "Invoice not found");
    if (invoice.status === "CANCELLED")
      return error(res, 400, "Invoice already cancelled");

    invoice.status = "CANCELLED";
    await invoice.save({ session });

    // Reverse stock for each item
    for (const item of invoice.items) {
      await adjustStock(session, {
        productId: item.productId,
        type: "SALE", // reversal
        quantity: item.quantity,
        invoiceNo: invoice.invoiceNo,
        note: `Reversal: cancelled invoice ${invoice.invoiceNo}`,
        userId: req.user.id,
      });
    }

    await session.commitTransaction();
    return success(res, 200, "Invoice cancelled and stock reversed");
  } catch (err) {
    await session.abortTransaction();
    return error(res, 500, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Invoice Summary (stats) ──────────────────────────────────────────────────

exports.getInvoiceSummary = async (req, res) => {
  try {
    const summary = await PurchaseInvoice.aggregate([
      { $match: { status: "CONFIRMED" } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalGst: { $sum: "$gstAmount" },
          avgInvoiceValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    return success(res, 200, "Invoice summary", summary[0] || {});
  } catch (err) {
    return error(res, 500, err.message);
  }
};
