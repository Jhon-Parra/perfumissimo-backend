import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { verifyToken, requireRole } from '../middleware/auth.middleware';
import { createOrderLimiter } from '../middleware/security.middleware';

const router = Router();

// Rutas para usuarios (crear orden y ver sus propias órdenes)
router.post('/', createOrderLimiter, verifyToken, OrderController.createOrder);
router.get('/my-orders', verifyToken, OrderController.getMyOrders);
router.get('/my-orders/:id', verifyToken, OrderController.getMyOrderById);

// Rutas para administradores (ver todas las órdenes y actualizar estados)
router.get('/', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'VENTAS']), OrderController.getAllOrders);
router.get('/:id', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'VENTAS']), OrderController.getOrderByIdAdmin);
router.put('/:id/status', verifyToken, requireRole(['SUPERADMIN', 'ADMIN', 'VENTAS']), OrderController.updateOrderStatus);

export default router;
