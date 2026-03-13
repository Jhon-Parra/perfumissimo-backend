import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_please_change';

if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
        throw new Error('JWT_SECRET no esta configurado (o usa el valor por defecto). Configuralo en el entorno de produccion.');
    }
}

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

export interface AuthRequest extends Request {
    user?: any;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
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
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Token inválido o expirado.' });
    }
};

// Igual que verifyToken, pero no bloquea rutas publicas.
// Si el token no existe o es invalido, continua sin req.user.
export const optionalVerifyToken = (req: AuthRequest, _res: Response, next: NextFunction): void => {
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
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
    } catch {
        // Ignorar token invalido en rutas publicas
    }
    next();
};

export const requireRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.rol)) {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
            return;
        }
        next();
    };
};

// Permisos dinamicos por rol (RBAC)
export const requirePermission = (permission: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
            const { PermissionsService } = await import('../services/permissions.service');
            const ok = await PermissionsService.roleHasPermission(role, permission as any);
            if (!ok) {
                res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
                return;
            }
            next();
        } catch {
            res.status(403).json({ error: 'Acceso Denegado. Permisos insuficientes.' });
        }
    };
};
