import nodemailer from 'nodemailer';
import { pool } from '../config/database';

type MailOptions = {
    to: string;
    subject: string;
    html: string;
    text?: string;
};

let transporter: nodemailer.Transporter | null = null;

type SenderConfig = {
    from: string;
    replyTo?: string;
    bccOrders?: string;
};

let senderCache: { expiresAt: number; value: SenderConfig | null } | null = null;
let senderColsReady: boolean | null = null;

const detectSenderColumns = async (): Promise<boolean> => {
    if (senderColsReady !== null) return senderColsReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*)::int AS cnt
             FROM information_schema.columns
             WHERE table_name = 'configuracionglobal'
               AND column_name IN ('email_from_name','email_from_address','email_reply_to','email_bcc_orders')`
        );
        senderColsReady = Number(rows?.[0]?.cnt || 0) >= 4;
        return senderColsReady;
    } catch {
        senderColsReady = false;
        return false;
    }
};

const parseEmailList = (raw: string | null | undefined): string[] => {
    const value = String(raw || '').trim();
    if (!value) return [];
    return value
        .split(/\s|,|;/)
        .map((s) => s.trim())
        .filter(Boolean);
};

const buildFrom = (name: string | null | undefined, address: string | null | undefined, fallback: string): string => {
    const n = String(name || '').trim();
    const a = String(address || '').trim();
    if (a) {
        if (n) return `${n} <${a}>`;
        return a;
    }
    return fallback;
};

const resolveSenderConfig = async (): Promise<SenderConfig> => {
    const now = Date.now();
    if (senderCache && senderCache.expiresAt > now && senderCache.value) {
        return senderCache.value;
    }

    const fallbackFrom = String(process.env.SMTP_FROM || '').trim();
    const fallback: SenderConfig = { from: fallbackFrom };

    const colsReady = await detectSenderColumns();
    if (!colsReady) {
        senderCache = { expiresAt: now + 5 * 60 * 1000, value: fallback };
        return fallback;
    }

    try {
        const [rows] = await pool.query<any[]>(
            `SELECT email_from_name, email_from_address, email_reply_to, email_bcc_orders
             FROM ConfiguracionGlobal WHERE id = 1`
        );

        const r = rows?.[0] || {};
        const from = buildFrom(r.email_from_name, r.email_from_address, fallbackFrom);
        const replyTo = String(r.email_reply_to || '').trim() || undefined;
        const bccOrders = parseEmailList(r.email_bcc_orders).join(',') || undefined;

        const value: SenderConfig = { from, replyTo, bccOrders };
        senderCache = { expiresAt: now + 5 * 60 * 1000, value };
        return value;
    } catch {
        senderCache = { expiresAt: now + 2 * 60 * 1000, value: fallback };
        return fallback;
    }
};

const isEmailConfigured = (): boolean => {
    return !!(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM
    );
};

const getTransporter = (): nodemailer.Transporter => {
    if (transporter) return transporter;

    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').trim() === 'true';
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || '').trim();

    transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    return transporter;
};

export const sendEmail = async (options: MailOptions): Promise<void> => {
    if (!isEmailConfigured()) {
        // No romper el flujo de pedidos si no hay SMTP
        return;
    }

    const sender = await resolveSenderConfig();
    const t = getTransporter();
    await t.sendMail({
        from: sender.from,
        to: options.to,
        replyTo: sender.replyTo,
        bcc: sender.bccOrders,
        subject: options.subject,
        html: options.html,
        text: options.text
    });
};
