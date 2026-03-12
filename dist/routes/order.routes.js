"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const security_middleware_1 = require("../middleware/security.middleware");
const router = (0, express_1.Router)();
// Rutas para usuarios (crear orden y ver sus propias órdenes)
router.post('/', security_middleware_1.createOrderLimiter, auth_middleware_1.verifyToken, order_controller_1.OrderController.createOrder);
router.get('/my-orders', auth_middleware_1.verifyToken, order_controller_1.OrderController.getMyOrders);
router.get('/my-orders/:id', auth_middleware_1.verifyToken, order_controller_1.OrderController.getMyOrderById);
// Rutas para administradores (ver todas las órdenes y actualizar estados)
router.get('/', auth_middleware_1.verifyToken, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN', 'VENTAS']), order_controller_1.OrderController.getAllOrders);
router.get('/:id', auth_middleware_1.verifyToken, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN', 'VENTAS']), order_controller_1.OrderController.getOrderByIdAdmin);
router.put('/:id/status', auth_middleware_1.verifyToken, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN', 'VENTAS']), order_controller_1.OrderController.updateOrderStatus);
exports.default = router;
