"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.optionalVerifyToken = exports.verifyToken = void 0;
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
