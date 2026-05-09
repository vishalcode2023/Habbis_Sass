const mongoose = require("mongoose");
const XLSX = require("xlsx");
const Product = require("../model/Product");
const StockLedger = require("../model/StockLedger");
const { success, error } = require("../utils/apiResponse");
const { getPagination, buildMeta } = require("../utils/pagination");
const { generateBarcode } = require("../Barcode/BarcodeImageGenerator");
const { cloudinary } = require("../config/cloudinary");
const {
  generateAndUploadBarcode,
  deleteBarcodeImages,
} = require("../Barcode/BarcodeImageGenerator");

// ─── Internal: generate barcode images for a product and all its variants ─────
const attachBarcodeImages = async (product) => {
  try {
    // Product-level barcode image (always generated)
    if (product.barcode) {
      const label = product.productName;
      const result = await generateAndUploadBarcode(
        product.barcode,
        label,
        "habbis/barcodes",
      );
      product.barcodeImage = result.barcode;
      product.qrImage = result.qr;
    }

    // Per-variant barcode images
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.barcode) {
          const label = `${product.productName}${variant.size ? " " + variant.size : ""}${variant.color ? " " + variant.color : ""}`;
          const result = await generateAndUploadBarcode(
            variant.barcode,
            label,
            "habbis/barcodes/variants",
          );
          variant.barcodeImage = result.barcode;
          variant.qrImage = result.qr;
        }
      }
    }

    await product.save();
  } catch (err) {
    // Non-fatal: log but don't crash the request
    console.error("Barcode image generation failed:", err.message);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildSearchFilter = (query) => {
  const filter = { isActive: true };

  if (query.search) filter.$text = { $search: query.search };
  if (query.category) filter.category = new RegExp(query.category, "i");
  if (query.supplierName)
    filter.supplierName = new RegExp(query.supplierName, "i");
  if (query.unitType) filter.unitType = query.unitType;

  // Filter by size — matches products that have this size in availableSizes
  // OR in any active variant
  if (query.size) {
    filter.$or = [
      { availableSizes: query.size.toUpperCase() },
      { "variants.size": query.size.toUpperCase(), "variants.isActive": true },
    ];
  }

  // Filter by color
  if (query.color) {
    const colorRegex = new RegExp(query.color, "i");
    filter.$or = filter.$or
      ? [...filter.$or]
      : [
          { availableColors: colorRegex },
          { "variants.color": colorRegex, "variants.isActive": true },
        ];
  }

  return filter;
};

// ─── Add Product ──────────────────────────────────────────────────────────────

exports.addProduct = async (req, res) => {
  try {
    const images = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    // Parse variants/arrays if sent as JSON strings (multipart/form-data)
    const body = { ...req.body };
    if (typeof body.variants === "string") {
      try {
        body.variants = JSON.parse(body.variants);
      } catch (_) {}
    }
    if (typeof body.availableSizes === "string") {
      try {
        body.availableSizes = JSON.parse(body.availableSizes);
      } catch (_) {
        body.availableSizes = body.availableSizes
          .split(",")
          .map((s) => s.trim().toUpperCase());
      }
    }
    if (typeof body.availableColors === "string") {
      try {
        body.availableColors = JSON.parse(body.availableColors);
      } catch (_) {
        body.availableColors = body.availableColors
          .split(",")
          .map((s) => s.trim());
      }
    }

    const product = await Product.create({
      ...body,
      images,
      createdBy: req.user._id,
    });

    // Generate & upload EAN-13 barcode image + QR code (async, non-blocking)
    attachBarcodeImages(product);

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
    const newImages = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    const body = { ...req.body };
    if (typeof body.availableSizes === "string") {
      try {
        body.availableSizes = JSON.parse(body.availableSizes);
      } catch (_) {
        body.availableSizes = body.availableSizes
          .split(",")
          .map((s) => s.trim().toUpperCase());
      }
    }
    if (typeof body.availableColors === "string") {
      try {
        body.availableColors = JSON.parse(body.availableColors);
      } catch (_) {
        body.availableColors = body.availableColors
          .split(",")
          .map((s) => s.trim());
      }
    }

    const updatePayload = { ...body };

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      newImages.length > 0
        ? { $set: updatePayload, $push: { images: { $each: newImages } } }
        : { $set: updatePayload },
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

// ─── Delete Product (soft delete) ─────────────────────────────────────────────

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

    await cloudinary.uploader.destroy(publicId);
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
      ordered: false,
    });

    await session.commitTransaction();
    return success(res, 201, `${inserted.length} products inserted`, {
      insertedCount: inserted.length,
      products: inserted,
    });
  } catch (err) {
    await session.abortTransaction();
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
// Searches both product-level barcode AND variant-level barcodes

exports.searchByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    // Try product-level barcode first
    let product = await Product.findOne({ barcode, isActive: true });
    let matchedVariant = null;

    if (!product) {
      // Try variant-level barcode
      product = await Product.findOne({
        "variants.barcode": barcode,
        isActive: true,
      });
      if (product) {
        matchedVariant = product.variants.find(
          (v) => v.barcode === barcode && v.isActive,
        );
      }
    }

    if (!product) return error(res, 404, "No product found for this barcode");

    return success(res, 200, "Product found", {
      ...product.toObject({ virtuals: true }),
      matchedVariant: matchedVariant || null,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Low Stock Products ───────────────────────────────────────────────────────

exports.getLowStockProducts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

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
    const missing = REQUIRED.filter((f) => !(f in rows[0]));
    if (missing.length) {
      return error(res, 422, `Missing required columns: ${missing.join(", ")}`);
    }

    const prepared = rows.map((row) => ({
      productName: row.productName,
      category: row.category,
      subCategory: row.subCategory || "",
      sku: row.sku ? String(row.sku).toUpperCase() : undefined,
      hsnCode: row.hsnCode ? String(row.hsnCode) : "",
      unitType: row.unitType || "PCS",
      // Parse sizes/colors if provided as comma-separated values in Excel
      availableSizes: row.sizes
        ? String(row.sizes)
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        : [],
      availableColors: row.colors
        ? String(row.colors)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
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

// ─── Get distinct Sizes ───────────────────────────────────────────────────────

exports.getSizes = async (req, res) => {
  try {
    const sizes = await Product.distinct("availableSizes", { isActive: true });
    return success(res, 200, "Sizes", sizes.filter(Boolean).sort());
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get distinct Colors ──────────────────────────────────────────────────────

exports.getColors = async (req, res) => {
  try {
    const colors = await Product.distinct("availableColors", {
      isActive: true,
    });
    return success(res, 200, "Colors", colors.filter(Boolean).sort());
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Add Variants to an existing product ─────────────────────────────────────

exports.addVariants = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });
    if (!product) return error(res, 404, "Product not found");

    const { variants } = req.body;

    // Check for duplicate size+color combos within the product
    for (const newV of variants) {
      const exists = product.variants.some(
        (v) =>
          v.isActive &&
          v.size === (newV.size || "").toUpperCase() &&
          v.color?.toLowerCase() === (newV.color || "").toLowerCase(),
      );
      if (exists) {
        return error(
          res,
          409,
          `Variant with size "${newV.size}" and color "${newV.color}" already exists`,
        );
      }
    }

    product.variants.push(...variants);

    // Sync availableSizes / availableColors master lists
    const newSizes = variants.map((v) => v.size).filter(Boolean);
    const newColors = variants.map((v) => v.color).filter(Boolean);
    product.availableSizes = [
      ...new Set([...product.availableSizes, ...newSizes]),
    ];
    product.availableColors = [
      ...new Set([...product.availableColors, ...newColors]),
    ];

    await product.save();

    // Generate barcode images for newly added variants (async, non-blocking)
    attachBarcodeImages(product);

    return success(res, 201, "Variants added", product);
  } catch (err) {
    if (err.code === 11000)
      return error(res, 409, "Variant barcode or SKU already exists");
    return error(res, 500, err.message);
  }
};

// ─── Update a single variant ──────────────────────────────────────────────────

exports.updateVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;

    const product = await Product.findOne({ _id: id, isActive: true });
    if (!product) return error(res, 404, "Product not found");

    const variant = product.variants.id(variantId);
    if (!variant) return error(res, 404, "Variant not found");

    Object.assign(variant, req.body);

    // Re-sync master lists after update
    const allActive = product.variants.filter((v) => v.isActive);
    product.availableSizes = [
      ...new Set(allActive.map((v) => v.size).filter(Boolean)),
    ];
    product.availableColors = [
      ...new Set(allActive.map((v) => v.color).filter(Boolean)),
    ];

    await product.save();
    return success(res, 200, "Variant updated", product);
  } catch (err) {
    if (err.code === 11000)
      return error(res, 409, "Variant barcode or SKU already exists");
    return error(res, 500, err.message);
  }
};

// ─── Soft-delete a variant ────────────────────────────────────────────────────

exports.deleteVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;

    const product = await Product.findOne({ _id: id, isActive: true });
    if (!product) return error(res, 404, "Product not found");

    const variant = product.variants.id(variantId);
    if (!variant) return error(res, 404, "Variant not found");

    variant.isActive = false;

    // Re-sync master lists
    const allActive = product.variants.filter((v) => v.isActive);
    product.availableSizes = [
      ...new Set(allActive.map((v) => v.size).filter(Boolean)),
    ];
    product.availableColors = [
      ...new Set(allActive.map((v) => v.color).filter(Boolean)),
    ];

    await product.save();
    return success(res, 200, "Variant removed", product);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Regenerate barcode images for a product (and its variants) ───────────────
// Useful if Cloudinary images were deleted or generation failed on create.

exports.regenerateBarcodeImages = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });
    if (!product) return error(res, 404, "Product not found");

    // Delete old barcode images from Cloudinary before regenerating
    await deleteBarcodeImages(
      product.barcodeImage?.publicId,
      product.qrImage?.publicId,
    );
    for (const v of product.variants || []) {
      await deleteBarcodeImages(v.barcodeImage?.publicId, v.qrImage?.publicId);
    }

    // Re-generate product-level barcode
    if (product.barcode) {
      const result = await generateAndUploadBarcode(
        product.barcode,
        product.productName,
        "habbis/barcodes",
      );
      product.barcodeImage = result.barcode;
      product.qrImage = result.qr;
    }

    // Re-generate variant barcodes
    for (const variant of product.variants || []) {
      if (variant.barcode && variant.isActive) {
        const label = [product.productName, variant.size, variant.color]
          .filter(Boolean)
          .join(" ");
        const result = await generateAndUploadBarcode(
          variant.barcode,
          label,
          "habbis/barcodes/variants",
        );
        variant.barcodeImage = result.barcode;
        variant.qrImage = result.qr;
      }
    }

    await product.save();
    return success(res, 200, "Barcode images regenerated", product);
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Get barcode image URLs for a product (and all its variants) ──────────────
// Used by billing software to display / print barcodes.

exports.getBarcodeImages = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).select(
      "productName barcode barcodeImage qrImage variants availableSizes availableColors",
    );

    if (!product) return error(res, 404, "Product not found");

    const response = {
      productId: product._id,
      productName: product.productName,
      barcode: product.barcode,
      barcodeImage: product.barcodeImage,
      qrImage: product.qrImage,
      variants: (product.variants || [])
        .filter((v) => v.isActive)
        .map((v) => ({
          variantId: v._id,
          size: v.size,
          color: v.color,
          colorCode: v.colorCode,
          barcode: v.barcode,
          barcodeImage: v.barcodeImage,
          qrImage: v.qrImage,
        })),
    };

    return success(res, 200, "Barcode images", response);
  } catch (err) {
    return error(res, 500, err.message);
  }
};
