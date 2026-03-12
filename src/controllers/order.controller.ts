import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { OrderModel, CreateOrderParams } from '../models/order.model';
import { notifyOrderCreated, notifyOrderStatusChanged } from '../services/order-notification.service';

export class OrderController {
    static async createOrder(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const { total, shipping_address, items, transaction_code } = req.body;

            // Validaciones
            if (!total || total <= 0) {
                res.status(400).json({ message: 'Total de la orden inválido' });
                return;
            }
            if (!shipping_address || shipping_address.trim() === '') {
                res.status(400).json({ message: 'La dirección de envío es requerida' });
                return;
            }
            if (!items || items.length === 0) {
                res.status(400).json({ message: 'La orden debe tener al menos un producto' });
                return;
            }

            const orderData: CreateOrderParams = {
                user_id,
                total,
                shipping_address: shipping_address.trim(),
                items,
                transaction_code
            };

            const orderId = await OrderModel.createOrder(orderData);

            // Notificación (no bloquear respuesta)
            notifyOrderCreated(orderId).catch((e) => console.error('Order email error:', e));

            res.status(201).json({ message: 'Orden creada exitosamente', orderId });
        } catch (error: any) {
            console.error('Error al crear orden:', error);
            if (typeof error?.message === 'string' && error.message.toLowerCase().includes('stock insuficiente')) {
                res.status(409).json({ message: 'Stock insuficiente para completar la orden' });
                return;
            }
            res.status(500).json({ message: 'Error interno del servidor', detail: error.message });
        }
    }

    static async getMyOrders(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const orders = await OrderModel.getUserOrders(user_id);
            res.json(orders);
        } catch (error) {
            console.error('Error al obtener órdenes del usuario:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    static async getMyOrderById(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = String(req.params['id'] || '').trim();
            if (!id) {
                res.status(400).json({ message: 'ID de orden requerido' });
                return;
            }

            const order = await OrderModel.getOrderById(id, user_id);
            if (!order) {
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }

            res.status(200).json(order);
        } catch (error) {
            console.error('Error al obtener orden del usuario:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    static async getAllOrders(req: AuthRequest, res: Response): Promise<void> {
        try {
            const status = String(req.query['status'] || '').trim();
            const q = String(req.query['q'] || '').trim();
            const orders = await OrderModel.getAllOrders({ status, q });
            res.json(orders);
        } catch (error) {
            console.error('Error al obtener todas las órdenes:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    static async getOrderByIdAdmin(req: AuthRequest, res: Response): Promise<void> {
        try {
            const id = String(req.params['id'] || '').trim();
            if (!id) {
                res.status(400).json({ message: 'ID de orden requerido' });
                return;
            }

            const order = await OrderModel.getAdminOrderById(id);
            if (!order) {
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }
            res.json(order);
        } catch (error) {
            console.error('Error al obtener detalle de orden:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    static async updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
        try {
            const id = req.params['id'] as string;
            const { estado } = req.body;

            const validStates = ['PENDIENTE', 'PAGADO', 'PROCESANDO', 'ENVIADO', 'CANCELADO', 'ENTREGADO'];
            if (!validStates.includes(estado)) {
                res.status(400).json({ message: `Estado inválido. Valores permitidos: ${validStates.join(', ')}` });
                return;
            }

            await OrderModel.updateOrderStatus(id, estado);

            // Notificación (no bloquear respuesta)
            notifyOrderStatusChanged(id, estado).catch((e) => console.error('Order status email error:', e));

            res.json({ message: 'Estado actualizado exitosamente' });
        } catch (error: any) {
            console.error('Error al actualizar estado:', error);
            const msg = String(error?.message || '').toLowerCase();
            if (msg.includes('ordenes_estado_check')) {
                res.status(400).json({
                    message: 'Tu base de datos no soporta el estado PROCESANDO. Ejecuta database/migrations/20260312_orders_add_processing.sql en Supabase.'
                });
                return;
            }
            res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
}
