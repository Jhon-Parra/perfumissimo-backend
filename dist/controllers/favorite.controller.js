"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFavorites = exports.removeFavorite = exports.addFavorite = void 0;
const database_1 = require("../config/database");
const uuid_1 = require("uuid");
const addFavorite = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { producto_id } = req.body;
        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }
        if (!producto_id) {
            res.status(400).json({ error: 'Producto ID es requerido' });
            return;
        }
        const id = (0, uuid_1.v4)();
        await database_1.pool.query(`INSERT INTO favoritos (id, usuario_id, producto_id) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, producto_id) DO NOTHING`, [id, userId, producto_id]);
        res.status(201).json({ message: 'Producto agregado a favoritos' });
    }
    catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Error al agregar a favoritos' });
    }
};
exports.addFavorite = addFavorite;
const removeFavorite = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { productId } = req.params;
        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }
        await database_1.pool.query(`DELETE FROM favoritos WHERE usuario_id = $1 AND producto_id = $2`, [userId, productId]);
        res.status(200).json({ message: 'Producto eliminado de favoritos' });
    }
    catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Error al eliminar de favoritos' });
    }
};
exports.removeFavorite = removeFavorite;
const getFavorites = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }
        const [rows] = await database_1.pool.query(`SELECT
                p.id,
                p.nombre,
                p.genero,
                p.descripcion,
                p.notas_olfativas,
                p.precio,
                p.stock,
                p.imagen_url,
                p.unidades_vendidas,
                p.creado_en,
                (p.id IN (SELECT id FROM Productos ORDER BY creado_en DESC NULLS LAST, id DESC LIMIT 5)) AS es_nuevo
            FROM favoritos f
            JOIN productos p ON f.producto_id = p.id
            WHERE f.usuario_id = $1
            ORDER BY f.creado_en DESC`, [userId]);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error('Error getting favorites:', error);
        res.status(500).json({ error: 'Error al obtener favoritos' });
    }
};
exports.getFavorites = getFavorites;
