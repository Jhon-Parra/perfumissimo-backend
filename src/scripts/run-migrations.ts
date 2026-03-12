import { pool } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../database/migrations');

const migrations = [
    '20260311_promotions_assignment_rules.sql',
    '20260312_promotions_image_and_gender.sql',
    '20260312_promotions_amount_and_priority.sql',
    '20260312_settings_logo.sql',
    '20260312_settings_email_sender.sql',
    '20260312_settings_socials.sql',
    '20260312_settings_instagram_token.sql',
    '20260312_settings_boutique_contact.sql',
    '20260312_reviews.sql',
    '20260312_orders_add_processing.sql'
];

async function runMigrations() {
    console.log('🚀 Iniciando aplicación de migraciones pendientes...');

    for (const file of migrations) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Archivo no encontrado: ${file}, saltando...`);
            continue;
        }

        console.log(`📄 Ejecutando: ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');

        try {
            await pool.query(sql);
            console.log(`✅ ${file} aplicado con éxito.`);
        } catch (error: any) {
            // Ignorar errores de columnas duplicadas o constraints que ya existen
            if (error.code === '42701') { // duplicate_column
                console.log(`ℹ️ ${file}: Algunas columnas ya existen, continuando...`);
            } else if (error.code === '42P07') { // duplicate_table
                console.log(`ℹ️ ${file}: La tabla ya existe, continuando...`);
            } else {
                console.error(`❌ Error en ${file}:`, error.message);
            }
        }
    }

    console.log('🏁 Proceso de migración finalizado.');
    process.exit(0);
}

runMigrations().catch(err => {
    console.error('💥 Error fatal en migraciones:', err);
    process.exit(1);
});
