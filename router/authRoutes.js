// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const jwtVerify = require("../middleware/jwtVerify");
const {
  register,
  login,
  logout,
  logoutAll,
  getMe,
  changePassword,
} = require("../controller/authController");

// Public
router.post("/register", register);
router.post("/login", login);

// Protected
router.post("/logout", jwtVerify, logout);
router.post("/logout-all", jwtVerify, logoutAll);
router.get("/me", jwtVerify, getMe);
router.patch("/change-password", jwtVerify, changePassword);

module.exports = router;
