const SalesInvoice = require("../model/Salesinvoice");
const Product = require("../model/Product");
const StockLedger = require("../model/Stockledger");
const { success, error } = require("../utils/Apiresponse");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dateRange = (period, customFrom, customTo) => {
  const now = new Date();
  let from, to;

  switch (period) {
    case "today":
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    case "yesterday":
      from = new Date(now);
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      break;
    case "week":
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    case "custom":
      if (!customFrom || !customTo)
        throw new Error("custom period requires from & to");
      from = new Date(customFrom);
      from.setHours(0, 0, 0, 0);
      to = new Date(customTo);
      to.setHours(23, 59, 59, 999);
      break;
    default:
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
  }
  return { from, to };
};

// ─── 1. Sales Summary ─────────────────────────────────────────────────────────
// GET /api/analytics/sales?period=today|yesterday|week|month|last_month|year|custom
// Optional: &from=YYYY-MM-DD&to=YYYY-MM-DD  (for custom)

exports.salesSummary = async (req, res) => {
  try {
    const { period = "today", from: customFrom, to: customTo } = req.query;
    const { from, to } = dateRange(period, customFrom, customTo);

    const [current, invoices] = await Promise.all([
      SalesInvoice.aggregate([
        {
          $match: {
            status: "COMPLETED",
            invoiceDate: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: null,
            totalBills: { $sum: 1 },
            totalRevenue: { $sum: "$totalAmount" },
            totalGst: { $sum: "$gstAmount" },
            totalDiscount: { $sum: "$discountAmount" },
            totalItems: { $sum: { $size: "$items" } },
            avgBillValue: { $avg: "$totalAmount" },
            maxBill: { $max: "$totalAmount" },
            minBill: { $min: "$totalAmount" },
            cashRevenue: {
              $sum: {
                $cond: [{ $eq: ["$paymentMode", "CASH"] }, "$totalAmount", 0],
              },
            },
            cardRevenue: {
              $sum: {
                $cond: [{ $eq: ["$paymentMode", "CARD"] }, "$totalAmount", 0],
              },
            },
            upiRevenue: {
              $sum: {
                $cond: [{ $eq: ["$paymentMode", "UPI"] }, "$totalAmount", 0],
              },
            },
            splitRevenue: {
              $sum: {
                $cond: [{ $eq: ["$paymentMode", "SPLIT"] }, "$totalAmount", 0],
              },
            },
          },
        },
      ]),
      // Also return individual invoices for the period (last 50)
      SalesInvoice.find({
        status: "COMPLETED",
        invoiceDate: { $gte: from, $lte: to },
      })
        .sort({ invoiceDate: -1 })
        .limit(50)
        .select(
          "invoiceNo invoiceDate customerName customerPhone totalAmount paymentMode items",
        )
        .lean(),
    ]);

    const summary = current[0] || {
      totalBills: 0,
      totalRevenue: 0,
      totalGst: 0,
      totalDiscount: 0,
      totalItems: 0,
      avgBillValue: 0,
      maxBill: 0,
      minBill: 0,
      cashRevenue: 0,
      cardRevenue: 0,
      upiRevenue: 0,
      splitRevenue: 0,
    };

    return success(res, 200, `Sales summary — ${period}`, {
      period,
      from,
      to,
      summary,
      recentInvoices: invoices,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── 2. Sales Chart Data (daily breakdown) ────────────────────────────────────
// GET /api/analytics/sales/chart?period=week|month|year|custom
// Returns one data point per day — for drawing a revenue line/bar chart

exports.salesChart = async (req, res) => {
  try {
    const { period = "week", from: customFrom, to: customTo } = req.query;
    const { from, to } = dateRange(period, customFrom, customTo);

    const data = await SalesInvoice.aggregate([
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
            day: { $dayOfMonth: "$invoiceDate" },
          },
          revenue: { $sum: "$totalAmount" },
          bills: { $sum: 1 },
          discount: { $sum: "$discountAmount" },
          gst: { $sum: "$gstAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year: "$_id.year",
                  month: "$_id.month",
                  day: "$_id.day",
                },
              },
            },
          },
          revenue: { $round: ["$revenue", 2] },
          bills: 1,
          discount: { $round: ["$discount", 2] },
          gst: { $round: ["$gst", 2] },
        },
      },
    ]);

    return success(res, 200, "Sales chart data", { period, from, to, data });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── 3. Fast-Moving Products ──────────────────────────────────────────────────
// GET /api/analytics/fast-moving?period=week|month|year&limit=10
// Ranks products by total quantity sold in the period

exports.fastMovingProducts = async (req, res) => {
  try {
    const { period = "month", limit = 10 } = req.query;
    const { from, to } = dateRange(period);

    const data = await SalesInvoice.aggregate([
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          totalQtySold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalAmount" },
          totalBills: { $sum: 1 },
          avgUnitPrice: { $avg: "$items.unitPrice" },
          sizes: { $addToSet: "$items.size" },
          colors: { $addToSet: "$items.color" },
        },
      },
      { $sort: { totalQtySold: -1 } },
      { $limit: Number(limit) },
      // Join current stock
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      {
        $project: {
          productId: "$_id",
          productName: 1,
          totalQtySold: 1,
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalBills: 1,
          avgUnitPrice: { $round: ["$avgUnitPrice", 2] },
          sizes: {
            $filter: { input: "$sizes", as: "s", cond: { $ne: ["$$s", null] } },
          },
          colors: {
            $filter: {
              input: "$colors",
              as: "c",
              cond: { $ne: ["$$c", null] },
            },
          },
          currentStock: { $first: "$productDoc.stock.quantity" },
          minimumStock: { $first: "$productDoc.minimumStock" },
          category: { $first: "$productDoc.category" },
          isLowStock: {
            $lte: [
              { $first: "$productDoc.stock.quantity" },
              { $first: "$productDoc.minimumStock" },
            ],
          },
        },
      },
    ]);

    return success(res, 200, `Fast-moving products — ${period}`, {
      period,
      from,
      to,
      products: data,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── 4. Slow-Moving / Dead Stock ─────────────────────────────────────────────
// GET /api/analytics/slow-moving?days=30&limit=10
// Products with zero or very few sales in last N days but still have stock

exports.slowMovingProducts = async (req, res) => {
  try {
    const days = parseInt(req.query.days || 30, 10);
    const limit = parseInt(req.query.limit || 10, 10);
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    // Products sold in the period
    const soldIds = await SalesInvoice.aggregate([
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalQtySold: { $sum: "$items.quantity" },
        },
      },
    ]);
    const soldMap = Object.fromEntries(
      soldIds.map((s) => [s._id.toString(), s.totalQtySold]),
    );

    // All active products with stock > 0
    const products = await Product.find({
      isActive: true,
      "stock.quantity": { $gt: 0 },
    })
      .select("productName category sku barcode stock minimumStock pricing")
      .lean({ virtuals: true });

    const slow = products
      .map((p) => ({
        productId: p._id,
        productName: p.productName,
        category: p.category,
        sku: p.sku,
        barcode: p.barcode,
        currentStock: p.stock.quantity,
        minimumStock: p.minimumStock,
        stockValue: +(
          p.stock.quantity * (p.pricing?.purchasePrice || 0)
        ).toFixed(2),
        qtySoldInPeriod: soldMap[p._id.toString()] || 0,
      }))
      .filter((p) => p.qtySoldInPeriod === 0)
      .sort((a, b) => b.currentStock - a.currentStock)
      .slice(0, limit);

    return success(res, 200, `Slow-moving products (last ${days} days)`, {
      days,
      products: slow,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── 5. Low Stock Reminders ───────────────────────────────────────────────────
// GET /api/analytics/reminders?threshold=10
// Returns products at or below their minimumStock level
// Also handles variant-level low stock

exports.lowStockReminders = async (req, res) => {
  try {
    const globalThreshold = parseInt(req.query.threshold || 0, 10);

    const products = await Product.find({ isActive: true }).lean({
      virtuals: true,
    });

    const alerts = [];

    for (const p of products) {
      if (p.variants && p.variants.length > 0) {
        // Check each active variant
        for (const v of p.variants.filter((v) => v.isActive)) {
          const threshold = globalThreshold || p.minimumStock;
          if ((v.stock?.quantity ?? 0) <= threshold) {
            alerts.push({
              type: "variant",
              productId: p._id,
              productName: p.productName,
              category: p.category,
              variantId: v._id,
              size: v.size,
              color: v.color,
              sku: v.sku || p.sku,
              barcode: v.barcode || p.barcode,
              currentStock: v.stock?.quantity ?? 0,
              minimumStock: threshold,
              severity:
                (v.stock?.quantity ?? 0) === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
            });
          }
        }
      } else {
        // Product-level stock
        const threshold = globalThreshold || p.minimumStock;
        if (p.stock.quantity <= threshold) {
          alerts.push({
            type: "product",
            productId: p._id,
            productName: p.productName,
            category: p.category,
            sku: p.sku,
            barcode: p.barcode,
            currentStock: p.stock.quantity,
            minimumStock: threshold,
            severity: p.stock.quantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
          });
        }
      }
    }

    // Sort: OUT_OF_STOCK first, then by currentStock ascending
    alerts.sort((a, b) => {
      if (a.severity !== b.severity)
        return a.severity === "OUT_OF_STOCK" ? -1 : 1;
      return a.currentStock - b.currentStock;
    });

    return success(res, 200, "Low stock reminders", {
      total: alerts.length,
      outOfStock: alerts.filter((a) => a.severity === "OUT_OF_STOCK").length,
      lowStock: alerts.filter((a) => a.severity === "LOW_STOCK").length,
      alerts,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── 6. Category-wise Sales Breakdown ────────────────────────────────────────
// GET /api/analytics/by-category?period=month

exports.categoryBreakdown = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const { from, to } = dateRange(period);

    const data = await SalesInvoice.aggregate([
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      {
        $group: {
          _id: { $first: "$productDoc.category" },
          totalRevenue: { $sum: "$items.totalAmount" },
          totalQty: { $sum: "$items.quantity" },
          totalBills: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalQty: 1,
          totalBills: 1,
        },
      },
    ]);

    return success(res, 200, `Category breakdown — ${period}`, {
      period,
      from,
      to,
      categories: data,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── 7. Payment Mode Breakdown ────────────────────────────────────────────────
// GET /api/analytics/by-payment?period=month

exports.paymentBreakdown = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const { from, to } = dateRange(period);

    const data = await SalesInvoice.aggregate([
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      {
        $group: {
          _id: "$paymentMode",
          revenue: { $sum: "$totalAmount" },
          bills: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          _id: 0,
          mode: "$_id",
          revenue: { $round: ["$revenue", 2] },
          bills: 1,
        },
      },
    ]);

    return success(res, 200, `Payment breakdown — ${period}`, {
      period,
      from,
      to,
      payments: data,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── 8. Dashboard (all-in-one) ────────────────────────────────────────────────
// GET /api/analytics/dashboard
// Returns today, this week, this month summaries + fast movers + stock alerts
// One call to power the entire analytics dashboard

exports.dashboard = async (req, res) => {
  try {
    const { from: todayFrom, to: todayTo } = dateRange("today");
    const { from: weekFrom, to: weekTo } = dateRange("week");
    const { from: monthFrom, to: monthTo } = dateRange("month");

    const summaryPipeline = (from, to) => [
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalGst: { $sum: "$gstAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          avgBillValue: { $avg: "$totalAmount" },
          cashRevenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "CASH"] }, "$totalAmount", 0],
            },
          },
          cardRevenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "CARD"] }, "$totalAmount", 0],
            },
          },
          upiRevenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "UPI"] }, "$totalAmount", 0],
            },
          },
        },
      },
    ];

    const [
      todayData,
      weekData,
      monthData,
      weekChartData,
      fastMovers,
      stockAlerts,
      recentBills,
    ] = await Promise.all([
      // Summaries
      SalesInvoice.aggregate(summaryPipeline(todayFrom, todayTo)),
      SalesInvoice.aggregate(summaryPipeline(weekFrom, weekTo)),
      SalesInvoice.aggregate(summaryPipeline(monthFrom, monthTo)),

      // 7-day chart
      SalesInvoice.aggregate([
        {
          $match: {
            status: "COMPLETED",
            invoiceDate: { $gte: weekFrom, $lte: weekTo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$invoiceDate" },
              month: { $month: "$invoiceDate" },
              day: { $dayOfMonth: "$invoiceDate" },
            },
            revenue: { $sum: "$totalAmount" },
            bills: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        {
          $project: {
            _id: 0,
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: "$_id.day",
                  },
                },
              },
            },
            revenue: { $round: ["$revenue", 2] },
            bills: 1,
          },
        },
      ]),

      // Top 5 fast movers (this month)
      SalesInvoice.aggregate([
        {
          $match: {
            status: "COMPLETED",
            invoiceDate: { $gte: monthFrom, $lte: monthTo },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            totalQtySold: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.totalAmount" },
          },
        },
        { $sort: { totalQtySold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "p",
          },
        },
        {
          $project: {
            productId: "$_id",
            productName: 1,
            totalQtySold: 1,
            totalRevenue: { $round: ["$totalRevenue", 2] },
            currentStock: { $first: "$p.stock.quantity" },
            category: { $first: "$p.category" },
          },
        },
      ]),

      // Stock alerts (out of stock + low stock, max 20)
      (async () => {
        const products = await Product.find({ isActive: true }).lean({
          virtuals: true,
        });
        const alerts = [];
        for (const p of products) {
          if (p.variants && p.variants.length > 0) {
            for (const v of p.variants.filter((v) => v.isActive)) {
              if ((v.stock?.quantity ?? 0) <= p.minimumStock) {
                alerts.push({
                  productId: p._id,
                  productName: p.productName,
                  variantId: v._id,
                  size: v.size,
                  color: v.color,
                  currentStock: v.stock?.quantity ?? 0,
                  minimumStock: p.minimumStock,
                  severity:
                    (v.stock?.quantity ?? 0) === 0
                      ? "OUT_OF_STOCK"
                      : "LOW_STOCK",
                });
              }
            }
          } else {
            if (p.stock.quantity <= p.minimumStock) {
              alerts.push({
                productId: p._id,
                productName: p.productName,
                category: p.category,
                currentStock: p.stock.quantity,
                minimumStock: p.minimumStock,
                severity: p.stock.quantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
              });
            }
          }
        }
        alerts.sort((a, b) => {
          if (a.severity !== b.severity)
            return a.severity === "OUT_OF_STOCK" ? -1 : 1;
          return a.currentStock - b.currentStock;
        });
        return alerts.slice(0, 20);
      })(),

      // Last 10 bills today
      SalesInvoice.find({
        status: "COMPLETED",
        invoiceDate: { $gte: todayFrom, $lte: todayTo },
      })
        .sort({ invoiceDate: -1 })
        .limit(10)
        .select("invoiceNo invoiceDate customerName totalAmount paymentMode")
        .lean(),
    ]);

    const def = {
      totalBills: 0,
      totalRevenue: 0,
      totalGst: 0,
      totalDiscount: 0,
      avgBillValue: 0,
      cashRevenue: 0,
      cardRevenue: 0,
      upiRevenue: 0,
    };

    return success(res, 200, "Analytics dashboard", {
      today: todayData[0] || def,
      thisWeek: weekData[0] || def,
      thisMonth: monthData[0] || def,
      weekChart: weekChartData,
      fastMovers,
      stockAlerts: {
        total: stockAlerts.length,
        outOfStock: stockAlerts.filter((a) => a.severity === "OUT_OF_STOCK")
          .length,
        lowStock: stockAlerts.filter((a) => a.severity === "LOW_STOCK").length,
        items: stockAlerts,
      },
      recentBills,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Export: Sales Report (Excel) ─────────────────────────────────────────────
// GET /api/analytics/export/sales?period=month&from=&to=
exports.exportSalesReport = async (req, res) => {
  try {
    const XLSX = require("xlsx");
    const { period = "month", from: customFrom, to: customTo } = req.query;
    const { from, to } = dateRange(period, customFrom, customTo);

    const invoices = await SalesInvoice.find({
      status: "COMPLETED",
      invoiceDate: { $gte: from, $lte: to },
    })
      .sort({ invoiceDate: 1 })
      .lean();

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Invoice Summary ──
    const summaryRows = [
      [
        "Invoice No",
        "Date",
        "Customer",
        "Phone",
        "Sold By",
        "Items",
        "Subtotal",
        "GST",
        "Discount",
        "Total",
        "Payment",
        "Status",
      ],
    ];
    for (const inv of invoices) {
      summaryRows.push([
        inv.invoiceNo,
        new Date(inv.invoiceDate).toLocaleDateString("en-IN"),
        inv.customerName || "Walk-in",
        inv.customerPhone || "",
        inv.soldBy || "",
        inv.items?.length || 0,
        inv.subTotal || 0,
        inv.gstAmount || 0,
        inv.discountAmount || 0,
        inv.totalAmount || 0,
        inv.paymentMode,
        inv.status,
      ]);
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(summaryRows),
      "Sales Summary",
    );

    // ── Sheet 2: Item-level Detail ──
    const itemRows = [
      [
        "Invoice No",
        "Date",
        "Customer",
        "Sold By",
        "Product",
        "SKU",
        "Size",
        "Color",
        "Qty",
        "Unit",
        "Unit Price",
        "GST %",
        "GST Amt",
        "Discount",
        "Total",
      ],
    ];
    for (const inv of invoices) {
      for (const item of inv.items || []) {
        itemRows.push([
          inv.invoiceNo,
          new Date(inv.invoiceDate).toLocaleDateString("en-IN"),
          inv.customerName || "Walk-in",
          inv.soldBy || "",
          item.productName,
          item.sku || "",
          item.size || "",
          item.color || "",
          item.quantity,
          item.unitType || "PCS",
          item.unitPrice,
          item.gstPercent || 0,
          item.gstAmount || 0,
          item.discountAmount || 0,
          item.totalAmount,
        ]);
      }
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(itemRows),
      "Item Details",
    );

    // ── Sheet 3: GST Summary ──
    const gstMap = {};
    for (const inv of invoices) {
      for (const item of inv.items || []) {
        const k = item.gstPercent || 0;
        if (!gstMap[k]) gstMap[k] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
        const taxable = item.totalAmount - (item.gstAmount || 0);
        gstMap[k].taxable += taxable;
        gstMap[k].cgst += (item.gstAmount || 0) / 2;
        gstMap[k].sgst += (item.gstAmount || 0) / 2;
        gstMap[k].total += item.totalAmount;
      }
    }
    const gstRows = [
      [
        "GST Rate %",
        "Taxable Amount",
        "CGST",
        "SGST",
        "Total GST",
        "Grand Total",
      ],
    ];
    for (const [rate, d] of Object.entries(gstMap)) {
      gstRows.push([
        Number(rate),
        +d.taxable.toFixed(2),
        +d.cgst.toFixed(2),
        +d.sgst.toFixed(2),
        +(d.cgst + d.sgst).toFixed(2),
        +d.total.toFixed(2),
      ]);
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(gstRows),
      "GST Summary",
    );

    // ── Sheet 4: Salesperson Summary ──
    const staffMap = {};
    for (const inv of invoices) {
      const k = inv.soldBy || "Unknown";
      if (!staffMap[k]) staffMap[k] = { bills: 0, revenue: 0 };
      staffMap[k].bills++;
      staffMap[k].revenue += inv.totalAmount || 0;
    }
    const staffRows = [
      ["Sold By", "No. of Bills", "Total Revenue", "Avg Bill Value"],
    ];
    for (const [name, d] of Object.entries(staffMap)) {
      staffRows.push([
        name,
        d.bills,
        +d.revenue.toFixed(2),
        +(d.revenue / d.bills).toFixed(2),
      ]);
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(staffRows),
      "Salesperson Report",
    );

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const label = period === "custom" ? `${customFrom}_to_${customTo}` : period;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=HABIBS_Sales_${label}.xlsx`,
    );
    return res.send(buf);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Export: Tally Export (Excel) ─────────────────────────────────────────────
// GET /api/analytics/export/tally?period=month&from=&to=
exports.exportTallyReport = async (req, res) => {
  try {
    const XLSX = require("xlsx");
    const { period = "month", from: customFrom, to: customTo } = req.query;
    const { from, to } = dateRange(period, customFrom, customTo);

    const [invoices, products] = await Promise.all([
      SalesInvoice.find({
        status: "COMPLETED",
        invoiceDate: { $gte: from, $lte: to },
      })
        .sort({ invoiceDate: 1 })
        .lean(),
      require("../model/Product")
        .find({ isActive: true })
        .select(
          "productName category sku hsnCode unitType stock pricing gstPercent supplierName minimumStock",
        )
        .lean(),
    ]);

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Tally Sales Vouchers ──
    const salesRows = [
      [
        "Date",
        "Voucher Type",
        "Voucher No.",
        "Party Name",
        "Stock Item",
        "HSN Code",
        "Qty",
        "Unit",
        "Rate (Rs.)",
        "Taxable Amt (Rs.)",
        "GST %",
        "CGST (Rs.)",
        "SGST (Rs.)",
        "IGST (Rs.)",
        "Total Amt (Rs.)",
        "Ledger (Cr)",
      ],
    ];
    for (const inv of invoices) {
      for (const item of inv.items || []) {
        const taxable = item.totalAmount - (item.gstAmount || 0);
        salesRows.push([
          new Date(inv.invoiceDate).toLocaleDateString("en-IN"),
          "Sales",
          inv.invoiceNo,
          inv.customerName || "Walk-in Customer",
          item.productName,
          "",
          item.quantity,
          item.unitType || "PCS",
          item.unitPrice,
          +taxable.toFixed(2),
          item.gstPercent || 0,
          +((item.gstAmount || 0) / 2).toFixed(2),
          +((item.gstAmount || 0) / 2).toFixed(2),
          0,
          item.totalAmount,
          "Sales Account",
        ]);
      }
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(salesRows),
      "Tally Sales Vouchers",
    );

    // ── Sheet 2: Tally Stock Master ──
    const stockRows = [
      [
        "Name of Item",
        "Under (Stock Group)",
        "Units",
        "HSN Code",
        "GST Rate %",
        "Tax Type",
        "Opening Qty",
        "Opening Rate (Rs.)",
        "Opening Value (Rs.)",
        "Godown",
      ],
    ];
    for (const p of products) {
      const unit =
        p.unitType === "MTR"
          ? "Mtr"
          : p.unitType === "PCS"
            ? "Nos"
            : p.unitType;
      const qty = p.stock?.quantity || 0;
      const rate = p.pricing?.purchasePrice || 0;
      stockRows.push([
        p.productName,
        p.category,
        unit,
        p.hsnCode || "",
        p.gstPercent || 0,
        "GST",
        qty,
        rate,
        +(qty * rate).toFixed(2),
        "Main Location",
      ]);
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(stockRows),
      "Tally Stock Master",
    );

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const label = period === "custom" ? `${customFrom}_to_${customTo}` : period;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=HABIBS_Tally_${label}.xlsx`,
    );
    return res.send(buf);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Staff Sales Report ────────────────────────────────────────────────────────
// GET /api/analytics/staff?period=month
exports.staffReport = async (req, res) => {
  try {
    const { period = "month", from: customFrom, to: customTo } = req.query;
    const { from, to } = dateRange(period, customFrom, customTo);

    // Summary per staff member
    const staffSummary = await SalesInvoice.aggregate([
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      {
        $group: {
          _id: { $ifNull: ["$soldBy", "Unassigned"] },
          bills: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
          discount: { $sum: "$discountAmount" },
          itemsSold: { $sum: { $sum: "$items.quantity" } },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Product breakdown per staff
    const productBreakdown = await SalesInvoice.aggregate([
      {
        $match: { status: "COMPLETED", invoiceDate: { $gte: from, $lte: to } },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            soldBy: { $ifNull: ["$soldBy", "Unassigned"] },
            productName: "$items.productName",
            category: "$items.category",
          },
          qty: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalAmount" },
          bills: { $addToSet: "$invoiceNo" },
        },
      },
      { $sort: { "_id.soldBy": 1, revenue: -1 } },
    ]);

    // Map product breakdown per staff
    const breakdownMap = {};
    for (const row of productBreakdown) {
      const name = row._id.soldBy;
      if (!breakdownMap[name]) breakdownMap[name] = [];
      breakdownMap[name].push({
        productName: row._id.productName,
        qty: row.qty,
        revenue: +row.revenue.toFixed(2),
        bills: row.bills.length,
      });
    }

    const staff = staffSummary.map((s) => ({
      name: s._id,
      bills: s.bills,
      revenue: +s.revenue.toFixed(2),
      discount: +s.discount.toFixed(2),
      itemsSold: s.itemsSold,
      avgBill: +(s.revenue / s.bills).toFixed(2),
      products: (breakdownMap[s._id] || []).slice(0, 20),
      topProduct: breakdownMap[s._id]?.[0]?.productName || "—",
    }));

    return success(res, 200, "Staff report", {
      period: { from, to },
      staff,
      totalStaff: staff.filter((s) => s.name !== "Unassigned").length,
      totalBills: staff.reduce((s, x) => s + x.bills, 0),
      totalRevenue: +staff.reduce((s, x) => s + x.revenue, 0).toFixed(2),
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Export: Staff Performance Excel ──────────────────────────────────────────
// GET /api/analytics/export/staff?period=month
exports.exportStaffReport = async (req, res) => {
  try {
    const XLSX = require("xlsx");
    const { period = "month", from: customFrom, to: customTo } = req.query;
    const { from, to } = dateRange(period, customFrom, customTo);

    const invoices = await SalesInvoice.find({
      status: "COMPLETED",
      invoiceDate: { $gte: from, $lte: to },
    })
      .sort({ invoiceDate: 1 })
      .lean();

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryMap = {};
    for (const inv of invoices) {
      const k = inv.soldBy || "Unassigned";
      if (!summaryMap[k])
        summaryMap[k] = { bills: 0, revenue: 0, discount: 0, items: 0 };
      summaryMap[k].bills++;
      summaryMap[k].revenue += inv.totalAmount || 0;
      summaryMap[k].discount += inv.discountAmount || 0;
      summaryMap[k].items +=
        inv.items?.reduce((s, i) => s + i.quantity, 0) || 0;
    }
    const sumRows = [
      [
        "Staff Name",
        "Bills",
        "Revenue (Rs.)",
        "Discount (Rs.)",
        "Items Sold",
        "Avg Bill (Rs.)",
      ],
    ];
    for (const [name, d] of Object.entries(summaryMap)) {
      sumRows.push([
        name,
        d.bills,
        +d.revenue.toFixed(2),
        +d.discount.toFixed(2),
        d.items,
        +(d.revenue / d.bills).toFixed(2),
      ]);
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(sumRows),
      "Staff Summary",
    );

    // Product breakdown per staff
    const prodMap = {};
    for (const inv of invoices) {
      const k = inv.soldBy || "Unassigned";
      for (const item of inv.items || []) {
        const pk = `${k}|||${item.productName}`;
        if (!prodMap[pk])
          prodMap[pk] = {
            staff: k,
            product: item.productName,
            qty: 0,
            revenue: 0,
          };
        prodMap[pk].qty += item.quantity;
        prodMap[pk].revenue += item.totalAmount || 0;
      }
    }
    const prodRows = [["Staff Name", "Product", "Qty Sold", "Revenue (Rs.)"]];
    for (const d of Object.values(prodMap)) {
      prodRows.push([d.staff, d.product, d.qty, +d.revenue.toFixed(2)]);
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(prodRows),
      "Product Breakdown",
    );

    // Invoice list per staff
    const invRows = [
      [
        "Staff Name",
        "Invoice No",
        "Date",
        "Customer",
        "Items",
        "Total (Rs.)",
        "Payment",
      ],
    ];
    for (const inv of invoices) {
      invRows.push([
        inv.soldBy || "Unassigned",
        inv.invoiceNo,
        new Date(inv.invoiceDate).toLocaleDateString("en-IN"),
        inv.customerName || "Walk-in",
        inv.items?.length || 0,
        inv.totalAmount || 0,
        inv.paymentMode,
      ]);
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(invRows),
      "All Invoices",
    );

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const label = period === "custom" ? `${customFrom}_to_${customTo}` : period;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=HABIBS_Staff_${label}.xlsx`,
    );
    return res.send(buf);
  } catch (err) {
    return error(res, 500, err.message);
  }
};
