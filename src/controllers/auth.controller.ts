import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database';
import { OAuth2Client } from 'google-auth-library';

const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_please_change';
const DEFAULT_REFRESH_SECRET = 'refresh_secret_key_please_change_in_production';

if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
        throw new Error('JWT_SECRET no esta configurado (o usa el valor por defecto). Configuralo en el entorno de produccion.');
    }
    if (!process.env.REFRESH_SECRET || process.env.REFRESH_SECRET === DEFAULT_REFRESH_SECRET) {
        throw new Error('REFRESH_SECRET no esta configurado (o usa el valor por defecto). Configuralo en el entorno de produccion.');
    }
}

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || DEFAULT_REFRESH_SECRET;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutos
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 días

interface JwtPayload {
    id: string;
    rol: string;
    exp: number;
}

const isProduction = process.env.NODE_ENV === 'production';
const allowCrossSiteCookies = process.env.COOKIE_CROSS_SITE === 'true';

const cookieSameSite: 'lax' | 'none' = isProduction && allowCrossSiteCookies ? 'none' : 'lax';

const cookieBaseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: cookieSameSite,
    path: '/'
};

const hashToken = (token: string): string =>
    crypto.createHash('sha256').update(token).digest('hex');

const getRequestMeta = (req: Request) => {
    const ip = req.ip ? String(req.ip) : null;
    const userAgent = req.headers?.['user-agent']
        ? String(req.headers['user-agent']).slice(0, 300)
        : null;
    return { ip, userAgent };
};

const storeRefreshToken = async (userId: string, refreshToken: string, req: Request): Promise<void> => {
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    const { ip, userAgent } = getRequestMeta(req);

    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, tokenHash, expiresAt, ip, userAgent]
    );
};

const revokeRefreshToken = async (refreshToken: string | undefined | null): Promise<void> => {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    await pool.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?`,
        [tokenHash]
    );
};

const rotateRefreshToken = async (
    userId: string,
    currentRefreshToken: string,
    nextRefreshToken: string,
    req: Request
): Promise<'ok' | 'not_found' | 'revoked'> => {
    const client = await pool.getConnection();
    const now = new Date();
    const tokenHash = hashToken(currentRefreshToken);
    const nextHash = hashToken(nextRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    const { ip, userAgent } = getRequestMeta(req);

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `SELECT id, revoked_at, expires_at
             FROM refresh_tokens
             WHERE token_hash = $1 AND user_id = $2`,
            [tokenHash, userId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return 'not_found';
        }

        const row = result.rows[0];
        const expired = row.expires_at ? new Date(row.expires_at) <= now : true;
        if (row.revoked_at || expired) {
            await client.query('ROLLBACK');
            return 'revoked';
        }

        await client.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip, user_agent)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, nextHash, expiresAt, ip, userAgent]
        );

        await client.query(
            `UPDATE refresh_tokens
             SET revoked_at = NOW(), replaced_by_hash = $1
             WHERE id = $2`,
            [nextHash, row.id]
        );

        await client.query('COMMIT');
        return 'ok';
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const generateTokens = (usuario: any) => {
    const payload = {
        id: usuario.id,
        rol: usuario.rol
        // No incluir 'exp' aquí; usar expiresIn en las opciones de jwt.sign
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: usuario.id }, REFRESH_SECRET, { expiresIn: '7d' });

    return { accessToken, refreshToken };
};

const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
    res.cookie('access_token', accessToken, {
        ...cookieBaseOptions,
        maxAge: ACCESS_TOKEN_EXPIRY
    });

    res.cookie('refresh_token', refreshToken, {
        ...cookieBaseOptions,
        maxAge: REFRESH_TOKEN_EXPIRY
    });
};

const clearTokenCookies = (res: Response) => {
    res.clearCookie('access_token', cookieBaseOptions);
    res.clearCookie('refresh_token', cookieBaseOptions);
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email y contraseña son requeridos' });
            return;
        }

        const [rows] = await pool.execute(
            'SELECT id, email, nombre, apellido, foto_perfil, password_hash, rol FROM Usuarios WHERE email = ?',
            [email]
        );
        const usuarios = rows as any[];

        if (usuarios.length === 0) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const usuario = usuarios[0];

        const isMatch = await bcrypt.compare(password, usuario.password_hash);
        if (!isMatch) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        const { accessToken, refreshToken } = generateTokens(usuario);
        setTokenCookies(res, accessToken, refreshToken);

        try {
            await storeRefreshToken(String(usuario.id), refreshToken, req);
        } catch (e: any) {
            console.error('Error storing refresh token:', e?.message || e);
            clearTokenCookies(res);
            res.status(500).json({ error: 'No se pudo iniciar sesión. Intenta nuevamente.' });
            return;
        }

        res.status(200).json({
            message: 'Autenticación exitosa',
            user: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                foto_perfil: usuario.foto_perfil,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error('Error en Login Auth:', error);
        res.status(500).json({ error: 'Error interno del servidor. Contacte al soporte.' });
    }
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, apellido, telefono, email, password } = req.body;

        if (!nombre || !apellido || !telefono || !email || !password) {
            res.status(400).json({ error: 'Todos los campos son requeridos.' });
            return;
        }

        const [existing] = await pool.execute(
            'SELECT email FROM Usuarios WHERE email = ?',
            [email]
        );
        const users = existing as any[];

        if (users.length > 0) {
            res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.execute(
            `INSERT INTO Usuarios (nombre, apellido, telefono, email, password_hash, rol) 
             VALUES (?, ?, ?, ?, ?, 'CUSTOMER')`,
            [nombre, apellido, telefono, email, passwordHash]
        );

        const [newRows] = await pool.execute(
            'SELECT id, email, nombre, apellido, foto_perfil, rol FROM Usuarios WHERE email = ?',
            [email]
        );
        const usuario = (newRows as any[])[0];

        const { accessToken, refreshToken } = generateTokens(usuario);
        setTokenCookies(res, accessToken, refreshToken);

        try {
            await storeRefreshToken(String(usuario.id), refreshToken, req);
        } catch (e: any) {
            console.error('Error storing refresh token:', e?.message || e);
            clearTokenCookies(res);
            res.status(500).json({ error: 'No se pudo completar el registro. Intenta nuevamente.' });
            return;
        }

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                foto_perfil: usuario.foto_perfil,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en Registro Auth:', error);
        res.status(500).json({ error: 'Error interno al registrar usuario.' });
    }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { credential } = req.body;

        if (!process.env.GOOGLE_CLIENT_ID) {
            res.status(500).json({ error: 'GOOGLE_CLIENT_ID no está configurado en el backend' });
            return;
        }

        if (!credential) {
            res.status(400).json({ error: 'Token de Google es requerido' });
            return;
        }

        let ticket;
        try {
            ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
        } catch (e: any) {
            const msg = e?.message || String(e);
            console.error('Google verifyIdToken error:', msg);
            // Errores tipicos: wrong audience, token expired, invalid signature
            res.status(401).json({ error: 'Token de Google inválido o expirado' });
            return;
        }

        const payloadGoogle = ticket.getPayload();
        if (!payloadGoogle || !payloadGoogle.email) {
            res.status(401).json({ error: 'Token de Google inválido o sin email' });
            return;
        }

        const { email, given_name, family_name, picture } = payloadGoogle;

        const [rows] = await pool.execute(
            'SELECT id, email, nombre, apellido, foto_perfil, rol, password_hash FROM Usuarios WHERE email = ?',
            [email]
        );
        let usuarios = rows as any[];
        let usuario: any;

        if (usuarios.length === 0) {
            console.log(`Registrando nuevo usuario via Google: ${email}`);
            const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);

            await pool.execute(
                `INSERT INTO Usuarios (nombre, apellido, email, password_hash, foto_perfil, rol) 
                 VALUES (?, ?, ?, ?, ?, 'CUSTOMER')`,
                [given_name || 'Desconocido', family_name || 'Google', email, randomPassword, picture || null]
            );

            const [newRows] = await pool.execute(
                'SELECT id, email, nombre, apellido, foto_perfil, rol FROM Usuarios WHERE email = ?',
                [email]
            );
            usuario = (newRows as any[])[0];
        } else {
            usuario = usuarios[0];
        }

        const { accessToken, refreshToken } = generateTokens(usuario);
        setTokenCookies(res, accessToken, refreshToken);

        try {
            await storeRefreshToken(String(usuario.id), refreshToken, req);
        } catch (e: any) {
            console.error('Error storing refresh token:', e?.message || e);
            clearTokenCookies(res);
            res.status(500).json({ error: 'No se pudo iniciar sesión con Google. Intenta nuevamente.' });
            return;
        }

        res.status(200).json({
            message: 'Autenticación con Google exitosa',
            user: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                foto_perfil: usuario.foto_perfil,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en Google Login Auth:', error);
        res.status(500).json({ error: 'Error al iniciar sesión con Google' });
    }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            res.status(401).json({ error: 'Refresh token no proporcionado' });
            return;
        }

        const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { id: string };

        const [rows] = await pool.execute(
            'SELECT id, email, nombre, apellido, foto_perfil, rol FROM Usuarios WHERE id = ?',
            [decoded.id]
        );
        const usuarios = rows as any[];

        if (usuarios.length === 0) {
            res.status(401).json({ error: 'Usuario no encontrado' });
            return;
        }

        const usuario = usuarios[0];
        const tokens = generateTokens(usuario);

        const rotation = await rotateRefreshToken(String(usuario.id), refreshToken, tokens.refreshToken, req);
        if (rotation !== 'ok') {
            clearTokenCookies(res);
            res.status(401).json({ error: 'Refresh token inválido o expirado' });
            return;
        }

        setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

        res.status(200).json({
            message: 'Token refrescado exitosamente',
            user: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                foto_perfil: usuario.foto_perfil,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error('Error en refresh token:', error);
        res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        await revokeRefreshToken(req.cookies?.refresh_token);
    } catch (e: any) {
        console.warn('Error revoking refresh token:', e?.message || e);
    }
    clearTokenCookies(res);
    res.status(200).json({ message: 'Logout exitoso' });
};
