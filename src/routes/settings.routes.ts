import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateSettingsSchema } from '../schemas/settings.schema';
import upload from '../middleware/upload.middleware';

const router = Router();

router.get('/', getSettings);

router.put(
    '/',
    verifyToken,
    requireRole(['SUPERADMIN', 'ADMIN']),
    upload.fields([
        { name: 'hero_image', maxCount: 1 },
        { name: 'logo_image', maxCount: 1 }
    ]),
    validate(updateSettingsSchema),
    updateSettings
);

export default router;
