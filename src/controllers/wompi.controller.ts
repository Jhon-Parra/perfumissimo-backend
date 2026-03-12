import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { WompiService } from '../services/wompi.service';
import { OrderModel } from '../models/order.model';

const safeOriginFromReq = (req: any): string => {
    const origin = String(req?.headers?.origin || '').trim();
    if (origin) return origin;
    const fallback = String(process.env.FRONTEND_URL || '').trim();
    return fallback || 'http://localhost:4200';
};

export class WompiController {
    static async getMerchant(req: AuthRequest, res: Response): Promise<void> {
        try {
            const data = await WompiService.getMerchant();
            res.status(200).json({
                name: data.name || null,
                presigned_acceptance: {
                    acceptance_token: data.acceptance_token,
                    permalink: data.permalink
                }
            });
        } catch (e: any) {
            res.status(500).json({ error: e?.message || 'No se pudo obtener merchant de Wompi' });
        }
    }

    static async getPseBanks(req: AuthRequest, res: Response): Promise<void> {
        try {
            const banks = await WompiService.getPseBanks();
            res.status(200).json({ data: banks });
        } catch (e: any) {
            res.status(500).json({ error: e?.message || 'No se pudo obtener bancos PSE' });
        }
    }

    static async createPseCheckout(req: AuthRequest, res: Response): Promise<void> {
        try {
            const user_id = req.user?.id;
            const email = String(req.user?.email || '').trim();
            if (!user_id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const {
                total,
                shipping_address,
                items,
                acceptance_token,
                user_type,
                user_legal_id_type,
                user_legal_id,
                financial_institution_code
            } = req.body;

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
            const orderId = await OrderModel.createOrder({
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
                const tx = await WompiService.createPseTransaction({
                    amount_in_cents: amountInCents,
                    reference: orderId,
                    customer_email: email,
                    redirect_url: redirectUrl,
                    acceptance_token: accToken,
                    user_type: utype as '0' | '1',
                    user_legal_id_type: idType,
                    user_legal_id: idNum,
                    financial_institution_code: bankCode,
                    payment_description: `Pedido Perfumissimo ${orderId}`
                });

                await OrderModel.updateTransactionCode(orderId, tx.transaction_id);

                res.status(201).json({
                    message: 'Checkout PSE creado',
                    orderId,
                    transactionId: tx.transaction_id,
                    asyncPaymentUrl: tx.async_payment_url,
                    redirectUrl
                });
            } catch (e: any) {
                // Si falla el pago, cancelar la orden y devolver stock
                await OrderModel.cancelAndRestock(orderId);
                throw e;
            }
        } catch (error: any) {
            res.status(500).json({ message: 'Error creando checkout PSE', detail: error?.message || String(error) });
        }
    }

    // Webhook (sin auth). Por seguridad, validamos consultando el estado real de la transaccion en Wompi.
    static async webhook(req: any, res: Response): Promise<void> {
        try {
            const txId =
                String(req?.body?.data?.transaction?.id || req?.body?.data?.transaction?.id || req?.body?.transaction?.id || '').trim();

            if (!txId) {
                res.status(200).json({ ok: true });
                return;
            }

            const tx = await WompiService.getTransaction(txId);
            const orderId = String(tx.reference || '').trim();
            if (!orderId) {
                res.status(200).json({ ok: true });
                return;
            }

            // Guardar transaction id si no estaba
            await OrderModel.updateTransactionCode(orderId, tx.id);

            const status = String(tx.status || '').toUpperCase();
            if (status === 'APPROVED') {
                await OrderModel.updateOrderStatus(orderId, 'PAGADO');
            } else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
                await OrderModel.cancelAndRestock(orderId);
            }

            res.status(200).json({ ok: true });
        } catch (e: any) {
            // No reintentar indefinidamente: responder 200, pero loguear
            console.error('Wompi webhook error:', e?.message || e);
            res.status(200).json({ ok: true });
        }
    }
}
