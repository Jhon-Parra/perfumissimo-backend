"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refreshToken = exports.googleLogin = exports.register = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const google_auth_library_1 = require("google-auth-library");
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
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutos
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 días
const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite = isProduction ? 'none' : 'lax';
const cookieBaseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: cookieSameSite,
    path: '/'
};
const generateTokens = (usuario) => {
    const payload = {
        id: usuario.id,
        rol: usuario.rol
        // No incluir 'exp' aquí; usar expiresIn en las opciones de jwt.sign
    };
    const accessToken = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ id: usuario.id }, REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
const setTokenCookies = (res, accessToken, refreshToken) => {
    res.cookie('access_token', accessToken, {
        ...cookieBaseOptions,
        maxAge: ACCESS_TOKEN_EXPIRY
    });
    res.cookie('refresh_token', refreshToken, {
        ...cookieBaseOptions,
        maxAge: REFRESH_TOKEN_EXPIRY
    });
};
const clearTokenCookies = (res) => {
    res.clearCookie('access_token', cookieBaseOptions);
    res.clearCookie('refresh_token', cookieBaseOptions);
};
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email y contraseña son requeridos' });
            return;
        }
        const [rows] = await database_1.pool.execute('SELECT id, email, nombre, apellido, foto_perfil, password_hash, rol FROM Usuarios WHERE email = ?', [email]);
        const usuarios = rows;
        if (usuarios.length === 0) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }
        const usuario = usuarios[0];
        const isMatch = await bcrypt_1.default.compare(password, usuario.password_hash);
        if (!isMatch) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }
        const { accessToken, refreshToken } = generateTokens(usuario);
        setTokenCookies(res, accessToken, refreshToken);
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
    }
    catch (error) {
        console.error('Error en Login Auth:', error);
        res.status(500).json({ error: 'Error interno del servidor. Contacte al soporte.' });
    }
};
exports.login = login;
const register = async (req, res) => {
    try {
        const { nombre, apellido, telefono, email, password } = req.body;
        if (!nombre || !apellido || !telefono || !email || !password) {
            res.status(400).json({ error: 'Todos los campos son requeridos.' });
            return;
        }
        const [existing] = await database_1.pool.execute('SELECT email FROM Usuarios WHERE email = ?', [email]);
        const users = existing;
        if (users.length > 0) {
            res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        await database_1.pool.execute(`INSERT INTO Usuarios (nombre, apellido, telefono, email, password_hash, rol) 
             VALUES (?, ?, ?, ?, ?, 'CUSTOMER')`, [nombre, apellido, telefono, email, passwordHash]);
        const [newRows] = await database_1.pool.execute('SELECT id, email, nombre, apellido, foto_perfil, rol FROM Usuarios WHERE email = ?', [email]);
        const usuario = newRows[0];
        const { accessToken, refreshToken } = generateTokens(usuario);
        setTokenCookies(res, accessToken, refreshToken);
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
    }
    catch (error) {
        console.error('Error en Registro Auth:', error);
        res.status(500).json({ error: 'Error interno al registrar usuario.' });
    }
};
exports.register = register;
const googleLogin = async (req, res) => {
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
        }
        catch (e) {
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
        const [rows] = await database_1.pool.execute('SELECT id, email, nombre, apellido, foto_perfil, rol, password_hash FROM Usuarios WHERE email = ?', [email]);
        let usuarios = rows;
        let usuario;
        if (usuarios.length === 0) {
            console.log(`Registrando nuevo usuario via Google: ${email}`);
            const randomPassword = await bcrypt_1.default.hash(Math.random().toString(36), 10);
            await database_1.pool.execute(`INSERT INTO Usuarios (nombre, apellido, email, password_hash, foto_perfil, rol) 
                 VALUES (?, ?, ?, ?, ?, 'CUSTOMER')`, [given_name || 'Desconocido', family_name || 'Google', email, randomPassword, picture || null]);
            const [newRows] = await database_1.pool.execute('SELECT id, email, nombre, apellido, foto_perfil, rol FROM Usuarios WHERE email = ?', [email]);
            usuario = newRows[0];
        }
        else {
            usuario = usuarios[0];
        }
        const { accessToken, refreshToken } = generateTokens(usuario);
        setTokenCookies(res, accessToken, refreshToken);
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
    }
    catch (error) {
        console.error('Error en Google Login Auth:', error);
        res.status(500).json({ error: 'Error al iniciar sesión con Google' });
    }
};
exports.googleLogin = googleLogin;
const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refresh_token;
        if (!refreshToken) {
            res.status(401).json({ error: 'Refresh token no proporcionado' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, REFRESH_SECRET);
        const [rows] = await database_1.pool.execute('SELECT id, email, nombre, apellido, foto_perfil, rol FROM Usuarios WHERE id = ?', [decoded.id]);
        const usuarios = rows;
        if (usuarios.length === 0) {
            res.status(401).json({ error: 'Usuario no encontrado' });
            return;
        }
        const usuario = usuarios[0];
        const tokens = generateTokens(usuario);
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
    }
    catch (error) {
        console.error('Error en refresh token:', error);
        res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
    clearTokenCookies(res);
    res.status(200).json({ message: 'Logout exitoso' });
};
exports.logout = logout;
