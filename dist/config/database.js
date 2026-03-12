"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectionString = process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/postgres';
const useSsl = process.env.DATABASE_SSL === 'true' ||
    /supabase\.co/.test(connectionString);
const pgPool = new pg_1.Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    // Supabase pooler (session) tiene limites estrictos: mantener bajo.
    max: 2,
    idleTimeoutMillis: 30000, // Cerrar conexiones inactivas tras 30s
    connectionTimeoutMillis: 30000, // Dar más tiempo para conexión remota (30s)
});
const replaceParams = (sql, params) => {
    if (!params || params.length === 0)
        return sql;
    let paramIndex = 0;
    let inString = false;
    let result = '';
    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'" && sql[i - 1] !== '\\') {
            inString = !inString;
            result += char;
        }
        else if (char === '?' && !inString && paramIndex < params.length) {
            result += `$${paramIndex + 1}`;
            paramIndex++;
        }
        else {
            result += char;
        }
    }
    return result;
};
exports.pool = {
    query: async (sql, params) => {
        const pgSql = replaceParams(sql, params || []);
        try {
            const result = await pgPool.query(pgSql, params);
            if (['INSERT', 'UPDATE', 'DELETE'].includes(result.command)) {
                return [{ affectedRows: result.rowCount, insertId: result.rows[0]?.id }, result.fields];
            }
            return [result.rows, result.fields];
        }
        catch (error) {
            console.error('Error in DB Query:', error, '\nSQL:', pgSql);
            throw error;
        }
    },
    execute: async (sql, params) => {
        return exports.pool.query(sql, params);
    },
    getConnection: async () => {
        return await pgPool.connect();
    }
};
pgPool.connect()
    .then((conn) => {
    console.log('✅ Conexión exitosa a la Base de Datos PostgreSQL (Supabase)');
    conn.release();
})
    .catch((err) => {
    console.error('❌ Error conectando a la base de datos:', err.message);
});
