const mongoose = require("mongoose");
const Product = require("../model/Product");
const SalesInvoice = require("../model/Salesinvoice");
const SalesReturn = require("../model/Salesreturn");
const StockLedger = require("../model/Stockledger");
const { success, error } = require("../utils/Apiresponse");
const { getPagination, buildMeta } = require("../utils/Pagination");

// ─── Create Return ────────────────────────────────────────────────────────────
// Body: { invoiceNo, items: [{ itemId, quantity, reason, restock }], refundMode, notes }
// items[].itemId  = the _id of the line item inside SalesInvoice.items
// items[].restock = true  → put stock back | false → damaged, don't restock

exports.createReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      invoiceNo,
      items, // array of { itemId, quantity, reason, restock }
      refundMode = "CASH",
      notes,
    } = req.body;

    if (!invoiceNo) return error(res, 400, "invoiceNo is required");
    if (!items || !items.length) return error(res, 400, "items are required");

    // ── 1. Load original invoice ──────────────────────────────────────────
    const invoice = await SalesInvoice.findOne({ invoiceNo }).session(session);
    if (!invoice) return error(res, 404, `Invoice ${invoiceNo} not found`);
    if (invoice.status === "CANCELLED")
      return error(res, 400, "Cannot return a cancelled invoice");

    // ── 2. Validate each return item against the original ─────────────────
    const enrichedItems = [];
    let refundSubTotal = 0;
    let refundGst = 0;

    for (const ri of items) {
      const origItem = invoice.items.find(
        (i) => i._id.toString() === ri.itemId,
      );
      if (!origItem)
        return error(res, 404, `Item ${ri.itemId} not in invoice ${invoiceNo}`);

      // Can't return more than originally sold
      const alreadyReturned = origItem.returnedQty || 0;
      const returnable = origItem.quantity - alreadyReturned;
      if (ri.quantity > returnable)
        return error(
          res,
          422,
          `"${origItem.productName}" — only ${returnable} unit(s) can be returned`,
        );

      // Compute refund proportionally
      const unitTotal = origItem.totalAmount / origItem.quantity; // inc GST
      const unitBase = origItem.unitPrice;
      const unitGst = unitTotal - unitBase;
      const lineRefund = +(ri.quantity * unitTotal).toFixed(2);
      const lineGst = +(ri.quantity * unitGst).toFixed(2);

      refundSubTotal += ri.quantity * unitBase;
      refundGst += lineGst;

      enrichedItems.push({
        originalItemId: origItem._id,
        productId: origItem.productId,
        variantId: origItem.variantId || null,
        productName: origItem.productName,
        sku: origItem.sku,
        size: origItem.size,
        color: origItem.color,
        quantity: ri.quantity,
        unitPrice: unitBase,
        gstPercent: origItem.gstPercent,
        gstAmount: lineGst,
        refundAmount: lineRefund,
        reason: ri.reason || "No reason provided",
        restock: ri.restock !== false, // default: restock = true
      });
    }

    const totalRefund = +(refundSubTotal + refundGst).toFixed(2);

    // ── 3. Restore stock where restock = true ─────────────────────────────
    for (const ri of enrichedItems) {
      if (!ri.restock) continue;

      const product = await Product.findById(ri.productId).session(session);
      if (!product) continue;

      if (ri.variantId) {
        const variant = product.variants.id(ri.variantId);
        if (variant) {
          const before = variant.stock.quantity;
          variant.stock.quantity += ri.quantity;
          await product.save({ session });
          await StockLedger.create(
            [
              {
                productId: ri.productId,
                type: "RETURN",
                quantity: +ri.quantity,
                quantityBefore: before,
                quantityAfter: before + ri.quantity,
                invoiceNo,
                unitPrice: ri.unitPrice,
                note: `Return from invoice ${invoiceNo} — ${ri.reason}`,
                createdBy: req.user.id,
              },
            ],
            { session },
          );
        }
      } else {
        const before = product.stock.quantity;
        product.stock.quantity += ri.quantity;
        await product.save({ session });
        await StockLedger.create(
          [
            {
              productId: ri.productId,
              type: "RETURN",
              quantity: +ri.quantity,
              quantityBefore: before,
              quantityAfter: before + ri.quantity,
              invoiceNo,
              unitPrice: ri.unitPrice,
              note: `Return from invoice ${invoiceNo} — ${ri.reason}`,
              createdBy: req.user.id,
            },
          ],
          { session },
        );
      }
    }

    // ── 4. Update returnedQty on the original invoice items ───────────────
    for (const ri of enrichedItems) {
      const origItem = invoice.items.find(
        (i) => i._id.toString() === ri.originalItemId.toString(),
      );
      origItem.returnedQty = (origItem.returnedQty || 0) + ri.quantity;
    }

    // Mark invoice as partially/fully returned
    const allReturned = invoice.items.every(
      (i) => (i.returnedQty || 0) >= i.quantity,
    );
    if (allReturned) invoice.status = "RETURNED";
    await invoice.save({ session });

    // ── 5. Persist return record ──────────────────────────────────────────
    const [returnDoc] = await SalesReturn.create(
      [
        {
          originalInvoiceNo: invoiceNo,
          originalInvoiceId: invoice._id,
          customerName: invoice.customerName,
          customerPhone: invoice.customerPhone,
          items: enrichedItems,
          subTotal: +refundSubTotal.toFixed(2),
          gstAmount: +refundGst.toFixed(2),
          totalRefund,
          refundMode,
          notes,
          processedBy: req.user.id,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return success(res, 201, "Return processed successfully", returnDoc);
  } catch (err) {
    await session.abortTransaction();
    return error(res, 500, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Get All Returns ──────────────────────────────────────────────────────────
exports.getAllReturns = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.invoiceNo)
      filter.originalInvoiceNo = new RegExp(req.query.invoiceNo, "i");
    if (req.query.customerName)
      filter.customerName = new RegExp(req.query.customerName, "i");
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [returns, total] = await Promise.all([
      SalesReturn.find(filter)
        .populate("processedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SalesReturn.countDocuments(filter),
    ]);

    return success(
      res,
      200,
      "Returns fetched",
      returns,
      buildMeta(total, page, limit),
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get Single Return ────────────────────────────────────────────────────────
exports.getReturn = async (req, res) => {
  try {
    const ret = await SalesReturn.findById(req.params.id).populate(
      "processedBy",
      "firstName lastName email",
    );
    if (!ret) return error(res, 404, "Return not found");
    return success(res, 200, "Return fetched", ret);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get Returns by Invoice ───────────────────────────────────────────────────
exports.getReturnsByInvoice = async (req, res) => {
  try {
    const returns = await SalesReturn.find({
      originalInvoiceNo: req.params.invoiceNo,
    })
      .populate("processedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();
    return success(res, 200, "Returns for invoice", returns);
  } catch (err) {
    return error(res, 500, err.message);
  }
};
