"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_service_1 = require("../services/permissions.service");
const router = (0, express_1.Router)();
router.get('/me', auth_middleware_1.verifyToken, async (req, res) => {
    const role = String(req.user?.rol || '').toUpperCase();
    if (role === 'SUPERADMIN') {
        res.status(200).json({ role, permissions: permissions_service_1.ALL_PERMISSIONS });
        return;
    }
    const mapping = await permissions_service_1.PermissionsService.getRolePermissions();
    res.status(200).json({ role, permissions: mapping[role] || [] });
});
router.get('/', auth_middleware_1.verifyToken, (0, auth_middleware_1.requireRole)(['SUPERADMIN']), async (_req, res) => {
    const mapping = await permissions_service_1.PermissionsService.getRolePermissions();
    res.status(200).json({
        roles: permissions_service_1.ALL_ROLES,
        permissions: permissions_service_1.ALL_PERMISSIONS,
        mapping
    });
});
router.put('/', auth_middleware_1.verifyToken, (0, auth_middleware_1.requireRole)(['SUPERADMIN']), async (req, res) => {
    try {
        const next = await permissions_service_1.PermissionsService.setRolePermissions(req.body?.mapping ?? req.body);
        res.status(200).json({ ok: true, mapping: next });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'No se pudieron guardar permisos' });
    }
});
exports.default = router;
