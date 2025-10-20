const cron = require('node-cron');
const db = require('../utils/database');
const securityMiddleware = require('../middleware/securityMiddleware'); // ✅ NOVA IMPORT

class FunnelScheduler {
    constructor(bot) {
        this.bot = bot;
        this.isRunning = false;
    }

    start() {
        // Verifica a cada 10 minutos se há mensagens do funil para enviar
        cron.schedule('*/10 * * * *', () => {
            this.checkFunnelMessages();
        }, {
            scheduled: true,
            timezone: "America/Sao_Paulo"
        });

        console.log('🔄 Agendador do Funil de Vendas iniciado (verificação a cada 10 minutos)');
        this.isRunning = true;

        // Limpeza de usuários antigos uma vez por dia
        cron.schedule('0 3 * * *', () => {
            this.cleanOldFunnelUsers();
        });
    }

    async checkFunnelMessages() {
        try {
            const settings = db.getSettings();
            
            // VERIFICAÇÃO SILENCIOSA
            if (!settings.salesFunnel || !settings.salesFunnel.messages) {
                return;
            }

            const funnelSettings = settings.salesFunnel;
            
            // VERIFICAÇÃO SILENCIOSA SE O FUNIL ESTÁ ATIVO
            if (!funnelSettings.isActive) {
                return;
            }

            const funnelUsers = db.getFunnelUsers();
            const now = new Date();

            // ⬇️ LOG APENAS SE HOUVER USUÁRIOS
            if (Object.keys(funnelUsers).length === 0) {
                return;
            }

            let totalActions = 0;

            for (const [userId, userData] of Object.entries(funnelUsers)) {
                // VERIFICAÇÃO MAIS SEGURA se o usuário já pagou
                if (userData.hasPaid) {
                    db.removeFunnelUser(userId);
                    totalActions++;
                    continue;
                }

                // VERIFICAÇÃO DE ESTRUTURA DO USERDATA
                if (!userData.startTime || !userData.messagesSent) {
                    db.updateFunnelUser(userId, { 
                        startTime: userData.startTime || new Date().toISOString(),
                        messagesSent: userData.messagesSent || [],
                        hasPaid: userData.hasPaid || false
                    });
                    continue;
                }

                const startTime = new Date(userData.startTime);
                
                // VERIFICAÇÃO SE A DATA É VÁLIDA
                if (isNaN(startTime.getTime())) {
                    db.updateFunnelUser(userId, { 
                        startTime: new Date().toISOString(),
                        messagesSent: []
                    });
                    continue;
                }

                const timeDiff = (now - startTime) / (1000 * 60);

                // Verifica cada mensagem do funil
                for (const [messageKey, messageConfig] of Object.entries(funnelSettings.messages)) {
                    // VERIFICAÇÕES DE SEGURANÇA DA MENSAGEM
                    if (!messageConfig || typeof messageConfig !== 'object') {
                        continue;
                    }

                    if (!messageConfig.isActive) {
                        continue; // Mensagem desativada, pula
                    }

                    const messageDelay = messageConfig.delay || 0;
                    const messageAlreadySent = Array.isArray(userData.messagesSent) && 
                                             userData.messagesSent.includes(messageKey);

                    // Se chegou a hora de enviar e ainda não foi enviada
                    if (timeDiff >= messageDelay && !messageAlreadySent) {
                        // ✅ VERIFICA RATE LIMITING ANTES DE ENVIAR
                        const rateLimitResult = securityMiddleware.funnelMessageRateLimit(10, 3600000)(userId);
                        
                        if (!rateLimitResult.allowed) {
                            console.log(`⏳ Rate limiting para funil: usuário ${userId} excedeu limite`);
                            continue; // Pula este usuário por agora
                        }

                        await this.sendFunnelMessage(userId, messageKey, messageConfig);
                        
                        // Marca como enviada
                        const updatedMessagesSent = [...(userData.messagesSent || []), messageKey];
                        db.updateFunnelUser(userId, { messagesSent: updatedMessagesSent });
                        
                        totalActions++;
                    }
                }
            }

            // ⬇️ LOG ÚNICO RESUMIDO
            if (totalActions > 0) {
                console.log(`✅ Funil: ${totalActions} ações (${Object.keys(funnelUsers).length} users)`);
            }

        } catch (error) {
            console.error('❌ Erro no agendador do funil:', error.message);
        }
    }

    async sendFunnelMessage(userId, messageKey, messageConfig) {
        try {
            let messageText = messageConfig.text || '';
            let discountText = '';

            // ✅ LÓGICA SIMPLES - APENAS DESCONTO INDIVIDUAL
            if (messageConfig.useIndividualDiscount) {
                if (messageConfig.individualUsePercentage) {
                    discountText = `\n\n🎁 *DESCONTO ESPECIAL: ${messageConfig.individualDiscountPercentage}% OFF*`;
                } else {
                    discountText = `\n\n🎁 *DESCONTO ESPECIAL: R$ ${messageConfig.individualDiscountValue.toFixed(2)} OFF*`;
                }
            }

            // Aplica desconto ao texto
            messageText += discountText;

            // Adiciona botão para comprar com desconto
            const keyboard = {
                inline_keyboard: [
                    [{ 
                        text: `💳 Comprar com Desconto`, 
                        callback_data: `funnel_buy_discount` 
                    }]
                ]
            };

            // Envia áudio primeiro se estiver ativo
            if (messageConfig.audio && messageConfig.audio.isActive && messageConfig.audio.fileId) {
                try {
                    await this.bot.sendAudio(userId, messageConfig.audio.fileId);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    // Log silencioso para erros de áudio
                }
            }

            // Envia mídia se configurada
            if (messageConfig.media && messageConfig.media.fileId && messageConfig.media.type) {
                const options = {
                    caption: messageText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                };

                switch (messageConfig.media.type) {
                    case 'photo':
                        await this.bot.sendPhoto(userId, messageConfig.media.fileId, options);
                        break;
                    case 'animation':
                        await this.bot.sendAnimation(userId, messageConfig.media.fileId, options);
                        break;
                    case 'video':
                        await this.bot.sendVideo(userId, messageConfig.media.fileId, options);
                        break;
                    default:
                        await this.bot.sendMessage(userId, messageText, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard
                        });
                }
            } else {
                // Envia apenas texto se não houver mídia
                await this.bot.sendMessage(userId, messageText, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }

            // ⬇️ LOG APENAS DE ENVIO BEM-SUCEDIDO
            console.log(`📨 ${messageKey} enviada para ${userId}`);

        } catch (error) {
            // ⬇️ LOG APENAS SE ERRO FOR CRÍTICO
            if (error.response && error.response.statusCode === 403) {
                console.log(`🚫 Usuário ${userId} bloqueou o bot - removendo do funil`);
                db.removeFunnelUser(userId);
            } else if (error.response && error.response.statusCode === 429) {
                console.log(`⏳ Rate limit do Telegram atingido para ${userId} - aguardando próximo ciclo`);
                // Não remove o usuário, tenta novamente no próximo ciclo
            } else {
                console.error(`❌ Erro ao enviar para ${userId}:`, error.message);
            }
        }
    }

    // Adiciona usuário ao funil quando inicia o bot mas não compra
    addUserToFunnel(userId) {
        try {
            const settings = db.getSettings();
            if (settings.salesFunnel && settings.salesFunnel.isActive) {
                db.addFunnelUser(userId);
                console.log(`👤 Usuário ${userId} adicionado ao funil de vendas`);
            }
        } catch (error) {
            console.error(`❌ Erro ao adicionar usuário ${userId} ao funil:`, error.message);
        }
    }

    // Remove usuário do funil quando realiza pagamento
    removeUserFromFunnel(userId) {
        try {
            db.updateFunnelUser(userId, { hasPaid: true });
            console.log(`✅ Usuário ${userId} removido do funil (pagamento realizado)`);
        } catch (error) {
            console.error(`❌ Erro ao remover usuário ${userId} do funil:`, error.message);
        }
    }

    // Limpeza de usuários antigos
    async cleanOldFunnelUsers() {
        const funnelUsers = db.getFunnelUsers();
        const now = new Date();
        let cleanedCount = 0;
        
        for (const [userId, userData] of Object.entries(funnelUsers)) {
            const startTime = new Date(userData.startTime);
            const daysInFunnel = (now - startTime) / (1000 * 60 * 60 * 24);
            
            // Remove usuários com mais de 30 dias no funil
            if (daysInFunnel > 30) {
                db.removeFunnelUser(userId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Limpeza Funil: ${cleanedCount} usuários antigos removidos`);
        }
    }

    // ✅ NOVA FUNÇÃO: Estatísticas do funil
    getFunnelStats() {
        const funnelUsers = db.getFunnelUsers();
        const totalUsers = Object.keys(funnelUsers).length;
        const activeUsers = Object.values(funnelUsers).filter(user => !user.hasPaid).length;
        const convertedUsers = Object.values(funnelUsers).filter(user => user.hasPaid).length;
        
        const messagesSent = Object.values(funnelUsers).reduce((total, user) => {
            return total + (user.messagesSent ? user.messagesSent.length : 0);
        }, 0);

        const conversionRate = totalUsers > 0 ? ((convertedUsers / totalUsers) * 100).toFixed(1) : 0;
        const avgMessagesPerUser = totalUsers > 0 ? (messagesSent / totalUsers).toFixed(1) : 0;

        return {
            totalUsers,
            activeUsers,
            convertedUsers,
            messagesSent,
            conversionRate,
            avgMessagesPerUser
        };
    }
}

module.exports = FunnelScheduler;