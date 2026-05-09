const express = require("express");
const router = express.Router();

const jwtVerify = require("../middleware/jwtVerify");
const { billingOrAdmin, adminOnly } = require("../middleware/Rolemiddleware");

const {
  createSale,
  getAllSales,
  getSale,
  getSaleByInvoiceNo,
  cancelSale,
  getDailySummary,
  getSalesStats,
} = require("../controller/Salescontroller");

router.use(jwtVerify);

// Stats & summary
router.get("/summary/daily", billingOrAdmin, getDailySummary);
router.get("/summary/stats", billingOrAdmin, getSalesStats);

// CRUD
router.post("/", billingOrAdmin, createSale);
router.get("/", billingOrAdmin, getAllSales);
router.get("/invoice/:invoiceNo", billingOrAdmin, getSaleByInvoiceNo);
router.get("/:id", billingOrAdmin, getSale);
router.patch("/:id/cancel", adminOnly, cancelSale);

module.exports = router;
