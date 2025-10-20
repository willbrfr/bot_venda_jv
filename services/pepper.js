const axios = require('axios');
const db = require('../utils/database');
const qrcode = require('qrcode');
const { withRetry } = require('../utils/retryHandler'); // ✅ NOVO

const getApiToken = () => {
    const settings = db.getSettings();
    return settings.payment?.pepper?.accessToken;
};

async function createPepperPix(plan, user, cpf) {
    const apiToken = getApiToken();
    if (!apiToken) {
        console.error("Access Token da Pepper não configurado no painel admin.");
        return null;
    }

    if (!plan.pepper_offer_hash || !plan.pepper_product_hash) {
        console.error(`O plano ${plan.name} não tem 'pepper_offer_hash' ou 'pepper_product_hash' configurado.`);
        return null;
    }

    const valorEmCentavos = Math.round(plan.price * 100);

    const body = {
        api_token: apiToken,
        amount: valorEmCentavos,
        payment_method: "pix",
        cart: [
            {
                offer_hash: plan.pepper_offer_hash,
                price: valorEmCentavos,
                quantity: 1,
                product_hash: plan.pepper_product_hash,
                operation_type: 1,
                title: plan.name,
                cover: "https://via.placeholder.com/150"
            }
        ],
        installments: 1,
        customer: {
            name: user.first_name || `Usuário ${user.id}`,
            email: `cliente_${user.id}_${Date.now()}@telegram.bot`,
            phone_number: "99999999999",
            document: cpf
        },
        tracking: {
            utm_source: "telegram_bot"
        }
    };

    try {
        // ✅ USA RETRY PARA ERROS DE REDE
        const response = await withRetry(async () => {
            const url = 'https://api.cloud.pepperpay.com.br/public/v1/transactions';
            return await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000 // 30 segundos timeout
            });
        }, 3, 2000); // 3 tentativas, começando com 2 segundos

        console.log('Resposta completa da API Pepper:', JSON.stringify(response.data, null, 2));

        const responseData = response.data;
        const paymentId = responseData.hash;
        const pixCopyPaste = responseData.pix?.pix_qr_code;

        if (!paymentId || !pixCopyPaste) {
             console.error("API da Pepper retornou uma resposta inesperada. Verifique o log acima.");
             return { error: "A resposta do gateway de pagamento foi inválida ou não continha os dados do PIX." };
        }

        const qrCodeDataURL = await qrcode.toDataURL(pixCopyPaste);
        const qrCodeBase64 = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');

        console.log('✅ PIX da Pepper gerado e QR Code criado com sucesso!');

        return {
            paymentId: paymentId,
            qrCodeBase64: qrCodeBase64,
            pixCopyPaste: pixCopyPaste,
        };

    } catch (error) {
        console.error("❌ Erro ao criar PIX na Pepper:", error.response?.data || error.message);
        
        // ✅ MENSAGEM DE ERRO MAIS AMIGÁVEL
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            return { error: "Problema temporário de conexão. Por favor, tente novamente em alguns instantes." };
        }
        
        return { error: error.response?.data?.message || "Ocorreu um erro ao se comunicar com o gateway de pagamento." };
    }
}

async function getPepperPaymentStatus(transactionHash) {
    const apiToken = getApiToken();
    if (!apiToken) {
        console.error("Access Token da Pepper não configurado.");
        return null;
    }

    try {
        // ✅ USA RETRY PARA CONSULTA DE STATUS TAMBÉM
        const response = await withRetry(async () => {
            const url = `https://api.cloud.pepperpay.com.br/public/v1/transactions/${transactionHash}`;
            
            return await axios.get(url, {
                headers: { 
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 segundos para consultas
            });
        }, 2, 1000); // 2 tentativas para consultas

        const responseData = response.data.data || response.data;
        const status = responseData.payment_status;

        if (!status) {
            console.error("Resposta da verificação de status da Pepper não continha 'payment_status'.");
            return null;
        }

        if (status === 'paid' || status === 'completed') {
            return 'approved';
        }
        if (status === 'waiting_payment' || status === 'pending') {
            return 'pending';
        }
        
        return 'canceled';

    } catch (error) {
        console.error(`❌ Erro ao verificar status na Pepper para ${transactionHash}:`, error.response?.data || error.message);
        
        // ✅ SE FOR ERRO DE REDE, RETORNA PENDING PARA TENTAR NOVAMENTE
        if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
            console.log('🔌 ECONNRESET na consulta de status, retornando pending para retry...');
            return 'pending';
        }
        
        if (error.response?.status === 404) {
            return 'canceled';
        }
        return null;
    }
}

module.exports = { createPepperPix, getPepperPaymentStatus };