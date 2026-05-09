const mongoose = require("mongoose");
const XLSX = require("xlsx");
const Product = require("../model/Product");
const StockLedger = require("../model/StockLedger");
const { success, error } = require("../utils/apiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");
const { generateBarcode } = require("../utils/barcodeGenerator");
const { cloudinary } = require("../config/cloudinary");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildSearchFilter = (query) => {
  const filter = { isActive: true };

  if (query.search) {
    filter.$text = { $search: query.search };
  }
  if (query.category) filter.category = new RegExp(query.category, "i");
  if (query.supplierName)
    filter.supplierName = new RegExp(query.supplierName, "i");
  if (query.unitType) filter.unitType = query.unitType;

  return filter;
};

// ─── Add Product ─────────────────────────────────────────────────────────────

exports.addProduct = async (req, res) => {
  try {
    const images = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    const product = await Product.create({
      ...req.body,
      images,
      createdBy: req.user._id,
    });

    return success(res, 201, "Product created successfully", product);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return error(res, 409, `${field} already exists`);
    }
    return error(res, 500, err.message);
  }
};

// ─── Get All Products ─────────────────────────────────────────────────────────

exports.getAllProducts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = buildSearchFilter(req.query);

    const sortField = req.query.sortBy || "createdAt";
    const sortDir = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDir };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("createdBy", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Product.countDocuments(filter),
    ]);

    return success(
      res,
      200,
      "Products fetched",
      products,
      buildMeta(total, page, limit),
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get Single Product ───────────────────────────────────────────────────────

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate("createdBy", "firstName lastName email");

    if (!product) return error(res, 404, "Product not found");
    return success(res, 200, "Product fetched", product);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Update Product ───────────────────────────────────────────────────────────

exports.updateProduct = async (req, res) => {
  try {
    // Append new images if uploaded
    const newImages = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    const updatePayload = { ...req.body };
    if (newImages.length > 0) {
      updatePayload.$push = { images: { $each: newImages } };
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      newImages.length > 0
        ? { $set: updatePayload, $push: { images: { $each: newImages } } }
        : updatePayload,
      { new: true, runValidators: true },
    );

    if (!product) return error(res, 404, "Product not found");
    return success(res, 200, "Product updated", product);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return error(res, 409, `${field} already exists`);
    }
    return error(res, 500, err.message);
  }
};

// ─── Delete Product (soft delete) ────────────────────────────────────────────

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false },
      { new: true },
    );

    if (!product) return error(res, 404, "Product not found");
    return success(res, 200, "Product deleted successfully");
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Delete Product Image ─────────────────────────────────────────────────────

exports.deleteProductImage = async (req, res) => {
  try {
    const { id, publicId } = req.params;

    const product = await Product.findOne({ _id: id, isActive: true });
    if (!product) return error(res, 404, "Product not found");

    // Remove from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Remove from product
    product.images = product.images.filter((img) => img.publicId !== publicId);
    await product.save();

    return success(res, 200, "Image deleted", product);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Bulk Insert Products ─────────────────────────────────────────────────────

exports.bulkInsertProducts = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products } = req.body;

    const prepared = products.map((p) => ({
      ...p,
      barcode: generateBarcode(),
      createdBy: req.user._id,
    }));

    const inserted = await Product.insertMany(prepared, {
      session,
      ordered: false, // continue on individual errors
    });

    await session.commitTransaction();
    return success(res, 201, `${inserted.length} products inserted`, {
      insertedCount: inserted.length,
      products: inserted,
    });
  } catch (err) {
    await session.abortTransaction();
    // insertMany with ordered:false returns partial success in err.writeErrors
    if (err.name === "MongoBulkWriteError") {
      const inserted = err.result?.nInserted || 0;
      const failed = err.writeErrors?.length || 0;
      return error(
        res,
        207,
        `Partial insert: ${inserted} inserted, ${failed} failed`,
        {
          insertedCount: inserted,
          errors: err.writeErrors?.map((e) => ({
            index: e.index,
            message: e.errmsg,
          })),
        },
      );
    }
    return error(res, 500, err.message);
  } finally {
    session.endSession();
  }
};

// ─── Barcode Scan Search ──────────────────────────────────────────────────────

exports.searchByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const product = await Product.findOne({ barcode, isActive: true });
    if (!product) return error(res, 404, "No product found for this barcode");
    return success(res, 200, "Product found", product);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Low Stock Products ───────────────────────────────────────────────────────

exports.getLowStockProducts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    // Products where current qty <= minimumStock
    const filter = {
      isActive: true,
      $expr: { $lte: ["$stock.quantity", "$minimumStock"] },
    };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ "stock.quantity": 1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Product.countDocuments(filter),
    ]);

    return success(
      res,
      200,
      "Low stock products",
      products,
      buildMeta(total, page, limit),
    );
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Excel Bulk Import ────────────────────────────────────────────────────────

exports.excelBulkImport = async (req, res) => {
  try {
    if (!req.file) return error(res, 400, "Excel file is required");

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) return error(res, 400, "Excel file is empty");

    const REQUIRED = [
      "productName",
      "category",
      "unitType",
      "purchasePrice",
      "sellingPrice",
    ];
    const firstRow = rows[0];
    const missing = REQUIRED.filter((f) => !(f in firstRow));
    if (missing.length) {
      return error(res, 422, `Missing required columns: ${missing.join(", ")}`);
    }

    const prepared = rows.map((row, idx) => ({
      productName: row.productName,
      category: row.category,
      subCategory: row.subCategory || "",
      sku: row.sku ? String(row.sku).toUpperCase() : undefined,
      hsnCode: row.hsnCode ? String(row.hsnCode) : "",
      unitType: row.unitType || "PCS",
      stock: { quantity: Number(row.quantity) || 0 },
      pricing: {
        purchasePrice: Number(row.purchasePrice),
        sellingPrice: Number(row.sellingPrice),
        wholesalePrice: Number(row.wholesalePrice) || undefined,
      },
      gstPercent: Number(row.gstPercent) || 5,
      supplierName: row.supplierName || "",
      minimumStock: Number(row.minimumStock) || 10,
      barcode: generateBarcode(),
      createdBy: req.user._id,
    }));

    const inserted = await Product.insertMany(prepared, { ordered: false });

    return success(
      res,
      201,
      `${inserted.length} products imported from Excel`,
      {
        insertedCount: inserted.length,
        totalRows: rows.length,
      },
    );
  } catch (err) {
    if (err.name === "MongoBulkWriteError") {
      return error(res, 207, "Partial import", {
        insertedCount: err.result?.nInserted,
        errors: err.writeErrors?.map((e) => ({
          index: e.index,
          message: e.errmsg,
        })),
      });
    }
    return error(res, 500, err.message);
  }
};

// ─── Get Categories (distinct) ────────────────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct("category", { isActive: true });
    return success(res, 200, "Categories", categories);
  } catch (err) {
    return error(res, 500, err.message);
  }
};
