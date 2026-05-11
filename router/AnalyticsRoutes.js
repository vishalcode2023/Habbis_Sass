const express = require("express");
const router = express.Router();

const jwtVerify = require("../middleware/jwtVerify");
const { billingOrAdmin } = require("../middleware/Rolemiddleware");

const {
  salesSummary,
  salesChart,
  fastMovingProducts,
  slowMovingProducts,
  lowStockReminders,
  categoryBreakdown,
  paymentBreakdown,
  dashboard,
  exportSalesReport,
  exportTallyReport,
  staffReport,
  exportStaffReport,
} = require("../controller/Analyticscontroller");

router.use(jwtVerify);
router.use(billingOrAdmin);

// Dashboard (all-in-one — call this for the analytics screen)
router.get("/dashboard", dashboard);

// Individual endpoints
router.get("/sales", salesSummary); // ?period=today|week|month|year|custom
router.get("/sales/chart", salesChart); // ?period=week|month
router.get("/fast-moving", fastMovingProducts); // ?period=month&limit=10
router.get("/slow-moving", slowMovingProducts); // ?days=30&limit=10
router.get("/reminders", lowStockReminders); // ?threshold=5
router.get("/by-category", categoryBreakdown); // ?period=month
router.get("/by-payment", paymentBreakdown); // ?period=month

// Exports
router.get("/export/sales", exportSalesReport); // ?period=month  → .xlsx download
router.get("/export/tally", exportTallyReport); // ?period=month  → .xlsx download

// Staff
router.get("/staff", staffReport);
router.get("/export/staff", exportStaffReport);

module.exports = router;
