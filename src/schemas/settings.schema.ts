import { z } from 'zod';

const emptyToUndefined = (val: any) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return val;
};

const intOptional = (min: number, max: number) =>
    z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max)).optional();

export const updateSettingsSchema = z.object({
    hero_title: z.string().min(1, 'Título requerido').max(255),
    hero_subtitle: z.string().min(1, 'Subtítulo requerido').max(500),
    accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser formato hex (#FF0000)'),
    show_banner: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    banner_text: z.string().max(255).optional(),

    logo_height_mobile: intOptional(24, 220),
    logo_height_desktop: intOptional(24, 260),

    instagram_url: z.string().max(500).optional(),
    instagram_access_token: z.string().max(500).optional(),
    facebook_url: z.string().max(500).optional(),
    whatsapp_number: z.string().max(40).optional(),
    whatsapp_message: z.string().max(255).optional(),

    email_from_name: z.string().max(120).optional(),
    email_from_address: z.string().max(200).optional(),
    email_reply_to: z.string().max(200).optional(),
    email_bcc_orders: z.string().max(500).optional(),

    boutique_title: z.string().max(120).optional(),
    boutique_address_line1: z.string().max(200).optional(),
    boutique_address_line2: z.string().max(200).optional(),
    boutique_phone: z.string().max(60).optional(),
    boutique_email: z.string().max(200).optional()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
