import { Request, Response } from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';
import { sanitizeFilename } from '../middleware/upload.middleware';

let promotionAssignmentReady: boolean | null = null;
let promotionMediaReady: boolean | null = null;
let promotionAdvancedReady: boolean | null = null;

const detectPromotionAssignmentSchema = async (): Promise<boolean> => {
    if (promotionAssignmentReady !== null) return promotionAssignmentReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT
                to_regclass('promocionproductos') IS NOT NULL AS has_pp,
                to_regclass('promocionusuarios') IS NOT NULL AS has_pu,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'promociones' AND column_name = 'product_scope'
                ) AS has_product_scope,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'promociones' AND column_name = 'audience_scope'
                ) AS has_audience_scope
            `
        );

        const r = rows?.[0] || {};
        promotionAssignmentReady = !!(r.has_pp && r.has_pu && r.has_product_scope && r.has_audience_scope);
        return promotionAssignmentReady;
    } catch {
        promotionAssignmentReady = false;
        return false;
    }
};

const detectPromotionMediaSchema = async (): Promise<boolean> => {
    if (promotionMediaReady !== null) return promotionMediaReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'promociones' AND column_name = 'product_gender'
                ) AS has_product_gender,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'promociones' AND column_name = 'imagen_url'
                ) AS has_imagen_url
            `
        );

        const r = rows?.[0] || {};
        promotionMediaReady = !!(r.has_product_gender && r.has_imagen_url);
        return promotionMediaReady;
    } catch {
        promotionMediaReady = false;
        return false;
    }
};

const detectPromotionAdvancedSchema = async (): Promise<boolean> => {
    if (promotionAdvancedReady !== null) return promotionAdvancedReady;
    try {
        const [rows] = await pool.query<any[]>(
            `SELECT
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'promociones' AND column_name = 'discount_type'
                ) AS has_discount_type,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'promociones' AND column_name = 'amount_discount'
                ) AS has_amount_discount,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'promociones' AND column_name = 'priority'
                ) AS has_priority
            `
        );
        const r = rows?.[0] || {};
        promotionAdvancedReady = !!(r.has_discount_type && r.has_amount_discount && r.has_priority);
        return promotionAdvancedReady;
    } catch {
        promotionAdvancedReady = false;
        return false;
    }
};

export const createPromotion = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            nombre,
            descripcion,
            product_gender,
            discount_type,
            porcentaje_descuento,
            amount_discount,
            priority,
            fecha_inicio,
            fecha_fin,
            activo,
            product_scope,
            product_ids,
            audience_scope,
            audience_segment,
            audience_user_ids
        } = req.body;
        const id = uuidv4();

        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const advancedReady = await detectPromotionAdvancedSchema();

        if (!assignmentReady) {
            res.status(400).json({ error: 'Tu base de datos no soporta reglas de asignacion de promociones. Aplica la migracion primero.' });
            return;
        }
        if (!mediaReady && ((req as any).file || (product_scope || 'GLOBAL') === 'GENDER')) {
            res.status(400).json({ error: 'Tu base de datos no soporta imagen o filtro por genero. Ejecuta la migracion 20260312_promotions_image_and_gender.sql.' });
            return;
        }

        const wantsAdvanced =
            typeof discount_type === 'string' ||
            amount_discount !== undefined ||
            priority !== undefined;

        if (wantsAdvanced && !advancedReady) {
            res.status(400).json({
                error: 'Tu base de datos no soporta descuento fijo/prioridad. Ejecuta database/migrations/20260312_promotions_amount_and_priority.sql en Supabase.'
            });
            return;
        }

        let imagen_url: string | null = null;
        if (mediaReady && (req as any).file) {
            const file = (req as any).file as Express.Multer.File;
            const uniqueFilename = sanitizeFilename(file.originalname);
            const { error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(`promotions/${uniqueFilename}`, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });
            if (error) throw new Error('Error subiendo imagen de promocion a Supabase: ' + error.message);

            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`promotions/${uniqueFilename}`);
            imagen_url = publicData.publicUrl;
        }

        const connection = await pool.getConnection();
        try {
            await connection.query('BEGIN');

            const dtype = advancedReady ? (String(discount_type || 'PERCENT').toUpperCase()) : 'PERCENT';
            const pct = dtype === 'AMOUNT' ? 0 : Number(porcentaje_descuento || 0);
            const amount = dtype === 'AMOUNT' ? Number(amount_discount || 0) : null;
            const prio = advancedReady ? Number(priority || 0) : 0;

            if (mediaReady) {
                await connection.query(
                    `INSERT INTO Promociones (
                        id, nombre, descripcion, imagen_url, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin,
                        product_scope, product_gender, audience_scope, audience_segment, activo
                    )
                    VALUES (${advancedReady ? '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15' : '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12'})`,
                    [
                        id,
                        nombre,
                        descripcion,
                        imagen_url,
                        pct,
                        ...(advancedReady ? [dtype, amount, prio] : []),
                        fecha_inicio,
                        fecha_fin,
                        product_scope || 'GLOBAL',
                        (product_scope || 'GLOBAL') === 'GENDER' ? (product_gender || null) : null,
                        audience_scope || 'ALL',
                        audience_segment || null,
                        activo ?? true
                    ]
                );
            } else {
                await connection.query(
                    `INSERT INTO Promociones (
                        id, nombre, descripcion, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin,
                        product_scope, audience_scope, audience_segment, activo
                    )
                    VALUES (${advancedReady ? '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13' : '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10'})`,
                    [
                        id,
                        nombre,
                        descripcion,
                        pct,
                        ...(advancedReady ? [dtype, amount, prio] : []),
                        fecha_inicio,
                        fecha_fin,
                        product_scope || 'GLOBAL',
                        audience_scope || 'ALL',
                        audience_segment || null,
                        activo ?? true
                    ]
                );
            }

            if ((product_scope || 'GLOBAL') === 'SPECIFIC') {
                for (const pid of (product_ids || [])) {
                    await connection.query(
                        'INSERT INTO PromocionProductos (promocion_id, producto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [id, pid]
                    );
                }
            }

            if ((audience_scope || 'ALL') === 'CUSTOMERS') {
                for (const uid of (audience_user_ids || [])) {
                    await connection.query(
                        'INSERT INTO PromocionUsuarios (promocion_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [id, uid]
                    );
                }
            }

            await connection.query('COMMIT');
        } catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        } finally {
            connection.release();
        }

        res.status(201).json({ message: 'Promocion creada con exito', id });
    } catch (error) {
        console.error('Error creating promo:', error);
        res.status(500).json({ error: 'Error al crear promocion' });
    }
};

export const getPromotions = async (_req: Request, res: Response): Promise<void> => {
    try {
        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const advancedReady = await detectPromotionAdvancedSchema();

        if (assignmentReady) {
            const [rows] = await pool.query<any[]>(`
                SELECT id, nombre, descripcion${mediaReady ? ', imagen_url' : ''}, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin, activo
                FROM Promociones pr
                WHERE pr.activo = true
                  AND (
                    ${advancedReady
                        ? "(pr.discount_type = 'AMOUNT' AND COALESCE(pr.amount_discount, 0) > 0) OR (pr.discount_type <> 'AMOUNT' AND pr.porcentaje_descuento > 0)"
                        : 'pr.porcentaje_descuento > 0'}
                  )
                  AND pr.fecha_inicio <= NOW()
                  AND pr.fecha_fin >= NOW()
                  AND pr.audience_scope = 'ALL'
                  AND (
                    pr.product_scope = 'GLOBAL'
                    OR EXISTS (SELECT 1 FROM PromocionProductos pp WHERE pp.promocion_id = pr.id)
                    OR EXISTS (SELECT 1 FROM Productos p WHERE p.promocion_id = pr.id)
                  )
                ORDER BY ${advancedReady ? 'pr.priority DESC, COALESCE(pr.amount_discount, 0) DESC, pr.porcentaje_descuento DESC,' : 'pr.porcentaje_descuento DESC,'} pr.creado_en DESC
            `);
            res.status(200).json(rows);
            return;
        }

        const [rows] = await pool.query<any[]>(`
            SELECT pr.id, pr.nombre, pr.descripcion, pr.porcentaje_descuento${advancedReady ? ', pr.discount_type, pr.amount_discount, pr.priority' : ''}, pr.fecha_inicio, pr.fecha_fin, pr.activo
            FROM Promociones pr
            WHERE pr.activo = true
              AND (
                ${advancedReady
                    ? "(pr.discount_type = 'AMOUNT' AND COALESCE(pr.amount_discount, 0) > 0) OR (pr.discount_type <> 'AMOUNT' AND pr.porcentaje_descuento > 0)"
                    : 'pr.porcentaje_descuento > 0'}
              )
              AND pr.fecha_inicio <= NOW()
              AND pr.fecha_fin >= NOW()
              AND EXISTS (
                SELECT 1
                FROM Productos p
                WHERE p.promocion_id = pr.id
                  AND p.stock > 0
              )
            ORDER BY ${advancedReady ? 'pr.priority DESC, COALESCE(pr.amount_discount, 0) DESC, pr.porcentaje_descuento DESC,' : 'pr.porcentaje_descuento DESC,'} pr.creado_en DESC
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching promos:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
};

export const getPromotionsAdmin = async (_req: Request, res: Response): Promise<void> => {
    try {
        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const advancedReady = await detectPromotionAdvancedSchema();

        if (assignmentReady) {
            const [rows] = await pool.query<any[]>(`
                SELECT
                    pr.id,
                    pr.nombre,
                    pr.descripcion,
                    ${mediaReady ? 'pr.imagen_url,' : ''}
                    pr.porcentaje_descuento,
                    ${advancedReady ? 'pr.discount_type, pr.amount_discount, pr.priority,' : ''}
                    pr.fecha_inicio,
                    pr.fecha_fin,
                    pr.activo,
                    pr.product_scope,
                    ${mediaReady ? 'pr.product_gender,' : ''}
                    pr.audience_scope,
                    pr.audience_segment,
                    COALESCE(JSON_AGG(DISTINCT pp.producto_id) FILTER (WHERE pp.producto_id IS NOT NULL), '[]') AS product_ids,
                    COALESCE(JSON_AGG(DISTINCT pu.usuario_id) FILTER (WHERE pu.usuario_id IS NOT NULL), '[]') AS audience_user_ids
                FROM Promociones pr
                LEFT JOIN PromocionProductos pp ON pp.promocion_id = pr.id
                LEFT JOIN PromocionUsuarios pu ON pu.promocion_id = pr.id
                GROUP BY pr.id
                ORDER BY ${advancedReady ? 'pr.priority DESC,' : ''} pr.creado_en DESC
            `);
            res.status(200).json(rows);
            return;
        }

        const [rows] = await pool.query<any[]>(`
            SELECT id, nombre, descripcion, porcentaje_descuento${advancedReady ? ', discount_type, amount_discount, priority' : ''}, fecha_inicio, fecha_fin, activo
            FROM Promociones
            ORDER BY ${advancedReady ? 'priority DESC,' : ''} creado_en DESC
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching promos admin:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
};

export const updatePromotion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            nombre,
            descripcion,
            discount_type,
            porcentaje_descuento,
            amount_discount,
            priority,
            fecha_inicio,
            fecha_fin,
            activo,
            product_scope,
            product_ids,
            product_gender,
            audience_scope,
            audience_segment,
            audience_user_ids
        } = req.body;

        const assignmentReady = await detectPromotionAssignmentSchema();
        const mediaReady = await detectPromotionMediaSchema();
        const advancedReady = await detectPromotionAdvancedSchema();

        if (!assignmentReady) {
            res.status(400).json({ error: 'Tu base de datos no soporta reglas de asignacion de promociones. Aplica la migracion primero.' });
            return;
        }
        if (!mediaReady && ((req as any).file || product_scope === 'GENDER')) {
            res.status(400).json({ error: 'Tu base de datos no soporta imagen o filtro por genero. Ejecuta la migracion 20260312_promotions_image_and_gender.sql.' });
            return;
        }

        const wantsAdvanced =
            typeof discount_type === 'string' ||
            amount_discount !== undefined ||
            priority !== undefined;

        if (wantsAdvanced && !advancedReady) {
            res.status(400).json({
                error: 'Tu base de datos no soporta descuento fijo/prioridad. Ejecuta database/migrations/20260312_promotions_amount_and_priority.sql en Supabase.'
            });
            return;
        }

        let imagen_url: string | null | undefined = undefined;
        if (mediaReady && (req as any).file) {
            const file = (req as any).file as Express.Multer.File;
            const uniqueFilename = sanitizeFilename(file.originalname);
            const { error } = await supabase.storage
                .from('perfumissimo_bucket')
                .upload(`promotions/${uniqueFilename}`, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });
            if (error) throw new Error('Error subiendo imagen de promocion a Supabase: ' + error.message);

            const { data: publicData } = supabase.storage
                .from('perfumissimo_bucket')
                .getPublicUrl(`promotions/${uniqueFilename}`);
            imagen_url = publicData.publicUrl;
        }

        const connection = await pool.getConnection();
        try {
            await connection.query('BEGIN');

            const updates: string[] = [];
            const params: any[] = [];

            const dtype = advancedReady ? String(discount_type || 'PERCENT').toUpperCase() : 'PERCENT';
            const pct = dtype === 'AMOUNT' ? 0 : Number(porcentaje_descuento || 0);
            const amount = dtype === 'AMOUNT' ? Number(amount_discount || 0) : null;
            const prio = advancedReady ? Number(priority || 0) : 0;

            if (nombre !== undefined) { updates.push('nombre = $' + (params.length + 1)); params.push(nombre); }
            if (descripcion !== undefined) { updates.push('descripcion = $' + (params.length + 1)); params.push(descripcion); }
            if (imagen_url !== undefined) { updates.push('imagen_url = $' + (params.length + 1)); params.push(imagen_url); }
            if (porcentaje_descuento !== undefined || discount_type !== undefined || amount_discount !== undefined) {
                updates.push('porcentaje_descuento = $' + (params.length + 1));
                params.push(pct);
                if (advancedReady) {
                    updates.push('discount_type = $' + (params.length + 1));
                    params.push(dtype);
                    updates.push('amount_discount = $' + (params.length + 1));
                    params.push(amount);
                }
            }
            if (advancedReady && priority !== undefined) {
                updates.push('priority = $' + (params.length + 1));
                params.push(prio);
            }
            if (fecha_inicio !== undefined) { updates.push('fecha_inicio = $' + (params.length + 1)); params.push(fecha_inicio); }
            if (fecha_fin !== undefined) { updates.push('fecha_fin = $' + (params.length + 1)); params.push(fecha_fin); }
            if (activo !== undefined) { updates.push('activo = $' + (params.length + 1)); params.push(activo); }
            if (product_scope !== undefined) { updates.push('product_scope = $' + (params.length + 1)); params.push(product_scope); }
            if (mediaReady) {
                if (product_gender !== undefined) {
                    updates.push('product_gender = $' + (params.length + 1));
                    params.push(product_gender || null);
                }
                if (product_scope !== undefined && product_scope !== 'GENDER') {
                    updates.push('product_gender = $' + (params.length + 1));
                    params.push(null);
                }
            }
            if (audience_scope !== undefined) { updates.push('audience_scope = $' + (params.length + 1)); params.push(audience_scope); }
            if (audience_segment !== undefined) { updates.push('audience_segment = $' + (params.length + 1)); params.push(audience_segment || null); }

            if (updates.length > 0) {
                params.push(id);
                const query = `UPDATE Promociones SET ${updates.join(', ')} WHERE id = $${params.length}`;
                const result = await connection.query(query, params);
                if ((result as any)?.rowCount === 0) {
                    await connection.query('ROLLBACK');
                    res.status(404).json({ error: 'Promocion no encontrada' });
                    return;
                }
            }

            // Reemplazar asignacion de productos si viene en el payload
            if (product_scope !== undefined) {
                if (product_scope === 'GLOBAL') {
                    await connection.query('DELETE FROM PromocionProductos WHERE promocion_id = $1', [id]);
                }
                if (product_scope === 'SPECIFIC') {
                    if (!Array.isArray(product_ids) || product_ids.length === 0) {
                        await connection.query('ROLLBACK');
                        res.status(400).json({ error: 'Debes seleccionar al menos un producto' });
                        return;
                    }
                    await connection.query('DELETE FROM PromocionProductos WHERE promocion_id = $1', [id]);
                    for (const pid of product_ids) {
                        await connection.query(
                            'INSERT INTO PromocionProductos (promocion_id, producto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [id, pid]
                        );
                    }
                }
                if (product_scope === 'GENDER') {
                    await connection.query('DELETE FROM PromocionProductos WHERE promocion_id = $1', [id]);
                }
            }

            // Reemplazar asignacion de usuarios si viene en el payload
            if (audience_scope !== undefined) {
                if (audience_scope === 'ALL' || audience_scope === 'SEGMENT') {
                    await connection.query('DELETE FROM PromocionUsuarios WHERE promocion_id = $1', [id]);
                }
                if (audience_scope === 'CUSTOMERS') {
                    if (!Array.isArray(audience_user_ids) || audience_user_ids.length === 0) {
                        await connection.query('ROLLBACK');
                        res.status(400).json({ error: 'Debes seleccionar al menos un cliente' });
                        return;
                    }
                    await connection.query('DELETE FROM PromocionUsuarios WHERE promocion_id = $1', [id]);
                    for (const uid of audience_user_ids) {
                        await connection.query(
                            'INSERT INTO PromocionUsuarios (promocion_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [id, uid]
                        );
                    }
                }
            }

            await connection.query('COMMIT');
        } catch (e) {
            await connection.query('ROLLBACK');
            throw e;
        } finally {
            connection.release();
        }
        res.status(200).json({ message: 'Promocion actualizada exitosamente' });
    } catch (error) {
        console.error('Error updating promo:', error);
        res.status(500).json({ error: 'Error al actualizar promocion' });
    }
};

export const updatePromotionActive = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { activo } = req.body;

        const [result] = await pool.query<any>(
            'UPDATE Promociones SET activo = $1 WHERE id = $2',
            [!!activo, id]
        );

        const affected = Number((result as any)?.affectedRows ?? (result as any)?.rowCount ?? 0);
        if (!affected) {
            res.status(404).json({ error: 'Promocion no encontrada' });
            return;
        }

        res.status(200).json({ message: 'Estado actualizado', activo: !!activo });
    } catch (error) {
        console.error('Error updating promo active:', error);
        res.status(500).json({ error: 'Error al actualizar estado de la promocion' });
    }
};

export const deletePromotion = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const result = await pool.query<any>(
            `DELETE FROM Promociones WHERE id = $1`,
            [id]
        );

        if ((result as any)?.rowCount === 0) {
            res.status(404).json({ error: 'Promocion no encontrada' });
            return;
        }

        res.status(200).json({ message: 'Promocion eliminada exitosamente' });
    } catch (error) {
        console.error('Error deleting promo:', error);
        res.status(500).json({ error: 'Error al eliminar promocion' });
    }
};
