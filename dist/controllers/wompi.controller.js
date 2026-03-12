"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WompiController = void 0;
const wompi_service_1 = require("../services/wompi.service");
const order_model_1 = require("../models/order.model");
const safeOriginFromReq = (req) => {
    const origin = String(req?.headers?.origin || '').trim();
    if (origin)
        return origin;
    const fallback = String(process.env.FRONTEND_URL || '').trim();
    return fallback || 'http://localhost:4200';
};
class WompiController {
    static async getMerchant(req, res) {
        try {
            const data = await wompi_service_1.WompiService.getMerchant();
            res.status(200).json({
                name: data.name || null,
                presigned_acceptance: {
                    acceptance_token: data.acceptance_token,
                    permalink: data.permalink
                }
            });
        }
        catch (e) {
            res.status(500).json({ error: e?.message || 'No se pudo obtener merchant de Wompi' });
        }
    }
    static async getPseBanks(req, res) {
        try {
            const banks = await wompi_service_1.WompiService.getPseBanks();
            res.status(200).json({ data: banks });
        }
        catch (e) {
            res.status(500).json({ error: e?.message || 'No se pudo obtener bancos PSE' });
        }
    }
    static async createPseCheckout(req, res) {
        try {
            const user_id = req.user?.id;
            const email = String(req.user?.email || '').trim();
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            const { total, shipping_address, items, acceptance_token, user_type, user_legal_id_type, user_legal_id, financial_institution_code } = req.body;
            const totalNum = Number(total);
            if (!Number.isFinite(totalNum) || totalNum <= 0) {
                res.status(400).json({ message: 'Total de la orden inválido' });
                return;
            }
            const shipping = String(shipping_address || '').trim();
            if (!shipping) {
                res.status(400).json({ message: 'La dirección de envío es requerida' });
                return;
            }
            if (!Array.isArray(items) || items.length === 0) {
                res.status(400).json({ message: 'La orden debe tener al menos un producto' });
                return;
            }
            const accToken = String(acceptance_token || '').trim();
            if (!accToken) {
                res.status(400).json({ message: 'Debes aceptar los términos de Wompi para continuar' });
                return;
            }
            const utype = String(user_type || '').trim();
            if (utype !== '0' && utype !== '1') {
                res.status(400).json({ message: 'Tipo de persona inválido' });
                return;
            }
            const idType = String(user_legal_id_type || '').trim();
            const idNum = String(user_legal_id || '').trim();
            if (!idType || !idNum) {
                res.status(400).json({ message: 'Documento requerido para PSE' });
                return;
            }
            const bankCode = String(financial_institution_code || '').trim();
            if (!bankCode) {
                res.status(400).json({ message: 'Selecciona un banco' });
                return;
            }
            // Crear orden primero (reserva stock como esta hoy)
            const orderId = await order_model_1.OrderModel.createOrder({
                user_id,
                total: totalNum,
                shipping_address: shipping,
                items,
                transaction_code: undefined
            });
            const amountInCents = Math.round(totalNum * 100);
            const origin = safeOriginFromReq(req);
            const redirectUrl = `${origin}/order-success/${encodeURIComponent(orderId)}`;
            try {
                const tx = await wompi_service_1.WompiService.createPseTransaction({
                    amount_in_cents: amountInCents,
                    reference: orderId,
                    customer_email: email,
                    redirect_url: redirectUrl,
                    acceptance_token: accToken,
                    user_type: utype,
                    user_legal_id_type: idType,
                    user_legal_id: idNum,
                    financial_institution_code: bankCode,
                    payment_description: `Pedido Perfumissimo ${orderId}`
                });
                await order_model_1.OrderModel.updateTransactionCode(orderId, tx.transaction_id);
                res.status(201).json({
                    message: 'Checkout PSE creado',
                    orderId,
                    transactionId: tx.transaction_id,
                    asyncPaymentUrl: tx.async_payment_url,
                    redirectUrl
                });
            }
            catch (e) {
                // Si falla el pago, cancelar la orden y devolver stock
                await order_model_1.OrderModel.cancelAndRestock(orderId);
                throw e;
            }
        }
        catch (error) {
            res.status(500).json({ message: 'Error creando checkout PSE', detail: error?.message || String(error) });
        }
    }
    // Webhook (sin auth). Por seguridad, validamos consultando el estado real de la transaccion en Wompi.
    static async webhook(req, res) {
        try {
            const txId = String(req?.body?.data?.transaction?.id || req?.body?.data?.transaction?.id || req?.body?.transaction?.id || '').trim();
            if (!txId) {
                res.status(200).json({ ok: true });
                return;
            }
            const tx = await wompi_service_1.WompiService.getTransaction(txId);
            const orderId = String(tx.reference || '').trim();
            if (!orderId) {
                res.status(200).json({ ok: true });
                return;
            }
            // Guardar transaction id si no estaba
            await order_model_1.OrderModel.updateTransactionCode(orderId, tx.id);
            const status = String(tx.status || '').toUpperCase();
            if (status === 'APPROVED') {
                await order_model_1.OrderModel.updateOrderStatus(orderId, 'PAGADO');
            }
            else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
                await order_model_1.OrderModel.cancelAndRestock(orderId);
            }
            res.status(200).json({ ok: true });
        }
        catch (e) {
            // No reintentar indefinidamente: responder 200, pero loguear
            console.error('Wompi webhook error:', e?.message || e);
            res.status(200).json({ ok: true });
        }
    }
}
exports.WompiController = WompiController;
