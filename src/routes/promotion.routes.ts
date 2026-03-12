import { Router } from 'express';
import { createPromotion, getPromotions, getPromotionsAdmin, updatePromotion, updatePromotionActive, deletePromotion } from '../controllers/promotion.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createPromotionSchema, updatePromotionActiveSchema } from '../schemas/promotion.schema';
import { uploadSingleImage } from '../middleware/upload.middleware';

const router = Router();

router.get('/', getPromotions);

router.get('/admin', verifyToken, requireRole(['SUPERADMIN', 'ADMIN']), getPromotionsAdmin);

router.post('/', verifyToken, requireRole(['SUPERADMIN', 'ADMIN']), uploadSingleImage, validate(createPromotionSchema), createPromotion);

router.put('/:id', verifyToken, requireRole(['SUPERADMIN', 'ADMIN']), uploadSingleImage, validate(createPromotionSchema), updatePromotion);

// Toggle simple de activo/inactivo (evita revalidar fechas/reglas)
router.patch('/:id/active', verifyToken, requireRole(['SUPERADMIN', 'ADMIN']), validate(updatePromotionActiveSchema), updatePromotionActive);

router.delete('/:id', verifyToken, requireRole(['SUPERADMIN', 'ADMIN']), deletePromotion);

export default router;
