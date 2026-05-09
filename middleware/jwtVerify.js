// middleware/jwtVerify.js
const jwt = require("jsonwebtoken");
const RefreshToken = require("../model/RefreshTokenSchema");
const { createJwtToken } = require("../Middleware/JwtCreation");

const ROLES = ["admin", "billing"];

const jwtVerify = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;

    // ── 1. ACCESS TOKEN ──────────────────────────────────────────
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        if (!ROLES.includes(decoded.role)) {
          return res.status(403).json({ message: "Invalid role" });
        }
        req.user = decoded;
        return next();
      } catch (err) {
        if (err.name !== "TokenExpiredError") {
          res.clearCookie("accessToken");
          return res.status(401).json({ message: "Invalid access token" });
        }
        // expired → fall through to refresh token
      }
    }

    // ── 2. CHECK REFRESH TOKEN COOKIE ────────────────────────────
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "Authentication required. Please login." });
    }

    // ── 3. FIND IN DB ────────────────────────────────────────────
    const storedRefresh = await RefreshToken.findOne({ token: refreshToken });
    if (!storedRefresh) {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return res.status(403).json({ message: "Refresh token invalid or revoked" });
    }

    // ── 4. CHECK isValid() (revoked + expiry) ────────────────────
    if (!storedRefresh.isValid()) {
      await RefreshToken.deleteOne({ _id: storedRefresh._id });
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return res.status(403).json({ message: "Refresh token expired or revoked" });
    }

    // ── 5. VERIFY SIGNATURE ──────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      await RefreshToken.deleteOne({ _id: storedRefresh._id });
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return res.status(403).json({ message: "Refresh token verification failed" });
    }

    // ── 6. VALIDATE ROLE ─────────────────────────────────────────
    if (!ROLES.includes(decoded.role)) {
      return res.status(403).json({ message: "Invalid role in token" });
    }

    const payload = { id: decoded.id, role: decoded.role };

    // ── 7. ISSUE NEW ACCESS TOKEN ────────────────────────────────
    const newAccessToken = createJwtToken(payload);
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   15 * 60 * 1000,
    });

    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT VERIFY ERROR:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
};

module.exports = jwtVerify;