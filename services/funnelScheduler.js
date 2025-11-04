const cron = require('node-cron');
const db = require('../utils/database');
const RateLimiter = require('../utils/rateLimiter');

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
            console.log('🔄 [FUNIL] Iniciando verificação...');
            
            const settings = db.getSettings();
            
            if (!settings.salesFunnel || !settings.salesFunnel.messages) {
                console.log('❌ [FUNIL] Funil não configurado ou sem mensagens');
                return;
            }

            const funnelSettings = settings.salesFunnel;
            
            if (!funnelSettings.isActive) {
                console.log('❌ [FUNIL] Funil desativado nas configurações');
                return;
            }

            // ✅ DEBUG: Verificar configurações das mensagens
            console.log('⚙️ [FUNIL] Configurações das mensagens:');
            Object.entries(funnelSettings.messages).forEach(([key, config]) => {
                console.log(`   📨 ${key}:`, {
                    delay: config.delay,
                    isActive: config.isActive,
                    hasText: !!config.text,
                    hasMedia: !!(config.media && config.media.fileId),
                    hasDiscount: config.useIndividualDiscount
                });
            });

            const funnelUsers = db.getFunnelUsers();
            const now = new Date();

            console.log(`📊 [FUNIL] ${Object.keys(funnelUsers).length} usuários no funil`);

            if (Object.keys(funnelUsers).length === 0) {
                console.log('ℹ️ [FUNIL] Nenhum usuário no funil no momento');
                return;
            }

            let totalActions = 0;

            for (const [userId, userData] of Object.entries(funnelUsers)) {
                console.log(`\n👤 [FUNIL] Verificando usuário ${userId}:`, {
                    hasPaid: userData.hasPaid,
                    messagesSent: userData.messagesSent?.length || 0,
                    startTime: userData.startTime
                });

                // ✅ VERIFICAÇÃO DE RATE LIMITING
                const rateLimit = RateLimiter.checkLimit(
                    userId, 
                    'funnel_message', 
                    5,
                    60 * 60 * 1000
                );

                console.log(`⏰ [FUNIL] Rate limit para ${userId}:`, {
                    allowed: rateLimit.allowed,
                    remaining: rateLimit.remaining
                });

                if (!rateLimit.allowed) {
                    console.log(`🚫 [FUNIL] Rate limit bloqueado para ${userId} - ${rateLimit.message}`);
                    continue;
                }

                if (userData.hasPaid) {
                    console.log(`✅ [FUNIL] Usuário ${userId} já pagou - removendo do funil`);
                    db.removeFunnelUser(userId);
                    totalActions++;
                    continue;
                }

                // ✅ CORREÇÃO DE ESTRUTURA DE DADOS
                if (!userData.startTime || !userData.messagesSent) {
                    console.log(`🛠 [FUNIL] Corrigindo estrutura do usuário ${userId}`);
                    db.updateFunnelUser(userId, { 
                        startTime: userData.startTime || new Date().toISOString(),
                        messagesSent: userData.messagesSent || [],
                        hasPaid: userData.hasPaid || false
                    });
                    continue;
                }

                const startTime = new Date(userData.startTime);
                
                if (isNaN(startTime.getTime())) {
                    console.log(`🛠 [FUNIL] Corrigindo data inválida do usuário ${userId}`);
                    db.updateFunnelUser(userId, { 
                        startTime: new Date().toISOString(),
                        messagesSent: userData.messagesSent || []
                    });
                    continue;
                }

                const timeDiff = (now - startTime) / (1000 * 60);
                console.log(`⏱ [FUNIL] Usuário ${userId} no funil há ${timeDiff.toFixed(1)} minutos`);

                // Verifica cada mensagem do funil
                for (const [messageKey, messageConfig] of Object.entries(funnelSettings.messages)) {
                    console.log(`\n📨 [FUNIL] Verificando mensagem "${messageKey}":`, {
                        delay: messageConfig.delay,
                        isActive: messageConfig.isActive,
                        hasDiscount: messageConfig.useIndividualDiscount
                    });

                    if (!messageConfig || typeof messageConfig !== 'object') {
                        console.log(`❌ [FUNIL] Configuração inválida para ${messageKey}`);
                        continue;
                    }

                    if (!messageConfig.isActive) {
                        console.log(`⏸ [FUNIL] Mensagem ${messageKey} desativada`);
                        continue;
                    }

                    const messageDelay = messageConfig.delay || 0;
                    const messageAlreadySent = Array.isArray(userData.messagesSent) && 
                                             userData.messagesSent.includes(messageKey);

                    console.log(`📊 [FUNIL] Status: delay=${messageDelay}min, já enviada=${messageAlreadySent}, timeDiff=${timeDiff.toFixed(1)}min`);

                    // Se chegou a hora de enviar e ainda não foi enviada
                    if (timeDiff >= messageDelay && !messageAlreadySent) {
                        console.log(`🎯 [FUNIL] ENVIANDO: ${messageKey} para ${userId}`);
                        
                        await this.sendFunnelMessage(userId, messageKey, messageConfig);
                        
                        // Marca como enviada
                        const updatedMessagesSent = [...(userData.messagesSent || []), messageKey];
                        db.updateFunnelUser(userId, { messagesSent: updatedMessagesSent });
                        
                        totalActions++;
                        console.log(`✅ [FUNIL] Mensagem ${messageKey} enviada com sucesso para ${userId}`);
                    } else if (timeDiff < messageDelay) {
                        console.log(`⏳ [FUNIL] Aguardando: ${messageKey} - faltam ${(messageDelay - timeDiff).toFixed(1)} minutos`);
                    } else if (messageAlreadySent) {
                        console.log(`✅ [FUNIL] Mensagem ${messageKey} já enviada anteriormente`);
                    }
                }
            }

            if (totalActions > 0) {
                console.log(`\n📈 [FUNIL] RESUMO: ${totalActions} mensagens enviadas para ${Object.keys(funnelUsers).length} usuários`);
            } else {
                console.log(`\nℹ️ [FUNIL] Nenhuma mensagem enviada neste ciclo`);
            }

        } catch (error) {
            console.error('❌ [FUNIL] Erro crítico no agendador do funil:', error);
        }
    }

    async sendFunnelMessage(userId, messageKey, messageConfig) {
        try {
            console.log(`🎯 [DEBUG CRÍTICO] sendFunnelMessage CHAMADO!`, {
                userId,
                messageKey,
                hasDiscount: messageConfig.useIndividualDiscount
            });

            let messageText = messageConfig.text || '';
            let discountText = '';
            let discountData = null;

            // ✅ SISTEMA DE DESCONTO REAL - SALVA NO BANCO
            if (messageConfig.useIndividualDiscount) {
                if (messageConfig.individualUsePercentage) {
                    const discountPercent = messageConfig.individualDiscountPercentage;
                    discountText = `\n\n🎁 *DESCONTO ESPECIAL: ${discountPercent}% OFF*`;
                    discountData = {
                        type: 'percentage',
                        value: discountPercent,
                        code: `FUNNEL_${messageKey}_${userId.slice(-4)}`,
                        messageKey: messageKey,
                        source: 'funnel',
                        useIndividualDiscount: true,
                        individualUsePercentage: true,
                        individualDiscountPercentage: discountPercent,
                        individualDiscountValue: 0
                    };
                } else {
                    const discountValue = messageConfig.individualDiscountValue;
                    discountText = `\n\n🎁 *DESCONTO ESPECIAL: R$ ${discountValue.toFixed(2)} OFF*`;
                    discountData = {
                        type: 'fixed', 
                        value: discountValue,
                        code: `FUNNEL_${messageKey}_${userId.slice(-4)}`,
                        messageKey: messageKey,
                        source: 'funnel',
                        useIndividualDiscount: true,
                        individualUsePercentage: false,
                        individualDiscountPercentage: 0,
                        individualDiscountValue: discountValue
                    };
                }
                
                // ✅ SALVAR DESCONTO NO BANCO PARA ESTE USUÁRIO
                const discountSaved = db.saveUserDiscount(userId, discountData);
                if (!discountSaved) {
                    console.error(`❌ [FUNIL] Falha ao salvar desconto para ${userId}`);
                } else {
                    console.log(`💰 [FUNIL] Desconto salvo: ${userId} - ${discountData.type} ${discountData.value}, messageKey: ${messageKey}`);
                }
            }

            // Aplica desconto ao texto
            messageText += discountText;

            // ✅ CORREÇÃO CRÍTICA: Incluir messageKey no callback_data
            const callbackData = `funnel_buy_discount_${messageKey}`;
            
            console.log(`🎯 [DEBUG CRÍTICO] callback_data DEFINIDO:`, {
                callback_data: callbackData,
                messageKey: messageKey,
                shouldBe: `funnel_buy_discount_${messageKey}`
            });

            const keyboard = {
                inline_keyboard: [
                    [{ 
                        text: `💳 Comprar com Desconto`, 
                        callback_data: callbackData // ✅ DEVE SER funnel_buy_discount_message2
                    }]
                ]
            };

            console.log(`🎯 [DEBUG CRÍTICO] Keyboard configurado:`, {
                keyboard: keyboard,
                callback_data: keyboard.inline_keyboard[0][0].callback_data
            });

            // Envia áudio primeiro se estiver ativo
            if (messageConfig.audio && messageConfig.audio.isActive && messageConfig.audio.fileId) {
                try {
                    console.log(`🎵 [FUNIL] Enviando áudio para ${userId}`);
                    await this.bot.sendAudio(userId, messageConfig.audio.fileId);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log(`❌ [FUNIL] Erro ao enviar áudio para ${userId}:`, error.message);
                }
            }

            // Envia mídia se configurada
            if (messageConfig.media && messageConfig.media.fileId && messageConfig.media.type) {
                const options = {
                    caption: messageText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                };

                console.log(`🖼 [FUNIL] Enviando mídia (${messageConfig.media.type}) para ${userId}`);

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
                        console.log(`❌ [FUNIL] Tipo de mídia não suportado: ${messageConfig.media.type}`);
                        await this.bot.sendMessage(userId, messageText, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard
                        });
                }
            } else {
                // Envia apenas texto se não houver mídia
                console.log(`📝 [FUNIL] Enviando texto para ${userId}`);
                await this.bot.sendMessage(userId, messageText, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }

            console.log(`📨 [FUNIL] ${messageKey} enviada com sucesso para ${userId}`);

        } catch (error) {
            if (error.response && error.response.statusCode === 403) {
                console.log(`🚫 [FUNIL] Usuário ${userId} bloqueou o bot - removendo do funil`);
                db.removeFunnelUser(userId);
            } else if (error.response && error.response.statusCode === 429) {
                console.log(`⏳ [FUNIL] Rate limit do Telegram atingido para ${userId} - aguardando próximo ciclo`);
            } else {
                console.error(`❌ [FUNIL] Erro ao enviar mensagem para ${userId}:`, error.message);
            }
        }
    }

    // Adiciona usuário ao funil quando inicia o bot mas não compra
    addUserToFunnel(userId) {
        try {
            const settings = db.getSettings();
            if (settings.salesFunnel && settings.salesFunnel.isActive) {
                db.addFunnelUser(userId);
                console.log(`👤 [FUNIL] Usuário ${userId} adicionado ao funil de vendas`);
            }
        } catch (error) {
            console.error(`❌ [FUNIL] Erro ao adicionar usuário ${userId} ao funil:`, error.message);
        }
    }

    // Remove usuário do funil quando realiza pagamento
    removeUserFromFunnel(userId) {
        try {
            db.updateFunnelUser(userId, { hasPaid: true });
            console.log(`✅ [FUNIL] Usuário ${userId} removido do funil (pagamento realizado)`);
            
            // ✅ LIMPA DESCONTO AO REALIZAR PAGAMENTO
            db.clearUserDiscount(userId);
            
            // ✅ RESETA O RATE LIMITING para este usuário
            RateLimiter.resetUserLimits(userId, 'funnel_message');
            
        } catch (error) {
            console.error(`❌ [FUNIL] Erro ao remover usuário ${userId} do funil:`, error.message);
        }
    }

    // Limpeza de usuários antigos
    async cleanOldFunnelUsers() {
        try {
            const funnelUsers = db.getFunnelUsers();
            const now = new Date();
            let cleanedCount = 0;
            
            console.log(`🧹 [FUNIL] Iniciando limpeza de usuários antigos`);
            
            for (const [userId, userData] of Object.entries(funnelUsers)) {
                const startTime = new Date(userData.startTime);
                
                if (isNaN(startTime.getTime())) {
                    db.removeFunnelUser(userId);
                    cleanedCount++;
                    continue;
                }
                
                const daysInFunnel = (now - startTime) / (1000 * 60 * 60 * 24);
                
                // Remove usuários com mais de 30 dias no funil
                if (daysInFunnel > 30) {
                    db.removeFunnelUser(userId);
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                console.log(`🧹 [FUNIL] Limpeza concluída: ${cleanedCount} usuários antigos removidos`);
            } else {
                console.log(`🧹 [FUNIL] Nenhum usuário antigo para limpar`);
            }
        } catch (error) {
            console.error('❌ [FUNIL] Erro na limpeza de usuários antigos:', error.message);
        }
    }

    // ✅ Estatísticas do funil
    getFunnelStats() {
        try {
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
                conversionRate: `${conversionRate}%`,
                avgMessagesPerUser
            };
        } catch (error) {
            console.error('❌ [FUNIL] Erro ao obter estatísticas:', error.message);
            return {
                totalUsers: 0,
                activeUsers: 0,
                convertedUsers: 0,
                messagesSent: 0,
                conversionRate: '0%',
                avgMessagesPerUser: 0
            };
        }
    }

    // ✅ Método para debug detalhado
    debugFunnelData() {
        try {
            const settings = db.getSettings();
            const funnelUsers = db.getFunnelUsers();
            const stats = this.getFunnelStats();
            
            console.log('\n🔍 [FUNIL] DEBUG - Dados Completos do Funil:');
            console.log('═'.repeat(50));
            console.log('⚙️ Configurações:');
            console.log(`   - Funil ativo: ${settings.salesFunnel?.isActive}`);
            console.log(`   - Mensagens configuradas: ${Object.keys(settings.salesFunnel?.messages || {}).length}`);
            
            console.log('\n📊 Estatísticas:');
            console.log(`   - Total usuários: ${stats.totalUsers}`);
            console.log(`   - Usuários ativos: ${stats.activeUsers}`);
            console.log(`   - Conversões: ${stats.convertedUsers}`);
            console.log(`   - Taxa de conversão: ${stats.conversionRate}`);
            console.log(`   - Mensagens enviadas: ${stats.messagesSent}`);
            console.log(`   - Média por usuário: ${stats.avgMessagesPerUser}`);
            
            console.log('\n👥 Usuários no funil:');
            Object.entries(funnelUsers).forEach(([userId, data]) => {
                console.log(`   👤 ${userId}:`, {
                    startTime: data.startTime,
                    messagesSent: data.messagesSent?.length || 0,
                    hasPaid: data.hasPaid
                });
            });
            console.log('═'.repeat(50));
            
        } catch (error) {
            console.error('❌ [FUNIL] Erro no debug:', error.message);
        }
    }
}

module.exports = FunnelScheduler;
