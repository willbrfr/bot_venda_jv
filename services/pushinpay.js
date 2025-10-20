const axios = require('axios');
const db = require('../utils/database');
const { withRetry } = require('../utils/retryHandler'); // ✅ NOVO

const getApiToken = () => {
    const settings = db.getSettings();
    return settings.payment?.pushinpay?.apiToken;
};

/**
 * apx passou aki
 * @param {object} product
 * @param {number} userId
 * @returns {object|null}
 */
async function createPushinPayPix(product) {
    const apiToken = getApiToken();
    if (!apiToken) {
        console.error("API Token da Pushinpay não configurado no painel admin.");
        return null;
    }

    const valorEmCentavos = Math.round(product.price * 100);

    const body = {
        value: valorEmCentavos,
        description: `Pagamento para ${product.name}`
    };

    try {
        // ✅ USA RETRY PARA ERROS DE REDE
        const response = await withRetry(async () => {
            const url = 'https://api.pushinpay.com.br/api/pix/cashIn';
            return await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos timeout
            });
        }, 3, 2000); // 3 tentativas, começando com 2 segundos

        console.log('✅ PIX da Pushinpay gerado com sucesso!', response.data);

        return {
            paymentId: response.data.id,
            qrCodeBase64: response.data.qr_code_base64.replace(/^data:image\/png;base64,/, ''),
            pixCopyPaste: response.data.qr_code,
        };
    } catch (error) {
        console.error("❌ Erro ao criar PIX na Pushinpay:", error.response?.data || error.message);
        
        // ✅ MENSAGEM DE ERRO MAIS AMIGÁVEL
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            return { error: "Problema temporário de conexão. Por favor, tente novamente em alguns instantes." };
        }
        
        return { error: error.response?.data?.message || "Ocorreu um erro ao se comunicar com o gateway de pagamento." };
    }
}

/**
 * apx passou aki
 * @param {string} paymentId
 * @returns {string|null}
 */
async function getPushinPayPaymentStatus(paymentId) {
    const apiToken = getApiToken();
    if (!apiToken) {
        console.error("API Token da Pushinpay não configurado.");
        return null;
    }

    try {
        // ✅ USA RETRY PARA CONSULTA DE STATUS TAMBÉM
        const response = await withRetry(async () => {
            const url = `https://api.pushinpay.com.br/api/transactions/${paymentId}`;
            return await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 segundos para consultas
            });
        }, 2, 1000); // 2 tentativas para consultas
        
        if (response.data.status && response.data.status.toUpperCase() === 'PAID') {
            return 'approved';
        }
        return response.data.status.toLowerCase();
    } catch (error) {
        console.error(`❌ Erro ao verificar status na Pushinpay para ${paymentId}:`, error.response?.data || error.message);
        
        // ✅ SE FOR ERRO DE REDE, RETORNA PENDING PARA TENTAR NOVAMENTE
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            console.log('🔌 ECONNRESET na consulta de status, retornando pending para retry...');
            return 'pending';
        }
        
        return null;
    }
}

module.exports = { createPushinPayPix, getPushinPayPaymentStatus };