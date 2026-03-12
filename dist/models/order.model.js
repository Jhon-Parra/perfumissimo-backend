"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderModel = void 0;
const database_1 = require("../config/database");
const uuid_1 = require("uuid");
class OrderModel {
    static async createOrder(orderData) {
        const connection = await database_1.pool.getConnection();
        try {
            await connection.query('BEGIN');
            const orderId = (0, uuid_1.v4)();
            // Insertar orden principal — nombres de columnas reales de la BD
            await connection.query(`INSERT INTO ordenes (id, usuario_id, total, direccion_envio, estado, codigo_transaccion)
                 VALUES ($1, $2, $3, $4, 'PENDIENTE', $5)`, [orderId, orderData.user_id, orderData.total, orderData.shipping_address, orderData.transaction_code || null]);
            // Insertar cada ítem de la orden
            for (const item of orderData.items) {
                const itemId = (0, uuid_1.v4)();
                await connection.query(`INSERT INTO detalle_ordenes (id, orden_id, producto_id, cantidad, precio_unitario)
                     VALUES ($1, $2, $3, $4, $5)`, [itemId, orderId, item.product_id, item.quantity, item.price]);
                // Descontar stock del producto
                const stockResult = await connection.query('UPDATE productos SET stock = stock - $1 WHERE id = $2 AND stock >= $1', [item.quantity, item.product_id]);
                if (stockResult?.rowCount === 0) {
                    throw new Error('Stock insuficiente para completar la orden');
                }
            }
            await connection.query('COMMIT');
            return orderId;
        }
        catch (error) {
            await connection.query('ROLLBACK');
            throw error;
        }
        finally {
            connection.release();
        }
    }
    static async getUserOrders(userId) {
        const [rows] = await database_1.pool.query(`SELECT 
                o.id,
                o.total,
                o.estado,
                o.direccion_envio,
                o.codigo_transaccion,
                o.creado_en,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'producto_id', d.producto_id,
                        'nombre', p.nombre,
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', d.subtotal,
                        'imagen_url', p.imagen_url
                    )
                ) as items
            FROM ordenes o
            JOIN detalle_ordenes d ON d.orden_id = o.id
            JOIN productos p ON p.id = d.producto_id
            WHERE o.usuario_id = $1
            GROUP BY o.id
            ORDER BY o.creado_en DESC`, [userId]);
        return rows;
    }
    static async getAllOrders(filters) {
        const status = (filters?.status || '').trim();
        const q = (filters?.q || '').trim();
        const params = [];
        let where = 'WHERE 1=1';
        if (status) {
            params.push(status);
            where += ` AND o.estado = $${params.length}`;
        }
        if (q) {
            params.push(`%${q}%`);
            where += ` AND (
                o.id::text ILIKE $${params.length}
                OR (u.nombre || ' ' || u.apellido) ILIKE $${params.length}
                OR u.email ILIKE $${params.length}
            )`;
        }
        const [rows] = await database_1.pool.query(`SELECT 
                o.id,
                o.total,
                o.estado,
                o.direccion_envio,
                o.codigo_transaccion,
                o.creado_en,
                u.nombre || ' ' || u.apellido AS cliente_nombre,
                u.email AS cliente_email,
                COUNT(d.id) AS total_items
            FROM ordenes o
            JOIN usuarios u ON u.id = o.usuario_id
            JOIN detalle_ordenes d ON d.orden_id = o.id
            ${where}
            GROUP BY o.id, u.nombre, u.apellido, u.email
            ORDER BY o.creado_en DESC`, params);
        return rows;
    }
    static async updateOrderStatus(orderId, estado) {
        await database_1.pool.query('UPDATE ordenes SET estado = $1, actualizado_en = NOW() WHERE id = $2', [estado, orderId]);
        return true;
    }
    static async updateTransactionCode(orderId, transactionCode) {
        await database_1.pool.query('UPDATE ordenes SET codigo_transaccion = $1, actualizado_en = NOW() WHERE id = $2', [transactionCode, orderId]);
    }
    static async cancelAndRestock(orderId) {
        const connection = await database_1.pool.getConnection();
        try {
            await connection.query('BEGIN');
            const resOrder = await connection.query('SELECT estado FROM ordenes WHERE id = $1 FOR UPDATE', [orderId]);
            const current = resOrder?.rows?.[0]?.estado;
            if (String(current || '').toUpperCase() === 'CANCELADO') {
                await connection.query('COMMIT');
                return;
            }
            await connection.query('UPDATE ordenes SET estado = $1, actualizado_en = NOW() WHERE id = $2', ['CANCELADO', orderId]);
            const resItems = await connection.query('SELECT producto_id, cantidad FROM detalle_ordenes WHERE orden_id = $1', [orderId]);
            const items = resItems?.rows || [];
            for (const it of items) {
                const pid = it?.producto_id;
                const qty = Number(it?.cantidad || 0);
                if (!pid || !Number.isFinite(qty) || qty <= 0)
                    continue;
                await connection.query('UPDATE productos SET stock = stock + $1 WHERE id = $2', [qty, pid]);
            }
            await connection.query('COMMIT');
        }
        catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        }
        finally {
            connection.release();
        }
    }
    static async getOrderById(orderId, userId) {
        let query = `
            SELECT 
                o.id, o.total, o.estado, o.direccion_envio, o.codigo_transaccion, o.creado_en,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'producto_id', d.producto_id,
                        'nombre', p.nombre,
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', d.subtotal,
                        'imagen_url', p.imagen_url
                    )
                ) as items
            FROM ordenes o
            JOIN detalle_ordenes d ON d.orden_id = o.id
            JOIN productos p ON p.id = d.producto_id
            WHERE o.id = $1`;
        const params = [orderId];
        if (userId) {
            query += ` AND o.usuario_id = $2`;
            params.push(userId);
        }
        query += ` GROUP BY o.id`;
        const [rows] = await database_1.pool.query(query, params);
        return rows[0] || null;
    }
    static async getAdminOrderById(orderId) {
        const [rows] = await database_1.pool.query(`SELECT 
                o.id,
                o.total,
                o.estado,
                o.direccion_envio,
                o.codigo_transaccion,
                o.creado_en,
                u.nombre || ' ' || u.apellido AS cliente_nombre,
                u.email AS cliente_email,
                u.telefono AS cliente_telefono,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'producto_id', d.producto_id,
                        'nombre', p.nombre,
                        'cantidad', d.cantidad,
                        'precio_unitario', d.precio_unitario,
                        'subtotal', d.subtotal,
                        'imagen_url', p.imagen_url
                    )
                    ORDER BY p.nombre
                ) as items
            FROM ordenes o
            JOIN usuarios u ON u.id = o.usuario_id
            JOIN detalle_ordenes d ON d.orden_id = o.id
            JOIN productos p ON p.id = d.producto_id
            WHERE o.id = $1
            GROUP BY o.id, u.nombre, u.apellido, u.email, u.telefono`, [orderId]);
        return rows?.[0] || null;
    }
}
exports.OrderModel = OrderModel;
