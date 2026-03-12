"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettingsSchema = void 0;
const zod_1 = require("zod");
const emptyToUndefined = (val) => {
    if (val === undefined || val === null)
        return undefined;
    if (typeof val === 'string' && val.trim() === '')
        return undefined;
    return val;
};
const intOptional = (min, max) => zod_1.z.preprocess(emptyToUndefined, zod_1.z.coerce.number().int().min(min).max(max)).optional();
exports.updateSettingsSchema = zod_1.z.object({
    hero_title: zod_1.z.string().min(1, 'Título requerido').max(255),
    hero_subtitle: zod_1.z.string().min(1, 'Subtítulo requerido').max(500),
    accent_color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser formato hex (#FF0000)'),
    show_banner: zod_1.z.preprocess((val) => val === 'true' || val === true, zod_1.z.boolean()).optional(),
    banner_text: zod_1.z.string().max(255).optional(),
    logo_height_mobile: intOptional(24, 220),
    logo_height_desktop: intOptional(24, 260),
    instagram_url: zod_1.z.string().max(500).optional(),
    instagram_access_token: zod_1.z.string().max(500).optional(),
    facebook_url: zod_1.z.string().max(500).optional(),
    whatsapp_number: zod_1.z.string().max(40).optional(),
    whatsapp_message: zod_1.z.string().max(255).optional(),
    email_from_name: zod_1.z.string().max(120).optional(),
    email_from_address: zod_1.z.string().max(200).optional(),
    email_reply_to: zod_1.z.string().max(200).optional(),
    email_bcc_orders: zod_1.z.string().max(500).optional(),
    boutique_title: zod_1.z.string().max(120).optional(),
    boutique_address_line1: zod_1.z.string().max(200).optional(),
    boutique_address_line2: zod_1.z.string().max(200).optional(),
    boutique_phone: zod_1.z.string().max(60).optional(),
    boutique_email: zod_1.z.string().max(200).optional()
});
