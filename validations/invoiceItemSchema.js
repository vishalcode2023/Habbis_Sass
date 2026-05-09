const Joi = require("joi");

const invoiceItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required().messages({
    "any.required": "Product ID is required for each item",
  }),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  gstPercent: Joi.number().valid(0, 5, 12, 18, 28).default(0),
});

const purchaseInvoiceSchema = Joi.object({
  supplierName: Joi.string().trim().min(2).max(150).required(),
  invoiceNo: Joi.string().trim().max(50).required(),
  invoiceDate: Joi.date().iso().required(),
  items: Joi.array().items(invoiceItemSchema).min(1).required().messages({
    "array.min": "At least one item is required",
    "any.required": "Items are required",
  }),
  discountAmount: Joi.number().min(0).default(0),
  notes: Joi.string().trim().max(500).optional().allow(""),
});

module.exports = { purchaseInvoiceSchema };
