"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrderStatusChanged = exports.notifyOrderCreated = void 0;
const order_model_1 = require("../models/order.model");
const email_service_1 = require("./email.service");
const statusLabel = (estado) => {
    const labels = {
        PENDIENTE: 'Pendiente',
        PAGADO: 'Pagado',
        PROCESANDO: 'Procesando',
        ENVIADO: 'Enviado',
        ENTREGADO: 'Entregado',
        CANCELADO: 'Cancelado'
    };
    return labels[estado] || estado;
};
const formatMoneyCop = (value) => {
    const n = Number(value || 0);
    try {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    }
    catch {
        return String(n);
    }
};
const escapeHtml = (value) => {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
const notifyOrderCreated = async (orderId) => {
    const order = await order_model_1.OrderModel.getAdminOrderById(orderId);
    if (!order?.cliente_email)
        return;
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items
        .map((i) => {
        return `<li>${escapeHtml(i.nombre)} — ${escapeHtml(i.cantidad)} × ${escapeHtml(formatMoneyCop(i.precio_unitario))}</li>`;
    })
        .join('');
    const subject = `Pedido recibido: ${String(order.id).slice(0, 8).toUpperCase()}`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Gracias por tu compra</h2>
            <p>Hemos recibido tu pedido <strong>${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</strong>.</p>
            <p><strong>Estado:</strong> ${escapeHtml(statusLabel(order.estado))}</p>
            <p><strong>Total:</strong> ${escapeHtml(formatMoneyCop(order.total))}</p>
            <p><strong>Dirección de envío:</strong> ${escapeHtml(order.direccion_envio)}</p>
            <h3>Productos</h3>
            <ul>${itemsHtml}</ul>
        </div>
    `;
    await (0, email_service_1.sendEmail)({
        to: order.cliente_email,
        subject,
        html,
        text: `Pedido ${String(order.id).slice(0, 8).toUpperCase()} recibido. Estado: ${statusLabel(order.estado)}. Total: ${formatMoneyCop(order.total)}`
    });
};
exports.notifyOrderCreated = notifyOrderCreated;
const notifyOrderStatusChanged = async (orderId, newStatus) => {
    const order = await order_model_1.OrderModel.getAdminOrderById(orderId);
    if (!order?.cliente_email)
        return;
    const subject = `Actualización de pedido: ${String(order.id).slice(0, 8).toUpperCase()}`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Tu pedido fue actualizado</h2>
            <p>Pedido <strong>${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</strong></p>
            <p><strong>Nuevo estado:</strong> ${escapeHtml(statusLabel(newStatus))}</p>
        </div>
    `;
    await (0, email_service_1.sendEmail)({
        to: order.cliente_email,
        subject,
        html,
        text: `Tu pedido ${String(order.id).slice(0, 8).toUpperCase()} cambió a: ${statusLabel(newStatus)}`
    });
};
exports.notifyOrderStatusChanged = notifyOrderStatusChanged;
