// RBAC: role -> permission map. Production reality: only superuser and ppc (operator).
// Unknown role falls back to the ppc (operator) set.

const rolePermissions = {
  superuser: ["*"],
  ppc: ["scan:read", "scan:write", "registscan:read-own", "registscan:write"],
};

function permissionsForRole(role) {
  return rolePermissions[String(role || "").toLowerCase()] || rolePermissions.ppc;
}

function hasPermission(user, permission) {
  const permissions = user?.permissions || permissionsForRole(user?.roleuser);
  return permissions.includes("*") || permissions.includes(permission);
}

module.exports = { rolePermissions, permissionsForRole, hasPermission };