const express = require("express");
const router = express.Router();

const jwtVerify = require("../middleware/jwtVerify");

const { adminOnly, billingOrAdmin } = require("../middleware/roleMiddleware");

const validate = require("../middleware/validate");

const { uploadSingleImage } = require("../config/cloudinary");

const { purchaseInvoiceSchema } = require("../validations/invoiceItemSchema");

const {
  createInvoice,
  getAllInvoices,
  getInvoice,
  cancelInvoice,
  getInvoiceSummary,
} = require("../controller/invoiceController");

// ================= PROTECTED ROUTES =================

router.use(jwtVerify);

// ================= CREATE INVOICE =================

router.post(
  "/",
  adminOnly,
  uploadSingleImage,
  validate(purchaseInvoiceSchema),
  createInvoice,
);

// ================= GET ROUTES =================

router.get("/", billingOrAdmin, getAllInvoices);

router.get("/summary", billingOrAdmin, getInvoiceSummary);

router.get("/:id", billingOrAdmin, getInvoice);

// ================= CANCEL INVOICE =================

router.patch("/:id/cancel", adminOnly, cancelInvoice);

module.exports = router;
