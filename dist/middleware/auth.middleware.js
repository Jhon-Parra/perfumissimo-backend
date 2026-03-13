"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.requireRole = exports.optionalVerifyToken = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_please_change';
if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
        throw new Error('JWT_SECRET no esta configurado (o usa el valor por defecto). Configuralo en el entorno de produccion.');
    }
}
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const verifyToken = (req, res, next) => {
    let token = req.cookies?.access_token;
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }
    if (!token) {
        res.status(401).json({ error: 'Acceso Denegado. Token no proporcionado.' });
        return;
    }
    try {
        const verified = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    }
    catch (error) {
        res.status(403).json({ error: 'Token inválido o expirado.' });
    }
};
exports.verifyToken = verifyToken;
// Igual que verifyToken, pero no bloquea rutas publicas.
// Si el token no existe o es invalido, continua sin req.user.
const optionalVerifyToken = (req, _res, next) => {
    let token = req.cookies?.access_token;
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }
    if (!token) {
        next();
        return;
    }
    try {
        const verified = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = verified;
    }
    catch {
        // Ignorar token invalido en rutas publicas
    }
    next();
};
exports.optionalVerifyToken = optionalVerifyToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.rol)) {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// Permisos dinamicos por rol (RBAC)
const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
            return;
        }
        const role = String(req.user.rol || '').toUpperCase();
        if (role === 'SUPERADMIN') {
            next();
            return;
        }
        try {
            const { PermissionsService } = await Promise.resolve().then(() => __importStar(require('../services/permissions.service')));
            const ok = await PermissionsService.roleHasPermission(role, permission);
            if (!ok) {
                res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
                return;
            }
            next();
        }
        catch {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
        }
    };
};
exports.requirePermission = requirePermission;
