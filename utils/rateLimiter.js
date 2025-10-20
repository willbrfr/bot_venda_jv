// utils/rateLimiter.js - Sistema completo de rate limiting
class RateLimiter {
    constructor() {
        this.users = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000); // 10min
    }

    // ✅ Rate limiting por usuário e ação
    checkLimit(userId, action, maxAttempts, windowMs) {
        const now = Date.now();
        const key = `${userId}:${action}`;
        
        if (!this.users.has(key)) {
            this.users.set(key, { attempts: 1, firstAttempt: now, lastAttempt: now });
            return { allowed: true, remaining: maxAttempts - 1 };
        }

        const userData = this.users.get(key);
        const timeDiff = now - userData.firstAttempt;

        // Reset da janela de tempo se expirou
        if (timeDiff > windowMs) {
            userData.attempts = 1;
            userData.firstAttempt = now;
            userData.lastAttempt = now;
            return { allowed: true, remaining: maxAttempts - 1 };
        }

        // Verifica se excedeu o limite
        if (userData.attempts >= maxAttempts) {
            const retryAfter = Math.ceil((windowMs - timeDiff) / 1000);
            return { 
                allowed: false, 
                remaining: 0, 
                retryAfter,
                message: `Muitas tentativas. Tente novamente em ${retryAfter} segundos.`
            };
        }

        // Incrementa tentativas
        userData.attempts++;
        userData.lastAttempt = now;
        
        return { 
            allowed: true, 
            remaining: maxAttempts - userData.attempts 
        };
    }

    // ✅ Rate limiting global por IP/ação
    checkGlobalLimit(ip, action, maxAttempts, windowMs) {
        const now = Date.now();
        const key = `global:${ip}:${action}`;
        
        // Implementação similar ao por usuário
        return this.checkLimit(key, action, maxAttempts, windowMs);
    }

    // ✅ Limpeza de dados antigos
    cleanup() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        for (const [key, data] of this.users.entries()) {
            if (now - data.lastAttempt > oneHour) {
                this.users.delete(key);
            }
        }
    }

    // ✅ Obter estatísticas de usuário
    getUserStats(userId) {
        const userActions = {};
        
        for (const [key, data] of this.users.entries()) {
            if (key.startsWith(`${userId}:`)) {
                const action = key.split(':')[1];
                userActions[action] = {
                    attempts: data.attempts,
                    lastAttempt: new Date(data.lastAttempt).toISOString(),
                    timeSinceLast: Date.now() - data.lastAttempt
                };
            }
        }
        
        return userActions;
    }

    // ✅ Reset manual de limites
    resetUserLimits(userId, action = null) {
        if (action) {
            this.users.delete(`${userId}:${action}`);
        } else {
            // Remove todos os limites do usuário
            for (const key of this.users.keys()) {
                if (key.startsWith(`${userId}:`)) {
                    this.users.delete(key);
                }
            }
        }
    }
}

// ✅ Instância singleton
module.exports = new RateLimiter();