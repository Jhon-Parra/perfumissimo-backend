type WompiEnv = 'sandbox' | 'production';

type WompiMerchantResponse = {
    data?: {
        presigned_acceptance?: {
            acceptance_token?: string;
            permalink?: string;
            type?: string;
        };
        name?: string;
    };
};

export type WompiPseBank = {
    financial_institution_code: string;
    financial_institution_name: string;
};

type WompiPseBanksResponse = {
    data?: WompiPseBank[];
};

type WompiCreateTransactionResponse = {
    data?: {
        id?: string;
        status?: string;
        payment_method?: {
            extra?: {
                async_payment_url?: string;
            };
        };
    };
};

type WompiGetTransactionResponse = {
    data?: {
        id?: string;
        status?: string;
        reference?: string;
        amount_in_cents?: number;
        currency?: string;
    };
};

const getBaseUrl = (): string => {
    const env = (process.env.WOMPI_ENV || 'sandbox').toLowerCase() as WompiEnv;
    return env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
};

const requirePublicKey = (): string => {
    const key = String(process.env.WOMPI_PUBLIC_KEY || '').trim();
    if (!key) {
        throw new Error('WOMPI_PUBLIC_KEY no esta configurado');
    }
    return key;
};

export const WompiService = {
    async getMerchant(): Promise<{ acceptance_token: string; permalink: string; name?: string }>
    {
        const publicKey = requirePublicKey();
        const url = `${getBaseUrl()}/merchants/${encodeURIComponent(publicKey)}`;
        const resp = await fetch(url, { method: 'GET' });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi merchant error (${resp.status}): ${text}`);
        }
        const json = (await resp.json()) as WompiMerchantResponse;
        const token = String(json?.data?.presigned_acceptance?.acceptance_token || '').trim();
        const permalink = String(json?.data?.presigned_acceptance?.permalink || '').trim();
        if (!token || !permalink) {
            throw new Error('Respuesta Wompi invalida: falta acceptance_token/permalink');
        }
        return { acceptance_token: token, permalink, name: json?.data?.name };
    },

    async getPseBanks(): Promise<WompiPseBank[]> {
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
        const json = (await resp.json()) as WompiPseBanksResponse;
        const banks = Array.isArray(json?.data) ? json.data : [];
        return banks
            .filter((b) => b && b.financial_institution_code && b.financial_institution_name)
            .sort((a, b) => a.financial_institution_name.localeCompare(b.financial_institution_name, 'es'));
    },

    async createPseTransaction(input: {
        amount_in_cents: number;
        reference: string;
        customer_email: string;
        redirect_url: string;
        acceptance_token: string;
        user_type: '0' | '1';
        user_legal_id_type: string;
        user_legal_id: string;
        financial_institution_code: string;
        payment_description: string;
    }): Promise<{ transaction_id: string; async_payment_url: string; status?: string }> {
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

        const json = (await resp.json()) as WompiCreateTransactionResponse;
        const txId = String(json?.data?.id || '').trim();
        const asyncUrl = String(json?.data?.payment_method?.extra?.async_payment_url || '').trim();
        if (!txId || !asyncUrl) {
            throw new Error('Respuesta Wompi invalida: falta transaction id o async_payment_url');
        }
        return { transaction_id: txId, async_payment_url: asyncUrl, status: json?.data?.status };
    }
    ,

    async getTransaction(transactionId: string): Promise<{ id: string; status: string; reference: string }>
    {
        const publicKey = requirePublicKey();
        const id = String(transactionId || '').trim();
        if (!id) throw new Error('transaction id requerido');

        const url = `${getBaseUrl()}/transactions/${encodeURIComponent(id)}`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${publicKey}` }
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`Wompi get transaction error (${resp.status}): ${text}`);
        }
        const json = (await resp.json()) as WompiGetTransactionResponse;
        const tid = String(json?.data?.id || '').trim();
        const status = String(json?.data?.status || '').trim();
        const ref = String(json?.data?.reference || '').trim();
        if (!tid || !status || !ref) {
            throw new Error('Respuesta Wompi invalida en getTransaction');
        }
        return { id: tid, status, reference: ref };
    }
};
