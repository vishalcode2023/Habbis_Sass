const Joi = require("joi");

const createReturnSchema = Joi.object({
  invoiceNo: Joi.string().trim().required(),
  refundMode: Joi.string()
    .valid("CASH", "CARD", "UPI", "STORE_CREDIT")
    .default("CASH"),
  notes: Joi.string().trim().optional().allow(""),
  items: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.string().trim().required(),
        quantity: Joi.number().integer().min(1).required(),
        reason: Joi.string().trim().optional().allow(""),
        restock: Joi.boolean().default(true),
      }),
    )
    .min(1)
    .required(),
});

const returnPaginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(15),
  invoiceNo: Joi.string().trim().optional().allow(""),
  customerName: Joi.string().trim().optional().allow(""),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});

module.exports = { createReturnSchema, returnPaginationSchema };
