"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const promotion_routes_1 = __importDefault(require("./routes/promotion.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const favorite_routes_1 = __importDefault(require("./routes/favorite.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const social_routes_1 = __importDefault(require("./routes/social.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const security_middleware_1 = require("./middleware/security.middleware");
const error_middleware_1 = require("./middleware/error.middleware");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Nota: en macOS/Angular, el browser suele resolver localhost como ::1 (IPv6).
// Usar :: permite atender localhost en IPv6 y (cuando aplica) tambien IPv4.
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '::');
const disableAuthLimiter = process.env.DISABLE_AUTH_LIMIT === 'true';
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('combined'));
app.use((0, cookie_parser_1.default)());
const defaultAllowedOrigins = [
    'http://localhost:4200',
    'http://127.0.0.1:4200'
];
const normalizeAllowedOrigin = (raw) => {
    const value = String(raw || '').trim();
    if (!value)
        return '';
    // Si viene como URL completa (con path), reducir a origin.
    if (/^https?:\/\//i.test(value)) {
        try {
            const u = new URL(value);
            return u.origin;
        }
        catch {
            // fallback
        }
    }
    return value.replace(/\/+$/, '');
};
const allowedOrigins = (() => {
    const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
    const fromEnv = raw
        .split(',')
        .map((s) => normalizeAllowedOrigin(s))
        .filter(Boolean);
    const merged = Array.from(new Set([...defaultAllowedOrigins.map(normalizeAllowedOrigin), ...fromEnv]));
    return merged;
})();
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // En desarrollo permitimos cualquier Origin para evitar bloqueos por IP/hostname.
        if (process.env.NODE_ENV !== 'production') {
            callback(null, true);
            return;
        }
        // Permitir requests sin Origin (curl/postman)
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS: Origin no permitido: ${origin}`));
    },
    credentials: true
}));
// Mitigacion CSRF para auth via cookies:
// En browser, requests cross-site llevan el header Origin.
// Si el Origin no esta en whitelist, bloqueamos metodos con efecto (POST/PUT/PATCH/DELETE).
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        next();
        return;
    }
    const method = String(req.method || '').toUpperCase();
    const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (isSafeMethod) {
        next();
        return;
    }
    const origin = String(req.headers.origin || '').trim();
    if (!origin) {
        // curl/postman/no-origin
        next();
        return;
    }
    if (!allowedOrigins.includes(origin)) {
        res.status(403).json({ error: 'Origin no permitido' });
        return;
    }
    next();
});
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../../uploads')));
app.use('/api', security_middleware_1.generalLimiter);
if (!disableAuthLimiter) {
    app.use('/api/auth/login', security_middleware_1.authLimiter);
}
app.use('/api/auth/register', security_middleware_1.authLimiter);
app.use('/api/auth/google', security_middleware_1.authLimiter);
app.use('/api/orders/checkout', security_middleware_1.createOrderLimiter);
app.use('/api/ai/generate-description', security_middleware_1.aiLimiter);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/products', product_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/promotions', promotion_routes_1.default);
app.use('/api/orders', order_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/favorites', favorite_routes_1.default);
app.use('/api/reviews', review_routes_1.default);
app.use('/api/social', social_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Perfumissimo API is running' });
});
app.use(error_middleware_1.notFoundHandler);
app.use(error_middleware_1.errorHandler);
app.listen(Number(PORT), HOST, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
