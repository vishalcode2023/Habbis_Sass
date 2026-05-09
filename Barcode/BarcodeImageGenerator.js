/**
 * BarcodeImageGenerator.js
 *
 * Generates EAN-13 barcode images + QR codes using bwip-js,
 * uploads them to Cloudinary, and returns the URLs.
 *
 * Used automatically after every product / variant is created.
 */

const bwipjs = require("bwip-js");
const QRCode = require("qrcode");
const streamifier = require("streamifier");
const { cloudinary } = require("../config/Cloudinary");

// ─── Generate EAN-13 barcode as PNG buffer ────────────────────────────────────

const generateBarcodeBuffer = async (barcodeNumber) => {
  return bwipjs.toBuffer({
    bcid: "ean13", // EAN-13 symbology
    text: barcodeNumber, // 13-digit string
    scale: 3, // 3x scale → crisp at small sizes
    height: 18, // bar height in mm
    includetext: true, // print digits below bars
    textxalign: "center",
    backgroundcolor: "ffffff",
  });
};

// ─── Generate QR code as PNG buffer ──────────────────────────────────────────

const generateQRBuffer = async (data) => {
  return QRCode.toBuffer(data, {
    type: "png",
    width: 200,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
};

// ─── Upload a buffer to Cloudinary ───────────────────────────────────────────

const uploadBufferToCloudinary = (buffer, publicId, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
        format: "png",
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ─── Main: generate barcode + QR, upload both ────────────────────────────────

/**
 * @param {string} barcodeNumber  - 13-digit EAN-13 string
 * @param {string} label          - human label printed on the barcode label (productName + size/color)
 * @param {string} folder         - Cloudinary folder, e.g. "habbis/barcodes"
 * @returns {{ barcode: {url, publicId}, qr: {url, publicId} }}
 */
const generateAndUploadBarcode = async (
  barcodeNumber,
  label = "",
  folder = "habbis/barcodes",
) => {
  const safeId = barcodeNumber.replace(/\s+/g, "_");

  const [barcodeBuffer, qrBuffer] = await Promise.all([
    generateBarcodeBuffer(barcodeNumber),
    generateQRBuffer(barcodeNumber), // QR encodes the barcode number itself
  ]);

  const [barcodeResult, qrResult] = await Promise.all([
    uploadBufferToCloudinary(barcodeBuffer, `barcode_${safeId}`, folder),
    uploadBufferToCloudinary(qrBuffer, `qr_${safeId}`, folder),
  ]);

  return {
    barcode: {
      url: barcodeResult.secure_url,
      publicId: barcodeResult.public_id,
    },
    qr: { url: qrResult.secure_url, publicId: qrResult.public_id },
  };
};

// ─── Cleanup: delete barcode + QR images from Cloudinary ─────────────────────

const deleteBarcodeImages = async (barcodePublicId, qrPublicId) => {
  const toDelete = [barcodePublicId, qrPublicId].filter(Boolean);
  if (!toDelete.length) return;
  await Promise.allSettled(
    toDelete.map((id) => cloudinary.uploader.destroy(id)),
  );
};

module.exports = {
  generateAndUploadBarcode,
  generateBarcodeBuffer,
  generateQRBuffer,
  deleteBarcodeImages,
};
