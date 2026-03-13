import { sendEmail } from '../services/email.service';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno antes de importar la base de datos o el email service
dotenv.config({ path: path.join(__dirname, '../../.env') });

const testEmailTarget = 'jhonjairoparraparra39@gmail.com';

async function runTest() {
    console.log(`🚀 Iniciando prueba de envío de correo a: ${testEmailTarget}...`);

    // Validar si las variables SMTP existen
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'tu_correo@gmail.com' || !process.env.SMTP_PASS) {
        console.error('❌ Error: Las credenciales SMTP no han sido configuradas correctamente en el archivo backend/.env');
        console.error('Por favor, reemplaza "tu_correo@gmail.com" y "tu_contraseña_de_aplicacion" con datos reales de tu cuenta de correo.');
        process.exit(1);
    }

    try {
        await sendEmail({
            to: testEmailTarget,
            subject: '📦 Prueba de integración de correo - Perfumissimo',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #2D4C3B;">¡Hola desde Perfumissimo!</h2>
                    <p>Esta es una prueba de integración del sistema de correos.</p>
                    <p>Si estás leyendo esto, significa que <strong>las credenciales SMTP que configuraste en tu archivo .env están funcionando perfectamente</strong>.</p>
                    <br/>
                    <p>Saludos,<br>El equipo de desarrollo.</p>
                </div>
            `,
            text: 'Prueba de integración de correo exitosa. El sistema SMTP está configurado correctamente.'
        });

        console.log(`✅ Prueba enviada exitosamente. Por favor, revisa la bandeja de entrada de ${testEmailTarget} (y la carpeta de SPAM por si acaso).`);
        process.exit(0);
    } catch (error) {
        console.error('💥 Error inesperado en el script de prueba:', error);
        process.exit(1);
    }
}

runTest();
