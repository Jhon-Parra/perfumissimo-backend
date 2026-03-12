import { Router } from 'express';
import { getUsers, updateUserRole, updateUserSegment } from '../controllers/user.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateUserRoleSchema, updateUserSegmentSchema } from '../schemas/user.schema';

const router = Router();

router.get('/', verifyToken, requireRole(['SUPERADMIN']), getUsers);

router.put('/:id/role', verifyToken, requireRole(['SUPERADMIN']), validate(updateUserRoleSchema), updateUserRole);

router.put('/:id/segment', verifyToken, requireRole(['SUPERADMIN']), validate(updateUserSegmentSchema), updateUserSegment);

export default router;
