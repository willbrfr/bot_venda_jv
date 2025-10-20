const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/database');
const { withRetry } = require('../utils/retryHandler'); // ✅ NOVO

const getAccessToken = () => {
    const settings = db.getSettings();
    return settings.payment?.mercadoPago?.accessToken;
};

async function createMercadoPagoPix(product, userId) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error("Access Token do Mercado Pago não configurado no painel admin.");
        return null;
    }

    const body = {
        transaction_amount: product.price,
        description: `Pagamento para ${product.name}`,
        payment_method_id: 'pix',
        payer: {
            email: `cliente_${userId}_${Date.now()}@telegram.bot`
        },
    };

    try {
        // ✅ USA RETRY PARA ERROS DE REDE
        const response = await withRetry(async () => {
            return await axios.post('https://api.mercadopago.com/v1/payments', body, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Idempotency-Key': uuidv4(),
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos timeout
            });
        }, 3, 2000); // 3 tentativas, começando com 2 segundos

        const pixData = response.data.point_of_interaction.transaction_data;
        
        console.log('✅ PIX do Mercado Pago gerado com sucesso!');

        return {
            paymentId: response.data.id,
            qrCodeBase64: pixData.qr_code_base64,
            pixCopyPaste: pixData.qr_code,
        };
    } catch (error) {
        console.error("❌ Erro ao criar PIX no Mercado Pago:", error.response?.data || error.message);
        
        // ✅ MENSAGEM DE ERRO MAIS AMIGÁVEL
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            return { error: "Problema temporário de conexão. Por favor, tente novamente em alguns instantes." };
        }
        
        // ✅ TRATA ERROS ESPECÍFICOS DO MERCADO PAGO
        if (error.response?.data) {
            const mpError = error.response.data;
            if (mpError.message) {
                return { error: `Erro no Mercado Pago: ${mpError.message}` };
            }
        }
        
        return { error: error.response?.data?.message || "Ocorreu um erro ao se comunicar com o gateway de pagamento." };
    }
}

async function getMercadoPagoPaymentStatus(paymentId) {
    const accessToken = getAccessToken();
     if (!accessToken) {
        console.error("Access Token do Mercado Pago não configurado no painel admin.");
        return 'error';
    }

    try {
        // ✅ USA RETRY PARA CONSULTA DE STATUS TAMBÉM
        const response = await withRetry(async () => {
            const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
            return await axios.get(url, {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 segundos para consultas
            });
        }, 2, 1000); // 2 tentativas para consultas
        
        return response.data.status;
    } catch (error) {
        console.error(`❌ Erro ao verificar status no MP para ${paymentId}:`, error.response?.data?.message || error.message);
        
        // ✅ SE FOR ERRO DE REDE, RETORNA PENDING PARA TENTAR NOVAMENTE
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            console.log('🔌 ECONNRESET na consulta de status, retornando pending para retry...');
            return 'pending';
        }
        
        return 'error';
    }
}

module.exports = { createMercadoPagoPix, getMercadoPagoPaymentStatus };