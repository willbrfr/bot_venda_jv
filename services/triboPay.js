const axios = require('axios');
const db = require('../utils/database');
const qrcode = require('qrcode');
const { withRetry } = require('../utils/retryHandler'); // ✅ NOVO

const getApiToken = () => {
    const settings = db.getSettings();
    return settings.payment?.triboPay?.apiToken;
};

/**
 * @param {object} plan 
 * @param {object} user 
 * @param {string} cpf
 * @returns {object|null}
 */
async function createTriboPayPix(plan, user, cpf) {
    const apiToken = getApiToken();
    if (!apiToken) {
        console.error("API Token da TriboPay não configurado no painel admin.");
        return null;
    }

    if (!plan.offer_hash || !plan.product_hash) {
        console.error(`O plano ${plan.name} não tem 'offer_hash' ou 'product_hash' da TriboPay configurado.`);
        return null;
    }

    const valorEmCentavos = Math.round(plan.price * 100);

    const body = {
        amount: valorEmCentavos,
        offer_hash: plan.offer_hash,
        payment_method: "pix",
        installments: 1,
        customer: {
            name: user.first_name || `Usuário ${user.id}`,
            email: `cliente_${user.id}_${Date.now()}@telegram.bot`,
            document: cpf,
            phone_number: "11999999999"
        },
        cart: [
            {
                product_hash: plan.product_hash,
                title: plan.name,
                price: valorEmCentavos,
                quantity: 1,
                operation_type: 1,
                tangible: false
            }
        ],
        transaction_origin: "api"
    };

    try {
        // ✅ USA RETRY PARA ERROS DE REDE
        const response = await withRetry(async () => {
            const url = `https://api.tribopay.com.br/api/public/v1/transactions?api_token=${apiToken}`;
            return await axios.post(url, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000 // 30 segundos timeout
            });
        }, 3, 2000); // 3 tentativas, começando com 2 segundos

        if (response.data?.payment_status === 'refused') {
            console.error("A transação foi recusada pela TriboPay. O CPF pode ser inválido ou ter restrições.");
            return null;
        }

        const paymentId = response.data?.hash;
        const pixCopyPaste = response.data?.pix?.pix_qr_code;

        if (!pixCopyPaste) {
            console.error("API da TriboPay não retornou um código PIX 'copia e cola'.");
            console.log("Resposta da API (sem PIX):", JSON.stringify(response.data, null, 2));
            return null;
        }
        
        const qrCodeDataURL = await qrcode.toDataURL(pixCopyPaste);
        const qrCodeBase64 = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');

        console.log('✅ PIX da TriboPay gerado e QR Code criado com sucesso!');

        return {
            paymentId: paymentId,
            qrCodeBase64: qrCodeBase64,
            pixCopyPaste: pixCopyPaste,
        };

    } catch (error) {
        console.error("❌ Erro ao criar PIX na TriboPay:", error.response?.data || error.message);
        
        // ✅ MENSAGEM DE ERRO MAIS AMIGÁVEL
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            return { error: "Problema temporário de conexão. Por favor, tente novamente em alguns instantes." };
        }
        
        return { error: error.response?.data?.message || "Ocorreu um erro ao se comunicar com o gateway de pagamento." };
    }
}

async function getTriboPayPaymentStatus(transactionHash) {
    const apiToken = getApiToken();
    if (!apiToken) {
        console.error("API Token da TriboPay não configurado.");
        return null;
    }

    try {
        // ✅ USA RETRY PARA CONSULTA DE STATUS TAMBÉM
        const response = await withRetry(async () => {
            const url = `https://api.tribopay.com.br/api/public/v1/transactions/${transactionHash}?api_token=${apiToken}`;
            return await axios.get(url, {
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 segundos para consultas
            });
        }, 2, 1000); // 2 tentativas para consultas
        
        const status = response.data.payment_status;

        if (status === 'paid' || status === 'completed') {
            return 'approved';
        }

        if (status === 'waiting_payment' || status === 'pending') {
            return 'pending';
        }

        return 'canceled';

    } catch (error) {
        console.error(`❌ Erro ao verificar status na TriboPay para ${transactionHash}:`, error.response?.data || error.message);
        
        // ✅ SE FOR ERRO DE REDE, RETORNA PENDING PARA TENTAR NOVAMENTE
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            console.log('🔌 ECONNRESET na consulta de status, retornando pending para retry...');
            return 'pending';
        }
        
        return null;
    }
}

module.exports = { createTriboPayPix, getTriboPayPaymentStatus };