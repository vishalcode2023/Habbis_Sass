const mongoose = require("mongoose");
const XLSX = require("xlsx");
const Product = require("../model/Product");
const StockLedger = require("../model/Stockledger");
const { success, error } = require("../utils/Apiresponse");
const { getPagination, buildMeta } = require("../utils/Pagination");
const { generateBarcode } = require("../Barcode/Barcodegenerator");
const { cloudinary } = require("../config/Cloudinary");
const {
  generateAndUploadBarcode,
  deleteBarcodeImages,
} = require("../Barcode/BarcodeImageGenerator");

// ─── Internal: generate barcode images for a product and all its variants ─────
const attachBarcodeImages = async (product) => {
  try {
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

  if (query.size) {
    filter.$or = [
      { availableSizes: query.size.toUpperCase() },
      { "variants.size": query.size.toUpperCase(), "variants.isActive": true },
    ];
  }

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
      createdBy: req.user.id,
    });

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

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      newImages.length > 0
        ? { $set: body, $push: { images: { $each: newImages } } }
        : { $set: body },
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
  try {
    const { products } = req.body;

    const prepared = products.map((p) => ({
      ...p,
      barcode: generateBarcode(),
      createdBy: req.user.id,
    }));

    const inserted = await Product.insertMany(prepared, { ordered: false });

    return success(res, 201, `${inserted.length} products inserted`, {
      insertedCount: inserted.length,
      products: inserted,
    });
  } catch (err) {
    if (err.name === "MongoBulkWriteError") {
      const insertedCount = err.result?.insertedCount || 0;
      const failed = err.writeErrors?.length || 0;
      return error(
        res,
        207,
        `Partial insert: ${insertedCount} inserted, ${failed} failed`,
        {
          insertedCount,
          errors: err.writeErrors?.map((e) => ({
            index: e.index,
            message: e.errmsg,
          })),
        },
      );
    }
    return error(res, 500, err.message);
  }
};

// ─── Barcode Scan Search ──────────────────────────────────────────────────────

exports.searchByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    let product = await Product.findOne({ barcode, isActive: true });
    let matchedVariant = null;

    if (!product) {
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
      createdBy: req.user.id,
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

// ─── Add Variants ─────────────────────────────────────────────────────────────

exports.addVariants = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });
    if (!product) return error(res, 404, "Product not found");

    const { variants } = req.body;

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

    const newSizes = variants.map((v) => v.size).filter(Boolean);
    const newColors = variants.map((v) => v.color).filter(Boolean);
    product.availableSizes = [
      ...new Set([...product.availableSizes, ...newSizes]),
    ];
    product.availableColors = [
      ...new Set([...product.availableColors, ...newColors]),
    ];

    await product.save();
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

// ─── Regenerate barcode images ────────────────────────────────────────────────

exports.regenerateBarcodeImages = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    });
    if (!product) return error(res, 404, "Product not found");

    await deleteBarcodeImages(
      product.barcodeImage?.publicId,
      product.qrImage?.publicId,
    );
    for (const v of product.variants || []) {
      await deleteBarcodeImages(v.barcodeImage?.publicId, v.qrImage?.publicId);
    }

    if (product.barcode) {
      const result = await generateAndUploadBarcode(
        product.barcode,
        product.productName,
        "habbis/barcodes",
      );
      product.barcodeImage = result.barcode;
      product.qrImage = result.qr;
    }

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

// ─── Get barcode image URLs ───────────────────────────────────────────────────

exports.getBarcodeImages = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).select(
      "productName barcode barcodeImage qrImage variants availableSizes availableColors",
    );

    if (!product) return error(res, 404, "Product not found");

    return success(res, 200, "Barcode images", {
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
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Billing Search ───────────────────────────────────────────────────────────
// GET /api/products/billing/search?q=An      → name search (regex, no $text)
// GET /api/products/billing/search?barcode=… → exact barcode scan
//
// FIX: The old code used `$text` for ALL queries including short ones like "An".
// MongoDB's $text index requires a minimum of 2–3 characters AND only matches
// whole words, so "An" would never match "ANARKALI". We now use:
//   • Short queries (< 3 chars) : pure regex on productName only
//   • Longer queries            : regex across name + category + supplier + sku
//                                 with optional $text fallback for relevance sort
//   • Fuzzy fallback remains for longer mistyped queries

exports.billingSearch = async (req, res) => {
  try {
    const { q, barcode } = req.query;

    if (!q && !barcode) {
      return error(res, 400, "Provide either ?q=<name> or ?barcode=<code>");
    }

    // ── Barcode mode ──────────────────────────────────────────────────────────
    if (barcode) {
      let product = await Product.findOne({
        barcode: barcode.trim(),
        isActive: true,
      }).lean({ virtuals: true });
      let matchedVariant = null;

      if (!product) {
        product = await Product.findOne({
          "variants.barcode": barcode.trim(),
          isActive: true,
        }).lean({ virtuals: true });

        if (product) {
          matchedVariant = product.variants.find(
            (v) => v.barcode === barcode.trim() && v.isActive,
          );
        }
      }

      if (!product) return error(res, 404, "No product found for this barcode");

      const shaped = shapeBillingProduct(product);
      shaped.matchedVariant = matchedVariant
        ? shapeVariant(matchedVariant)
        : null;

      return success(res, 200, "Product found", { products: [shaped] });
    }

    // ── Name search mode ──────────────────────────────────────────────────────
    const trimmed = q.trim();
    if (!trimmed.length) return error(res, 400, "Search term cannot be empty");

    // ── Level 1: Regex search (works for any length, including 1–2 chars) ────
    // This replaces the broken `$text` approach for short queries.
    // Regex on productName catches "An" → "ANARKALI SUIT PREMIUM" instantly.
    const regexQ = new RegExp(trimmed, "i");

    let results = await Product.find({
      isActive: true,
      $or: [
        { productName: regexQ },
        { category: regexQ },
        { supplierName: regexQ },
        { sku: regexQ },
        { barcode: regexQ },
      ],
    })
      .sort({ productName: 1 })
      .limit(20)
      .lean({ virtuals: true });

    // ── Level 2: $text search for longer queries (better relevance ranking) ──
    // Only attempt $text if regex returned nothing AND query is long enough
    // for MongoDB's text index (minimum ~3 meaningful chars, whole words).
    if (!results.length && trimmed.length >= 3) {
      try {
        results = await Product.find({
          isActive: true,
          $text: { $search: trimmed },
        })
          .sort({ score: { $meta: "textScore" } })
          .limit(20)
          .lean({ virtuals: true });
      } catch (_) {
        // $text index may not exist — silently ignore and fall through to fuzzy
      }
    }

    // ── Level 3: Fuzzy — tolerate 1-char typo (only for 3+ char queries) ────
    if (!results.length && trimmed.length >= 3) {
      const fuzzyPatterns = Array.from(trimmed).map((_, i) => {
        const pat = trimmed.slice(0, i) + "." + trimmed.slice(i + 1);
        return new RegExp(pat, "i");
      });
      results = await Product.find({
        isActive: true,
        productName: { $in: fuzzyPatterns },
      })
        .sort({ productName: 1 })
        .limit(20)
        .lean({ virtuals: true });
    }

    return success(res, 200, "Products found", {
      products: results.map(shapeBillingProduct),
      total: results.length,
    });
  } catch (err) {
    return error(res, 500, err.message);
  }
};

// ─── Internal shape helpers ───────────────────────────────────────────────────

function shapeBillingProduct(p) {
  return {
    productId: p._id,
    productName: p.productName,
    category: p.category,
    subCategory: p.subCategory,
    sku: p.sku,
    barcode: p.barcode,
    unitType: p.unitType,
    gstPercent: p.gstPercent,
    hsnCode: p.hsnCode,
    hasVariants: !!(p.variants && p.variants.length),
    sellingPrice: p.pricing?.sellingPrice,
    wholesalePrice: p.pricing?.wholesalePrice,
    purchasePrice: p.pricing?.purchasePrice,
    stock: p.stock?.quantity ?? 0,
    minimumStock: p.minimumStock,
    variants: (p.variants || []).filter((v) => v.isActive).map(shapeVariant),
  };
}

function shapeVariant(v) {
  return {
    variantId: v._id,
    size: v.size,
    color: v.color,
    colorCode: v.colorCode,
    sku: v.sku,
    barcode: v.barcode,
    sellingPrice: v.pricing?.sellingPrice,
    wholesalePrice: v.pricing?.wholesalePrice,
    stock: v.stock?.quantity ?? 0,
  };
}
