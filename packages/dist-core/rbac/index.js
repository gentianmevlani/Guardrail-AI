"use strict";
/**
 * RBAC Module - Role-Based Access Control
 *
 * Exports all RBAC types, permissions, and utilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleHasPermission = exports.parseRole = exports.isValidRole = exports.isValidPermission = exports.isRoleAtLeast = exports.hasPermission = exports.hasAnyPermission = exports.hasAllPermissions = exports.getMinimumRoleForPermission = exports.getEffectivePermissions = exports.generatePermissionMatrix = exports.compareRoles = exports.checkTierAndPermission = exports.canRemoveMember = exports.canAssignRole = exports.ROLES = exports.ROLE_PERMISSIONS = exports.ROLE_METADATA = exports.ROLE_HIERARCHY = exports.PERMISSIONS = void 0;
// Values
var types_1 = require("./types");
Object.defineProperty(exports, "PERMISSIONS", { enumerable: true, get: function () { return types_1.PERMISSIONS; } });
Object.defineProperty(exports, "ROLE_HIERARCHY", { enumerable: true, get: function () { return types_1.ROLE_HIERARCHY; } });
Object.defineProperty(exports, "ROLE_METADATA", { enumerable: true, get: function () { return types_1.ROLE_METADATA; } });
Object.defineProperty(exports, "ROLE_PERMISSIONS", { enumerable: true, get: function () { return types_1.ROLE_PERMISSIONS; } });
Object.defineProperty(exports, "ROLES", { enumerable: true, get: function () { return types_1.ROLES; } });
// Permission checking
var permissions_1 = require("./permissions");
Object.defineProperty(exports, "canAssignRole", { enumerable: true, get: function () { return permissions_1.canAssignRole; } });
Object.defineProperty(exports, "canRemoveMember", { enumerable: true, get: function () { return permissions_1.canRemoveMember; } });
Object.defineProperty(exports, "checkTierAndPermission", { enumerable: true, get: function () { return permissions_1.checkTierAndPermission; } });
Object.defineProperty(exports, "compareRoles", { enumerable: true, get: function () { return permissions_1.compareRoles; } });
Object.defineProperty(exports, "generatePermissionMatrix", { enumerable: true, get: function () { return permissions_1.generatePermissionMatrix; } });
Object.defineProperty(exports, "getEffectivePermissions", { enumerable: true, get: function () { return permissions_1.getEffectivePermissions; } });
Object.defineProperty(exports, "getMinimumRoleForPermission", { enumerable: true, get: function () { return permissions_1.getMinimumRoleForPermission; } });
Object.defineProperty(exports, "hasAllPermissions", { enumerable: true, get: function () { return permissions_1.hasAllPermissions; } });
Object.defineProperty(exports, "hasAnyPermission", { enumerable: true, get: function () { return permissions_1.hasAnyPermission; } });
Object.defineProperty(exports, "hasPermission", { enumerable: true, get: function () { return permissions_1.hasPermission; } });
Object.defineProperty(exports, "isRoleAtLeast", { enumerable: true, get: function () { return permissions_1.isRoleAtLeast; } });
Object.defineProperty(exports, "isValidPermission", { enumerable: true, get: function () { return permissions_1.isValidPermission; } });
Object.defineProperty(exports, "isValidRole", { enumerable: true, get: function () { return permissions_1.isValidRole; } });
Object.defineProperty(exports, "parseRole", { enumerable: true, get: function () { return permissions_1.parseRole; } });
Object.defineProperty(exports, "roleHasPermission", { enumerable: true, get: function () { return permissions_1.roleHasPermission; } });
