// Build the JWT claim payload from a user row. The `depart` claim maps from `departement`
// (frontend sidebar filters menus by it). `permissions` comes from the role map, so the
// auth middleware never needs a DB lookup.

const { permissionsForRole } = require("./permissions");

function accessClaims(user) {
  return {
    id: user.id,
    username: user.username,
    roleuser: user.roleuser,
    depart: user.departement,
    section: user.section,
    permissions: permissionsForRole(user.roleuser),
  };
}

function refreshedClaims(decoded) {
  return {
    id: decoded.id,
    username: decoded.username,
    roleuser: decoded.roleuser,
    depart: decoded.depart,
    section: decoded.section,
    permissions: permissionsForRole(decoded.roleuser),
  };
}

module.exports = { accessClaims, refreshedClaims };