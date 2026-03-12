"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WompiService = void 0;
const getBaseUrl = () => {
    const env = (process.env.WOMPI_ENV || 'sandbox').toLowerCase();
    return env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
};
const requirePublicKey = () => {
    const key = String(process.env.WOMPI_PUBLIC_KEY || '').trim();
    if (!key) {
        throw new Error('WOMPI_PUBLIC_KEY no esta configurado');
    }
    return key;
};
exports.WompiService = {
    async getMerchant() {
        const publicKey = requirePublicKey();
        const url = `${getBaseUrl()}/merchants/${encodeURIComponent(publicKey)}`;
        const resp = await fetch(url, { method: 'GET' });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi merchant error (${resp.status}): ${text}`);
        }
        const json = (await resp.json());
        const token = String(json?.data?.presigned_acceptance?.acceptance_token || '').trim();
        const permalink = String(json?.data?.presigned_acceptance?.permalink || '').trim();
        if (!token || !permalink) {
            throw new Error('Respuesta Wompi invalida: falta acceptance_token/permalink');
        }
        return { acceptance_token: token, permalink, name: json?.data?.name };
    },
    async getPseBanks() {
        const publicKey = requirePublicKey();
        const url = `${getBaseUrl()}/pse/financial_institutions`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${publicKey}`
            }
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi banks error (${resp.status}): ${text}`);
        }
        const json = (await resp.json());
        const banks = Array.isArray(json?.data) ? json.data : [];
        return banks
            .filter((b) => b && b.financial_institution_code && b.financial_institution_name)
            .sort((a, b) => a.financial_institution_name.localeCompare(b.financial_institution_name, 'es'));
    },
    async createPseTransaction(input) {
        const publicKey = requirePublicKey();
        const url = `${getBaseUrl()}/transactions`;
        const body = {
            amount_in_cents: input.amount_in_cents,
            currency: 'COP',
            acceptance_token: input.acceptance_token,
            reference: input.reference,
            customer_email: input.customer_email,
            redirect_url: input.redirect_url,
            payment_method: {
                type: 'PSE',
                user_type: input.user_type,
                user_legal_id_type: input.user_legal_id_type,
                user_legal_id: input.user_legal_id,
                financial_institution_code: input.financial_institution_code,
                payment_description: input.payment_description
            }
        };
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${publicKey}`
            },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi create transaction error (${resp.status}): ${text}`);
        }
        const json = (await resp.json());
        const txId = String(json?.data?.id || '').trim();
        const asyncUrl = String(json?.data?.payment_method?.extra?.async_payment_url || '').trim();
        if (!txId || !asyncUrl) {
            throw new Error('Respuesta Wompi invalida: falta transaction id o async_payment_url');
        }
        return { transaction_id: txId, async_payment_url: asyncUrl, status: json?.data?.status };
    },
    async getTransaction(transactionId) {
        const publicKey = requirePublicKey();
        const id = String(transactionId || '').trim();
        if (!id)
            throw new Error('transaction id requerido');
        const url = `${getBaseUrl()}/transactions/${encodeURIComponent(id)}`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${publicKey}` }
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi get transaction error (${resp.status}): ${text}`);
        }
        const json = (await resp.json());
        const tid = String(json?.data?.id || '').trim();
        const status = String(json?.data?.status || '').trim();
        const ref = String(json?.data?.reference || '').trim();
        if (!tid || !status || !ref) {
            throw new Error('Respuesta Wompi invalida en getTransaction');
        }
        return { id: tid, status, reference: ref };
    }
};
