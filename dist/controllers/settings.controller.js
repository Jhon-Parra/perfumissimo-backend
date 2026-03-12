"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = void 0;
const database_1 = require("../config/database");
const supabase_1 = require("../config/supabase");
const upload_middleware_1 = require("../middleware/upload.middleware");
const normalizeNullableString = (value, maxLen) => {
    if (value === undefined || value === null)
        return null;
    const v = String(value).trim();
    if (!v)
        return null;
    return v.length > maxLen ? v.slice(0, maxLen) : v;
};
const detectColumns = async (columns) => {
    try {
        const [rows] = await database_1.pool.query(`SELECT column_name
             FROM information_schema.columns
             WHERE table_name = 'configuracionglobal'
               AND column_name = ANY($1::text[])`, [columns]);
        const found = new Set((rows || []).map((r) => String(r.column_name)));
        const result = {};
        for (const c of columns)
            result[c] = found.has(c);
        return result;
    }
    catch {
        const result = {};
        for (const c of columns)
            result[c] = false;
        return result;
    }
};
const getSettings = async (req, res) => {
    try {
        const cols = await detectColumns([
            'logo_url',
            'logo_height_mobile',
            'logo_height_desktop',
            'instagram_url',
            'facebook_url',
            'whatsapp_number',
            'whatsapp_message',
            'email_from_name',
            'email_from_address',
            'email_reply_to',
            'email_bcc_orders',
            'instagram_access_token',
            'boutique_title',
            'boutique_address_line1',
            'boutique_address_line2',
            'boutique_phone',
            'boutique_email'
        ]);
        const selectParts = [
            'hero_title',
            'hero_subtitle',
            'accent_color',
            'show_banner',
            'banner_text',
            'hero_image_url'
        ];
        if (cols.logo_url)
            selectParts.push('logo_url');
        if (cols.logo_height_mobile)
            selectParts.push('logo_height_mobile');
        if (cols.logo_height_desktop)
            selectParts.push('logo_height_desktop');
        if (cols.instagram_url)
            selectParts.push('instagram_url');
        if (cols.facebook_url)
            selectParts.push('facebook_url');
        if (cols.whatsapp_number)
            selectParts.push('whatsapp_number');
        if (cols.whatsapp_message)
            selectParts.push('whatsapp_message');
        if (cols.email_from_name)
            selectParts.push('email_from_name');
        if (cols.email_from_address)
            selectParts.push('email_from_address');
        if (cols.email_reply_to)
            selectParts.push('email_reply_to');
        if (cols.email_bcc_orders)
            selectParts.push('email_bcc_orders');
        if (cols.boutique_title)
            selectParts.push('boutique_title');
        if (cols.boutique_address_line1)
            selectParts.push('boutique_address_line1');
        if (cols.boutique_address_line2)
            selectParts.push('boutique_address_line2');
        if (cols.boutique_phone)
            selectParts.push('boutique_phone');
        if (cols.boutique_email)
            selectParts.push('boutique_email');
        const [newRows] = await database_1.pool.query(`SELECT ${selectParts.join(', ')} FROM ConfiguracionGlobal WHERE id = 1`);
        const rows = newRows;
        if (rows.length === 0) {
            res.status(404).json({ error: 'Configuración no encontrada' });
            return;
        }
        const settings = {
            ...rows[0],
            show_banner: !!rows[0].show_banner,
            instagram_feed_configured: false
        };
        // Calcular si hay token configurado (sin exponerlo)
        if (cols.instagram_access_token) {
            try {
                const [cfgRows] = await database_1.pool.query('SELECT (instagram_access_token IS NOT NULL AND LENGTH(TRIM(instagram_access_token)) > 0) AS configured FROM ConfiguracionGlobal WHERE id = 1');
                settings.instagram_feed_configured = !!cfgRows?.[0]?.configured;
            }
            catch {
                settings.instagram_feed_configured = false;
            }
        }
        res.status(200).json(settings);
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Error al obtener la configuración' });
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res) => {
    try {
        const { hero_title, hero_subtitle, accent_color, show_banner, banner_text, logo_height_mobile, logo_height_desktop, instagram_url, instagram_access_token, facebook_url, whatsapp_number, whatsapp_message, email_from_name, email_from_address, email_reply_to, email_bcc_orders, boutique_title, boutique_address_line1, boutique_address_line2, boutique_phone, boutique_email } = req.body;
        const files = req.files;
        const heroFile = files?.['hero_image']?.[0];
        const logoFile = files?.['logo_image']?.[0];
        let hero_image_url = undefined;
        if (heroFile) {
            const uniqueFilename = (0, upload_middleware_1.sanitizeFilename)(heroFile.originalname);
            const { data, error } = await supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .upload(`settings/${uniqueFilename}`, heroFile.buffer, {
                contentType: heroFile.mimetype,
                upsert: true
            });
            if (error) {
                console.error('Supabase upload error:', error);
                throw new Error('Error subiendo la imagen a Supabase');
            }
            const { data: publicData } = supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`settings/${uniqueFilename}`);
            hero_image_url = publicData.publicUrl;
        }
        let logo_url = undefined;
        if (logoFile) {
            const uniqueFilename = (0, upload_middleware_1.sanitizeFilename)(logoFile.originalname);
            const { error } = await supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .upload(`settings/${uniqueFilename}`, logoFile.buffer, {
                contentType: logoFile.mimetype,
                upsert: true
            });
            if (error) {
                console.error('Supabase upload error:', error);
                throw new Error('Error subiendo el logo a Supabase');
            }
            const { data: publicData } = supabase_1.supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`settings/${uniqueFilename}`);
            logo_url = publicData.publicUrl;
        }
        let query = `UPDATE ConfiguracionGlobal SET hero_title = ?, hero_subtitle = ?, accent_color = ?, show_banner = ?, banner_text = ?`;
        const columns = await detectColumns([
            'logo_url',
            'logo_height_mobile',
            'logo_height_desktop',
            'instagram_url',
            'facebook_url',
            'whatsapp_number',
            'whatsapp_message',
            'instagram_access_token',
            'email_from_name',
            'email_from_address',
            'email_reply_to',
            'email_bcc_orders',
            'boutique_title',
            'boutique_address_line1',
            'boutique_address_line2',
            'boutique_phone',
            'boutique_email'
        ]);
        const params = [hero_title, hero_subtitle, accent_color, !!show_banner, banner_text];
        const wantsInstagramToken = typeof instagram_access_token === 'string' && instagram_access_token.trim().length > 0;
        const wantsEmailSender = [email_from_name, email_from_address, email_reply_to, email_bcc_orders]
            .some((v) => typeof v === 'string' && v.trim().length > 0);
        const hasBoutiquePayload = boutique_title !== undefined ||
            boutique_address_line1 !== undefined ||
            boutique_address_line2 !== undefined ||
            boutique_phone !== undefined ||
            boutique_email !== undefined;
        const mobileHeightRaw = logo_height_mobile;
        const desktopHeightRaw = logo_height_desktop;
        const heightsProvided = (mobileHeightRaw !== undefined && mobileHeightRaw !== null && String(mobileHeightRaw).trim() !== '') ||
            (desktopHeightRaw !== undefined && desktopHeightRaw !== null && String(desktopHeightRaw).trim() !== '');
        if ((logoFile || heightsProvided) && (!columns.logo_url || !columns.logo_height_mobile || !columns.logo_height_desktop)) {
            const mobileN = mobileHeightRaw !== undefined && mobileHeightRaw !== null && String(mobileHeightRaw).trim() !== '' ? Number(mobileHeightRaw) : undefined;
            const desktopN = desktopHeightRaw !== undefined && desktopHeightRaw !== null && String(desktopHeightRaw).trim() !== '' ? Number(desktopHeightRaw) : undefined;
            const tryingNonDefaultHeights = (mobileN !== undefined && Number.isFinite(mobileN) && mobileN !== 96) ||
                (desktopN !== undefined && Number.isFinite(desktopN) && desktopN !== 112);
            if (logoFile || tryingNonDefaultHeights) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta la configuración del logo. Ejecuta database/migrations/20260312_settings_logo.sql en Supabase y vuelve a intentar.'
                });
                return;
            }
            // Si solo vienen los valores por defecto desde el frontend y la BD no tiene columnas, ignorar.
        }
        if (columns.logo_height_mobile) {
            if (logo_height_mobile !== undefined) {
                query += `, logo_height_mobile = ?`;
                params.push(logo_height_mobile === null ? null : Number(logo_height_mobile));
            }
        }
        if (columns.logo_height_desktop) {
            if (logo_height_desktop !== undefined) {
                query += `, logo_height_desktop = ?`;
                params.push(logo_height_desktop === null ? null : Number(logo_height_desktop));
            }
        }
        if (columns.instagram_url) {
            query += `, instagram_url = ?`;
            params.push(normalizeNullableString(instagram_url, 500));
        }
        if (columns.facebook_url) {
            query += `, facebook_url = ?`;
            params.push(normalizeNullableString(facebook_url, 500));
        }
        if (columns.whatsapp_number) {
            query += `, whatsapp_number = ?`;
            params.push(normalizeNullableString(whatsapp_number, 40));
        }
        if (columns.whatsapp_message) {
            query += `, whatsapp_message = ?`;
            params.push(normalizeNullableString(whatsapp_message, 255));
        }
        if (wantsInstagramToken) {
            if (!columns.instagram_access_token) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta el token de Instagram. Ejecuta database/migrations/20260312_settings_instagram_token.sql en Supabase y vuelve a intentar.'
                });
                return;
            }
            query += `, instagram_access_token = ?`;
            params.push(normalizeNullableString(instagram_access_token, 500));
        }
        if (wantsEmailSender) {
            if (!columns.email_from_name || !columns.email_from_address || !columns.email_reply_to || !columns.email_bcc_orders) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta la configuración de correo. Ejecuta database/migrations/20260312_settings_email_sender.sql en Supabase y vuelve a intentar.'
                });
                return;
            }
            query += `, email_from_name = ?, email_from_address = ?, email_reply_to = ?, email_bcc_orders = ?`;
            params.push(normalizeNullableString(email_from_name, 120), normalizeNullableString(email_from_address, 200), normalizeNullableString(email_reply_to, 200), normalizeNullableString(email_bcc_orders, 500));
        }
        if (hasBoutiquePayload) {
            const hasAllBoutiqueCols = !!columns.boutique_title &&
                !!columns.boutique_address_line1 &&
                !!columns.boutique_address_line2 &&
                !!columns.boutique_phone &&
                !!columns.boutique_email;
            // Si el frontend manda defaults pero la BD aun no tiene columnas, no bloquear el guardado.
            // Solo forzamos migracion si el usuario intenta cambiar valores no-default.
            if (!hasAllBoutiqueCols) {
                const defaults = {
                    boutique_title: 'Nuestra Boutique',
                    boutique_address_line1: 'Calle 12 #13-85',
                    boutique_address_line2: 'Bogotá, Colombia',
                    boutique_phone: '+57 (300) 123-4567',
                    boutique_email: 'contacto@perfumissimo.com'
                };
                const provided = {
                    boutique_title: String(boutique_title ?? '').trim(),
                    boutique_address_line1: String(boutique_address_line1 ?? '').trim(),
                    boutique_address_line2: String(boutique_address_line2 ?? '').trim(),
                    boutique_phone: String(boutique_phone ?? '').trim(),
                    boutique_email: String(boutique_email ?? '').trim()
                };
                const tryingNonDefault = (provided.boutique_title && provided.boutique_title !== defaults.boutique_title) ||
                    (provided.boutique_address_line1 && provided.boutique_address_line1 !== defaults.boutique_address_line1) ||
                    (provided.boutique_address_line2 && provided.boutique_address_line2 !== defaults.boutique_address_line2) ||
                    (provided.boutique_phone && provided.boutique_phone !== defaults.boutique_phone) ||
                    (provided.boutique_email && provided.boutique_email !== defaults.boutique_email);
                if (tryingNonDefault) {
                    res.status(400).json({
                        error: 'Tu base de datos no soporta la info de la boutique. Ejecuta database/migrations/20260312_settings_boutique_contact.sql en Supabase y vuelve a intentar.'
                    });
                    return;
                }
                // Ignorar estos campos (no existen en BD)
            }
            else {
                query += `, boutique_title = ?, boutique_address_line1 = ?, boutique_address_line2 = ?, boutique_phone = ?, boutique_email = ?`;
                params.push(normalizeNullableString(boutique_title, 120), normalizeNullableString(boutique_address_line1, 200), normalizeNullableString(boutique_address_line2, 200), normalizeNullableString(boutique_phone, 60), normalizeNullableString(boutique_email, 200));
            }
        }
        if (hero_image_url) {
            query += `, hero_image_url = ?`;
            params.push(hero_image_url);
        }
        if (logo_url) {
            if (!columns.logo_url) {
                res.status(400).json({
                    error: 'Tu base de datos no soporta la configuración del logo. Ejecuta database/migrations/20260312_settings_logo.sql en Supabase y vuelve a intentar.'
                });
                return;
            }
            query += `, logo_url = ?`;
            params.push(logo_url);
        }
        query += ` WHERE id = 1`;
        const [result] = await database_1.pool.query(query, params);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'No se pudo actualizar la configuración' });
            return;
        }
        res.status(200).json({ message: 'Configuración actualizada exitosamente', hero_image_url, logo_url });
    }
    catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar configuración' });
    }
};
exports.updateSettings = updateSettings;
