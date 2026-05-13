const express = require("express");
const router = express.Router();
const jwtVerify = require("../middleware/jwtVerify");
const { adminOnly, billingOrAdmin } = require("../middleware/Rolemiddleware");
const validate = require("../middleware/Validate");
const {
  createReturnSchema,
  returnPaginationSchema,
} = require("../validations/ReturnValidation");
const {
  createReturn,
  getAllReturns,
  getReturn,
  getReturnsByInvoice,
} = require("../controller/Returncontroller");

router.use(jwtVerify);

// Create a return
router.post("/", billingOrAdmin, validate(createReturnSchema), createReturn);

// List all returns (filterable)
router.get(
  "/",
  billingOrAdmin,
  validate(returnPaginationSchema, "query"),
  getAllReturns,
);

// Get single return by its own _id
router.get("/:id", billingOrAdmin, getReturn);

// Get all returns for a specific invoice number
router.get("/invoice/:invoiceNo", billingOrAdmin, getReturnsByInvoice);

module.exports = router;
