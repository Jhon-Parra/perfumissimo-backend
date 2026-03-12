import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS']), getDashboardSummary);

export default router;
