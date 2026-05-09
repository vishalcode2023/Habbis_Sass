const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// ================= CLOUDINARY CONFIG =================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= MULTER MEMORY STORAGE =================

const storage = multer.memoryStorage();

// ================= FILE FILTER =================

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// ================= PRODUCT IMAGE UPLOAD =================

const uploadProductImages = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },

  fileFilter,
}).array("images", 5);

// ================= SINGLE PRODUCT IMAGE =================

const uploadSingleImage = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter,
}).single("image");

// ================= EXCEL FILE STORAGE =================

const excelStorage = multer.memoryStorage();

// ================= EXCEL FILE FILTER =================

const excelFileFilter = (req, file, cb) => {
  const allowed = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files are allowed"), false);
  }
};

// ================= EXCEL UPLOAD =================

const uploadExcel = multer({
  storage: excelStorage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },

  fileFilter: excelFileFilter,
}).single("file");

// ================= EXPORTS =================

module.exports = {
  cloudinary,
  uploadProductImages,
  uploadSingleImage,
  uploadExcel,
};
