const express = require("express");
const router = express.Router();

const jwtVerify = require("../middleware/jwtVerify");
const { adminOnly, billingOrAdmin } = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { stockOperationSchema } = require("../validations/productValidation");

const {
  purchaseStock,
  saleStock,
  adjustStockManual,
  getStockLedger,
  getProductLedger,
} = require("../controller/stockController");

router.use(jwtVerify);

// Stock operations
router.post(
  "/purchase",
  adminOnly,
  validate(stockOperationSchema),
  purchaseStock,
);
router.post("/sale", billingOrAdmin, validate(stockOperationSchema), saleStock);
router.post("/adjustment", adminOnly, adjustStockManual);

// Ledger reads
router.get("/ledger", billingOrAdmin, getStockLedger);
router.get("/ledger/:productId", billingOrAdmin, getProductLedger);

module.exports = router;
