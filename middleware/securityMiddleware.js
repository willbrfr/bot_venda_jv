// middleware/securityMiddleware.js - Middlewares de segurança
const rateLimiter = require('../utils/rateLimiter');

class SecurityMiddleware {
    // ✅ Rate limiting para comandos
    commandRateLimit(maxAttempts = 5, windowMs = 60000) {
        return (msg, action = 'command') => {
            const userId = msg.from.id;
            const result = rateLimiter.checkLimit(userId, action, maxAttempts, windowMs);
            
            if (!result.allowed) {
                throw new Error(result.message);
            }
            
            return result;
        };
    }

    // ✅ Rate limiting para pagamentos
    paymentRateLimit(maxAttempts = 3, windowMs = 300000) { // 5 minutos
        return (msg) => {
            const userId = msg.from.id;
            const result = rateLimiter.checkLimit(userId, 'payment', maxAttempts, windowMs);
            
            if (!result.allowed) {
                throw new Error(`💳 Muitas tentativas de pagamento. ${result.message}`);
            }
            
            return result;
        };
    }

    // ✅ Rate limiting para mensagens do funil
    funnelMessageRateLimit(maxAttempts = 10, windowMs = 3600000) { // 1 hora
        return (userId) => {
            const result = rateLimiter.checkLimit(userId, 'funnel_interaction', maxAttempts, windowMs);
            return result;
        };
    }

    // ✅ Proteção contra spam de callback
    callbackRateLimit(maxAttempts = 10, windowMs = 60000) {
        return (cbq) => {
            const userId = cbq.from.id;
            const result = rateLimiter.checkLimit(userId, 'callback', maxAttempts, windowMs);
            
            if (!result.allowed) {
                throw new Error(`🔄 Muitas interações rápidas. ${result.message}`);
            }
            
            return result;
        };
    }

    // ✅ Validação de usuário
    validateUser(msg) {
        if (!msg.from || !msg.from.id) {
            throw new Error('Usuário inválido');
        }

        // Verifica se é bot
        if (msg.from.is_bot) {
            throw new Error('Bots não são permitidos');
        }

        return true;
    }

    // ✅ Sanitização de texto
    sanitizeText(text, maxLength = 1000) {
        if (typeof text !== 'string') return '';
        
        return text
            .trim()
            .slice(0, maxLength)
            .replace(/[<>]/g, ''); // Remove caracteres potencialmente perigosos
    }

    // ✅ Delay artificial para evitar detecção de bot
    async artificialDelay(min = 100, max = 500) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

module.exports = new SecurityMiddleware();