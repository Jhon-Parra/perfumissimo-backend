"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const database_1 = require("../config/database");
let transporter = null;
let warnedNotConfigured = false;
let senderCache = null;
let senderColsReady = null;
const detectSenderColumns = async () => {
    if (senderColsReady !== null)
        return senderColsReady;
    try {
        const [rows] = await database_1.pool.query(`SELECT COUNT(*)::int AS cnt
             FROM information_schema.columns
             WHERE table_name = 'configuracionglobal'
               AND column_name IN ('email_from_name','email_from_address','email_reply_to','email_bcc_orders')`);
        senderColsReady = Number(rows?.[0]?.cnt || 0) >= 4;
        return senderColsReady;
    }
    catch {
        senderColsReady = false;
        return false;
    }
};
const parseEmailList = (raw) => {
    const value = String(raw || '').trim();
    if (!value)
        return [];
    return value
        .split(/\s|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
};
const buildFrom = (name, address, fallback) => {
    const n = String(name || '').trim();
    const a = String(address || '').trim();
    if (a) {
        if (n)
            return `${n} <${a}>`;
        return a;
    }
    return fallback;
};
const resolveSenderConfig = async () => {
    const now = Date.now();
    if (senderCache && senderCache.expiresAt > now && senderCache.value) {
        return senderCache.value;
    }
    const fallbackFrom = String(process.env.SMTP_FROM || '').trim();
    const fallback = { from: fallbackFrom };
    const colsReady = await detectSenderColumns();
    if (!colsReady) {
        senderCache = { expiresAt: now + 5 * 60 * 1000, value: fallback };
        return fallback;
    }
    try {
        const [rows] = await database_1.pool.query(`SELECT email_from_name, email_from_address, email_reply_to, email_bcc_orders
             FROM ConfiguracionGlobal WHERE id = 1`);
        const r = rows?.[0] || {};
        const from = buildFrom(r.email_from_name, r.email_from_address, fallbackFrom);
        const replyTo = String(r.email_reply_to || '').trim() || undefined;
        const bccOrders = parseEmailList(r.email_bcc_orders).join(',') || undefined;
        const value = { from, replyTo, bccOrders };
        senderCache = { expiresAt: now + 5 * 60 * 1000, value };
        return value;
    }
    catch {
        senderCache = { expiresAt: now + 2 * 60 * 1000, value: fallback };
        return fallback;
    }
};
const isEmailConfigured = () => {
    return !!(process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM);
};
const getTransporter = () => {
    if (transporter)
        return transporter;
    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').trim() === 'true';
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || '').trim();
    transporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });
    return transporter;
};
const sendEmail = async (options) => {
    if (!isEmailConfigured()) {
        // No romper el flujo de pedidos si no hay SMTP
        if (!warnedNotConfigured) {
            warnedNotConfigured = true;
            console.warn('[email] SMTP no configurado. Omitiendo envio de correos. Configura SMTP_* en .env');
        }
        return;
    }
    const sender = await resolveSenderConfig();
    const t = getTransporter();
    try {
        console.log(`[EmailService] Intentando enviar correo a: ${options.to} con asunto: "${options.subject}"`);
        const info = await t.sendMail({
            from: sender.from,
            to: options.to,
            replyTo: sender.replyTo,
            bcc: sender.bccOrders,
            subject: options.subject,
            html: options.html,
            text: options.text
        });
        console.log(`[EmailService] ✅ Correo enviado exitosamente a ${options.to}. MessageId: ${info.messageId}`);
    }
    catch (err) {
        console.error(`[EmailService] ❌ Falla crítica al enviar correo a ${options.to}. Detalle:`, err?.message || err);
        // No lanzamos (re-throw) el error para evitar que el request HTTP de checkout devuelva 500
        // y el usuario piense que la orden falló por culpa del correo.
    }
};
exports.sendEmail = sendEmail;
