"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
    '20260312_orders_add_processing.sql',
    '20260312_role_permissions.sql',
    '20260312_settings_payment_accounts.sql',
    '20260312_settings_wompi_config.sql',
    '20260312_settings_wompi_secret_encrypted.sql',
    '20260312_categories.sql',
    '20260312_products_category_slug_length.sql',
    '20260312_promotions_category_slug.sql',
    '20260312_settings_multimedia_hero.sql',
    '20260312_settings_checkout_addons.sql',
    '20260312_orders_checkout_addons.sql',
    '20260312_products_new_badge_expiration.sql',
    '20260312_settings_checkout_addons_images.sql',
    '20260312_recommendation_events.sql',
    '20260312_settings_hero_multimedia.sql',
    '20260312_settings_banner_accent_color.sql'
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
            await database_1.pool.query(sql);
            console.log(`✅ ${file} aplicado con éxito.`);
        }
        catch (error) {
            // Ignorar errores de columnas duplicadas o constraints que ya existen
            if (error.code === '42701') { // duplicate_column
                console.log(`ℹ️ ${file}: Algunas columnas ya existen, continuando...`);
            }
            else if (error.code === '42P07') { // duplicate_table
                console.log(`ℹ️ ${file}: La tabla ya existe, continuando...`);
            }
            else {
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
