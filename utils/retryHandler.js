// utils/retryHandler.js
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executa uma operação com retry automático para erros de rede
 * @param {Function} operation - Função a ser executada
 * @param {number} maxRetries - Número máximo de tentativas (padrão: 3)
 * @param {number} baseDelay - Delay base em ms (padrão: 1000)
 * @returns {Promise} Resultado da operação
 */
async function withRetry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Tentativa ${attempt}/${maxRetries}...`);
            return await operation();
        } catch (error) {
            lastError = error;
            
            // ✅ TRATA SPECIFICAMENTE ERROS DE REDE
            const isNetworkError = error.code === 'ECONNRESET' || 
                                 error.code === 'ETIMEDOUT' ||
                                 error.code === 'ESOCKETTIMEDOUT' ||
                                 error.message.includes('ECONNRESET') ||
                                 error.message.includes('ETIMEDOUT') ||
                                 error.message.includes('socket hang up') ||
                                 error.message.includes('Network Error');
            
            if (isNetworkError) {
                console.log(`🔌 Erro de rede detectado (${error.code || error.message}), tentativa ${attempt}/${maxRetries}`);
                
                if (attempt === maxRetries) {
                    console.log('❌ Número máximo de tentativas atingido');
                    throw error;
                }
                
                const waitTime = baseDelay * Math.pow(2, attempt - 1); // Backoff exponencial
                console.log(`⏳ Aguardando ${waitTime}ms antes da próxima tentativa...`);
                await delay(waitTime);
                continue;
            }
            
            // Outros erros (não de rede) são lançados imediatamente
            console.log('❌ Erro não relacionado à rede, não tentando novamente:', error.message);
            throw error;
        }
    }
    
    throw lastError;
}

module.exports = { withRetry, delay };