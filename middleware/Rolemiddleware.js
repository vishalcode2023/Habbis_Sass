const { error } = require("../utils/apiResponse");

/**
 * Role-based access middleware.
 *
 * Usage:
 *   router.delete("/products/:id", jwtVerify, authorize("admin"), deleteProduct);
 *   router.get("/products",        jwtVerify, authorize("admin", "billing"), getAllProducts);
 *
 * @param {...string} roles - Allowed roles (e.g. "admin", "billing")
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 401, "Authentication required.");
    }

    if (!roles.includes(req.user.role)) {
      return error(
        res,
        403,
        `Access denied. Required role(s): ${roles.join(", ")}. Your role: ${req.user.role}.`,
      );
    }

    next();
  };
};

/**
 * Convenience shortcuts
 */
const adminOnly = authorize("admin");
const billingOrAdmin = authorize("admin", "billing");

module.exports = { authorize, adminOnly, billingOrAdmin };
