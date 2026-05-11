// controllers/authController.js
const crypto = require("crypto");
const {
  userModel: User,
  registerSchema,
  loginSchema,
  changePasswordSchema,
} = require("../Model/AuthModel");
const RefreshToken = require("../Model/RefreshTokenSchema");
const { createToken: createJwtToken } = require("../Middleware/JwtCreation");

// ── HELPERS ───────────────────────────────────────────────────────────────────

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge,
});

const createAndStoreRefreshToken = async (userId, role) => {
  const rawToken = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await RefreshToken.create({ token: rawToken, userId, role, expiresAt });

  return rawToken;
};

// ── REGISTER ──────────────────────────────────────────────────────────────────

const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((d) => d.message),
      });
    }

    const { firstName, lastName, email, password, role, company } = value;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      company,
    });

    return res.status(201).json({
      message: "Account created successfully",
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((d) => d.message),
      });
    }

    const { email, password, role } = value;

    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Contact support." });
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = { id: user._id, role: user.role };

    const accessToken = createJwtToken(payload);
    const refreshToken = await createAndStoreRefreshToken(user._id, user.role);

    user.lastLogin = new Date();
    await user.save();

    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(REFRESH_TOKEN_TTL_MS),
    );

    return res.status(200).json({
      message: "Login successful",
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("LOGOUT ERROR:", err);
    return res.status(500).json({ message: "Logout failed" });
  }
};

// ── LOGOUT ALL DEVICES ────────────────────────────────────────────────────────

const logoutAll = async (req, res) => {
  try {
    await RefreshToken.deleteMany({ userId: req.user.id });

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return res.status(200).json({ message: "Logged out from all devices" });
  } catch (err) {
    console.error("LOGOUT ALL ERROR:", err);
    return res.status(500).json({ message: "Logout failed" });
  }
};

// ── GET ME ────────────────────────────────────────────────────────────────────

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: user.toSafeObject() });
  } catch (err) {
    console.error("GET ME ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch user" });
  }
};

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────

const changePassword = async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((d) => d.message),
      });
    }

    const { currentPassword, newPassword } = value;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordMatch = await user.comparePassword(currentPassword);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword; // pre-save hook re-hashes automatically
    await user.save();

    // revoke all sessions → force re-login on all devices
    await RefreshToken.deleteMany({ userId: user._id });
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return res
      .status(200)
      .json({ message: "Password changed. Please login again." });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Password change failed" });
  }
};

// ── EXPORTS ───────────────────────────────────────────────────────────────────

module.exports = { register, login, logout, logoutAll, getMe, changePassword };
