"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = void 0;
const database_1 = require("../config/database");
const zod_1 = require("zod");
const toNumber = (val) => {
    if (val === null || val === undefined)
        return 0;
    if (typeof val === 'number' && Number.isFinite(val))
        return val;
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
};
const normalizeOrderStateExpr = (colExpr) => {
    // estado puede ser VARCHAR o ENUM; forzamos a text para poder aplicar COALESCE/TRIM/UPPER
    return `UPPER(TRIM(COALESCE((${colExpr})::text, '')))`;
};
const getDashboardSummary = async (req, res) => {
    try {
        // Ventas: considerar pedidos confirmados (excluye PENDIENTE/CANCELADO)
        const okStates = ['PAGADO', 'PROCESANDO', 'ENVIADO', 'ENTREGADO'];
        const normalizedStateExpr = normalizeOrderStateExpr('estado');
        const monthsBackParsed = zod_1.z.coerce.number().int().min(1).max(24).catch(12).parse(req.query?.months_back);
        const monthsBack = monthsBackParsed || 12;
        const [revRows] = await database_1.pool.query(`SELECT COALESCE(SUM(total), 0) AS total
             FROM ordenes
             WHERE ${normalizedStateExpr} = ANY($1::text[])`, [okStates]);
        const [byStatusRows] = await database_1.pool.query(`SELECT ${normalizedStateExpr} AS estado, COUNT(*)::int AS count
             FROM ordenes
             GROUP BY 1`);
        const orders_by_status = {
            PENDIENTE: 0,
            PAGADO: 0,
            PROCESANDO: 0,
            ENVIADO: 0,
            ENTREGADO: 0,
            CANCELADO: 0
        };
        for (const r of byStatusRows || []) {
            const key = String(r.estado || '').toUpperCase();
            if (orders_by_status[key] !== undefined) {
                orders_by_status[key] = toNumber(r.count);
            }
        }
        const [pendingRows] = await database_1.pool.query(`SELECT COUNT(*)::int AS count
             FROM ordenes
             WHERE ${normalizedStateExpr} = 'PENDIENTE'`);
        const [prodRows] = await database_1.pool.query(`SELECT COUNT(*)::int AS count
             FROM productos`);
        const [userRows] = await database_1.pool.query(`SELECT COUNT(*)::int AS count
             FROM usuarios`);
        const [monthRows] = await database_1.pool.query(`WITH months AS (
                SELECT generate_series(
                    date_trunc('month', NOW()) - (($2::int - 1) * interval '1 month'),
                    date_trunc('month', NOW()),
                    interval '1 month'
                ) AS month_start
            ),
            sales AS (
                SELECT
                    date_trunc('month', o.creado_en) AS month_start,
                    COALESCE(SUM(o.total), 0) AS revenue,
                    COUNT(*)::int AS orders_count
                FROM ordenes o
                WHERE ${normalizeOrderStateExpr('o.estado')} = ANY($1::text[])
                  AND o.creado_en >= (date_trunc('month', NOW()) - (($2::int - 1) * interval '1 month'))
                  AND o.creado_en < (date_trunc('month', NOW()) + interval '1 month')
                GROUP BY 1
            )
            SELECT
                m.month_start,
                COALESCE(s.revenue, 0) AS revenue,
                COALESCE(s.orders_count, 0)::int AS orders_count
            FROM months m
            LEFT JOIN sales s ON s.month_start = m.month_start
            ORDER BY m.month_start ASC`, [okStates, monthsBack]);
        const [pendingPreviewRows] = await database_1.pool.query(`SELECT
                o.id,
                o.total,
                o.estado::text AS estado,
                o.creado_en,
                (u.nombre || ' ' || u.apellido) AS cliente_nombre,
                u.email AS cliente_email,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'producto_id', d.producto_id,
                        'nombre', p.nombre,
                        'cantidad', d.cantidad,
                        'imagen_url', p.imagen_url
                    )
                    ORDER BY p.nombre
                ) AS items
            FROM ordenes o
            JOIN usuarios u ON u.id = o.usuario_id
            JOIN detalle_ordenes d ON d.orden_id = o.id
            JOIN productos p ON p.id = d.producto_id
            WHERE ${normalizeOrderStateExpr('o.estado')} = 'PENDIENTE'
            GROUP BY o.id, u.nombre, u.apellido, u.email
            ORDER BY o.creado_en DESC
            LIMIT 10`);
        const pending_orders_preview = (pendingPreviewRows || []).map((r) => ({
            id: String(r.id),
            total: toNumber(r.total),
            estado: String(r.estado || ''),
            creado_en: r.creado_en,
            cliente_nombre: String(r.cliente_nombre || 'Cliente'),
            cliente_email: String(r.cliente_email || ''),
            items: Array.isArray(r.items)
                ? r.items.map((it) => ({
                    producto_id: String(it.producto_id),
                    nombre: String(it.nombre || ''),
                    cantidad: toNumber(it.cantidad),
                    imagen_url: it.imagen_url ? String(it.imagen_url) : null
                }))
                : []
        }));
        const [topRows] = await database_1.pool.query(`SELECT
                p.id,
                p.nombre,
                p.imagen_url,
                COALESCE(SUM(d.cantidad), 0)::int AS unidades,
                COALESCE(SUM(d.subtotal), 0) AS ingresos
             FROM detalle_ordenes d
             JOIN ordenes o ON o.id = d.orden_id
             JOIN productos p ON p.id = d.producto_id
             WHERE ${normalizeOrderStateExpr('o.estado')} = ANY($1::text[])
             GROUP BY p.id, p.nombre, p.imagen_url
             ORDER BY unidades DESC, ingresos DESC
             LIMIT 5`, [okStates]);
        const top_products = (topRows || []).map((r) => ({
            id: String(r.id),
            nombre: String(r.nombre || ''),
            imagen_url: r.imagen_url ? String(r.imagen_url) : null,
            unidades: toNumber(r.unidades),
            ingresos: toNumber(r.ingresos)
        }));
        res.status(200).json({
            months_back: monthsBack,
            total_revenue: toNumber(revRows?.[0]?.total),
            pending_orders: toNumber(pendingRows?.[0]?.count),
            products_count: toNumber(prodRows?.[0]?.count),
            users_count: toNumber(userRows?.[0]?.count),
            orders_by_status,
            monthly_sales: (monthRows || []).map((r) => ({
                month_start: r.month_start,
                revenue: toNumber(r.revenue),
                orders_count: toNumber(r.orders_count)
            })),
            pending_orders_preview,
            top_products
        });
    }
    catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ error: 'Error al cargar métricas del dashboard' });
    }
};
exports.getDashboardSummary = getDashboardSummary;
