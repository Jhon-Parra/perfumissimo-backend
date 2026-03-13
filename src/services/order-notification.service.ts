import { OrderModel } from '../models/order.model';
import { sendEmail } from './email.service';

const statusLabel = (estado: string): string => {
    const labels: Record<string, string> = {
        PENDIENTE: 'Pendiente',
        PAGADO: 'Pagado',
        PROCESANDO: 'Procesando',
        ENVIADO: 'Enviado',
        ENTREGADO: 'Entregado',
        CANCELADO: 'Cancelado'
    };
    return labels[estado] || estado;
};

const formatMoneyCop = (value: any): string => {
    const n = Number(value || 0);
    try {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch {
        return String(n);
    }
};

const escapeHtml = (value: any): string => {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const notifyOrderCreated = async (orderId: string): Promise<void> => {
    const order = await OrderModel.getAdminOrderById(orderId);
    if (!order?.cliente_email) return;

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items
        .map((i: any) => {
            return `<li>${escapeHtml(i.nombre)} — ${escapeHtml(i.cantidad)} × ${escapeHtml(formatMoneyCop(i.precio_unitario))}</li>`;
        })
        .join('');

    const subject = `Tu compra ha sido realizada exitosamente (Pedido #${String(order.id).slice(0, 8).toUpperCase()})`;

    const hasAddons = !!((order as any).envio_prioritario || (order as any).perfume_lujo);

    const addonsHtml = hasAddons
        ? `
           <h3 style="color: #2D4C3B; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px;">Complementos Seleccionados</h3>
           <ul style="list-style: none; padding: 0;">
             ${((order as any).envio_prioritario ? `<li style="padding: 10px 0; border-bottom: 1px solid #f9f9f9; display: flex; justify-content: space-between;"><span style="color: #666;">Envío Prioritario</span> <strong style="color: #2D4C3B;">${escapeHtml(formatMoneyCop((order as any).costo_envio_prioritario || 0))}</strong></li>` : '')}
             ${((order as any).perfume_lujo ? `<li style="padding: 10px 0; border-bottom: 1px solid #f9f9f9; display: flex; justify-content: space-between;"><span style="color: #666;">Perfume de Lujo</span> <strong style="color: #2D4C3B;">${escapeHtml(formatMoneyCop((order as any).costo_perfume_lujo || 0))}</strong></li>` : '')}
           </ul>`
        : '';

    const subtotalHtml = (order as any).subtotal_productos !== undefined
        ? `<div style="display: flex; justify-content: space-between; padding: 8px 0; color: #666;">
             <span>Subtotal de productos:</span> 
             <strong style="color: #2D4C3B;">${escapeHtml(formatMoneyCop((order as any).subtotal_productos || 0))}</strong>
           </div>`
        : '';

    const itemsFormatted = items
        .map((i: any) => `
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee;">
                <div>
                    <strong style="color: #2D4C3B; display: block;">${escapeHtml(i.nombre)}</strong>
                    <span style="color: #888; font-size: 13px;">Cantidad: ${escapeHtml(i.cantidad)}</span>
                </div>
                <strong style="color: #2D4C3B;">${escapeHtml(formatMoneyCop(i.precio_unitario))}</strong>
            </div>
        `)
        .join('');

    const html = `
        <div style="background-color: #f7f9f8; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                
                <!-- Header -->
                <div style="background-color: #2D4C3B; padding: 30px; text-align: center;">
                    <h1 style="color: #C6A87C; margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">Perfumissimo</h1>
                </div>

                <!-- Body -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #2D4C3B; margin-top: 0; font-size: 22px;">¡Gracias por tu compra!</h2>
                    <p style="color: #555; line-height: 1.6; font-size: 15px;">
                        Hemos recibido tu pedido correctamente. A continuación te presentamos el resumen de tu orden.
                    </p>

                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin: 25px 0;">
                        <p style="margin: 0 0 10px 0;"><strong>Número de Orden:</strong> <span style="color: #2D4C3B;">${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</span></p>
                        <p style="margin: 0 0 10px 0;"><strong>Dirección de entrega:</strong> <span style="color: #2D4C3B;">${escapeHtml(order.direccion_envio)}</span></p>
                        <p style="margin: 0;"><strong>Estado Actual:</strong> <span style="color: #2D4C3B;">${escapeHtml(statusLabel(order.estado))}</span></p>
                    </div>

                    <h3 style="color: #2D4C3B; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 30px;">Resumen de Productos</h3>
                    ${itemsFormatted}

                    ${addonsHtml}

                    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #2D4C3B;">
                        ${subtotalHtml}
                        <div style="display: flex; justify-content: space-between; padding: 15px 0; font-size: 18px;">
                            <strong style="color: #2D4C3B;">Total a Pagar:</strong>
                            <strong style="color: #C6A87C; font-size: 20px;">${escapeHtml(formatMoneyCop(order.total))}</strong>
                        </div>
                    </div>

                </div>

                <!-- Footer -->
                <div style="background-color: #f1f1f1; padding: 20px; text-align: center; color: #888; font-size: 12px;">
                    <p style="margin: 0;">Gracias por confiar en Perfumissimo.</p>
                </div>
            </div>
        </div>
    `;

    await sendEmail({
        to: order.cliente_email,
        subject,
        html,
        text: `Tu compra ha sido realizada exitosamente. Pedido #${String(order.id).slice(0, 8).toUpperCase()}. Total: ${formatMoneyCop(order.total)}`
    });
};

export const notifyOrderStatusChanged = async (orderId: string, newStatus: string): Promise<void> => {
    const order = await OrderModel.getAdminOrderById(orderId);
    if (!order?.cliente_email) return;

    const isDelivered = String(newStatus).toUpperCase() === 'ENTREGADO';
    const subject = isDelivered
        ? `Tu pedido ha sido entregado satisfactoriamente (#${String(order.id).slice(0, 8).toUpperCase()})`
        : `Actualización de tu pedido #${String(order.id).slice(0, 8).toUpperCase()}`;

    const html = `
        <div style="background-color: #f7f9f8; padding: 40px 20px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                
                <!-- Header -->
                <div style="background-color: #2D4C3B; padding: 30px; text-align: center;">
                    <h1 style="color: #C6A87C; margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">Perfumissimo</h1>
                </div>

                <!-- Body -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #2D4C3B; margin-top: 0; font-size: 22px;">
                        ${isDelivered ? '¡Tu pedido está en tus manos!' : 'Tu pedido tiene un nuevo estado'}
                    </h2>
                    
                    <p style="color: #555; line-height: 1.6; font-size: 15px;">
                        ${isDelivered
            ? `Queremos asegurarnos de que has recibido tu orden correctamente. Esperamos que disfrutes de tu compra con nosotros.`
            : `El estado de tu pedido ha sido actualizado.`}
                    </p>

                    <div style="background-color: #f9f9f9; padding: 25px; border-radius: 6px; margin: 30px 0; text-align: center; border: 1px solid #eee;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #888;">NÚMERO DE ORDEN</p>
                        <p style="margin: 0 0 20px 0; font-size: 20px; font-weight: bold; color: #333;">${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</p>
                        
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #888;">NUEVO ESTADO</p>
                        <div style="display: inline-block; background-color: ${isDelivered ? '#2D4C3B' : '#C6A87C'}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; letter-spacing: 1px;">
                            ${escapeHtml(statusLabel(newStatus)).toUpperCase()}
                        </div>
                    </div>

                </div>

                <!-- Footer -->
                <div style="background-color: #f1f1f1; padding: 20px; text-align: center; color: #888; font-size: 12px;">
                    <p style="margin: 0;">Gracias por confiar en Perfumissimo.</p>
                </div>
            </div>
        </div>
    `;

    await sendEmail({
        to: order.cliente_email,
        subject,
        html,
        text: isDelivered
            ? `Tu pedido #${String(order.id).slice(0, 8).toUpperCase()} ha sido entregado satisfactoriamente.`
            : `Tu pedido #${String(order.id).slice(0, 8).toUpperCase()} cambió a: ${statusLabel(newStatus)}`
    });
};
