const { hasPermission } = require("../src/services/permissions");

function requirePermission(permission) {
  const required = Array.isArray(permission) ? permission : [permission];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized", code: "UNAUTHORIZED" });
    }
    if (!required.some((item) => hasPermission(req.user, item))) {
      return res.status(403).json({ message: "Forbidden", code: "FORBIDDEN" });
    }
    return next();
  };
}

module.exports = requirePermission;