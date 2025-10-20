const db = require('../utils/database');
const config = require('../config');
const { createMercadoPagoPix, getMercadoPagoPaymentStatus } = require('../services/mercadoPago');
const { createPushinPayPix, getPushinPayPaymentStatus } = require('../services/pushinpay');
const { createTriboPayPix, getTriboPayPaymentStatus } = require('../services/triboPay');
const { createPepperPix, getPepperPaymentStatus } = require('../services/pepper');
const FunnelScheduler = require('../services/funnelScheduler');
const securityMiddleware = require('../middleware/securityMiddleware');
const rateLimiter = require('../utils/rateLimiter');

const conversationState = {};
let funnelScheduler;

// ✅ IMPORT SEGURO DO UPSELL HANDLERS
let UpsellHandlers;
try {
    UpsellHandlers = require('./upsellHandlers');
} catch (error) {
    console.log('⚠️ UpsellHandlers não encontrado, continuando sem upsell...');
    UpsellHandlers = null;
}

async function showWelcomeScreen(bot, chatId) {
    const settings = db.getSettings();
    
    // PRIMEIRO: Envia áudio se estiver ativo
    if (settings.welcomeMedia?.audio?.isActive && settings.welcomeMedia.audio.fileId) {
        try {
            await bot.sendAudio(chatId, settings.welcomeMedia.audio.fileId);
            // Pequena pausa antes de enviar o resto
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Erro ao enviar áudio de boas-vindas para ${chatId}:`, error.message);
        }
    }
    
    // DEPOIS: Continua com o fluxo normal (mídia + mensagem)
    const planButtons = Object.entries(settings.plans)
        .filter(([, plan]) => plan.isActive)
        .map(([key, plan]) => ([{
            text: `✅ ${plan.name} - R$${plan.price.toFixed(2)}`,
            callback_data: `user_buy_${key}`
        }]));
        
    const keyboard = { inline_keyboard: [...planButtons] };
    
    if (settings.previewsChannel && settings.previewsChannel.isActive && settings.previewsChannel.link) {
        keyboard.inline_keyboard.push([{
            text: settings.previewsChannel.buttonText,
            url: settings.previewsChannel.link
        }]);
    }
    
    keyboard.inline_keyboard.push([{ text: `📞 Suporte`, url: settings.supportLink }]);
    
    const welcomeMedia = settings.welcomeMedia;

    try {
        if (welcomeMedia && welcomeMedia.isActive && welcomeMedia.fileId && welcomeMedia.type) {
            const options = {
                caption: settings.welcomeMessage,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            };

            switch (welcomeMedia.type) {
                case 'photo':
                    await bot.sendPhoto(chatId, welcomeMedia.fileId, options);
                    break;
                case 'animation':
                    await bot.sendAnimation(chatId, welcomeMedia.fileId, options);
                    break;
                case 'video':
                    await bot.sendVideo(chatId, welcomeMedia.fileId, options);
                    break;
                default:
                    await bot.sendMessage(chatId, settings.welcomeMessage, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
            }
        } else {
            await bot.sendMessage(chatId, settings.welcomeMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    } catch (error) {
        console.error(`Falha ao enviar mensagem de boas-vindas para ${chatId}. Erro: ${error.message}`);
        try {
            await bot.sendMessage(chatId, settings.welcomeMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (fallbackError) {
            console.error(`Falha no fallback da mensagem de boas-vindas para ${chatId}. Erro: ${fallbackError.message}`);
        }
    }
}

async function sendSubscriptionStatus(bot, chatId, userName) {
    const activeSub = db.getUserActiveSubscription(chatId);
    
    if (!activeSub) {
        try {
            await bot.sendMessage(chatId, "❌ Você não possui uma assinatura ativa no momento. Use o comando /start para ver os planos disponíveis.");
        } catch (e) {
            console.error(`Falha ao enviar status de "sem assinatura" para ${chatId}`);
        }
        return;
    }

    try {
        const expiryDate = new Date(activeSub.expiryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
        
        const inviteLink = await bot.createChatInviteLink(config.mainChannelId, { member_limit: 1 });
        
        const caption = `Olá, ${userName}!\n\n` +
                        `✅ *Sua assinatura está ativa!*\n\n` +
                        `*Plano:* ${activeSub.planName}\n` +
                        `*Expira em:* ${expiryDate}\n\n` +
                        `Precisa entrar no grupo novamente? Use o botão abaixo. O link é de uso único!`;
        
        await bot.sendMessage(chatId, caption, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔑 Acessar Grupo VIP", url: inviteLink.invite_link }]
                ]
            }
        });

    } catch (error) {
        console.error(`Falha ao enviar status ou gerar link para ${chatId}. Erro: ${error.message}`);
        try {
            await bot.sendMessage(chatId, "⚠️ Ocorreu um erro ao buscar suas informações. Por favor, tente novamente mais tarde ou contate o suporte.");
        } catch (e) {}
    }
}

async function processPayment(bot, user, planType, gateway, cpf = null) {
    try {
        // ✅ RATE LIMITING para pagamentos
        const limitResult = securityMiddleware.paymentRateLimit(3, 300000)({ from: user });
        
        if (!limitResult.allowed) {
            await bot.sendMessage(user.id, 
                `⏳ ${limitResult.message}\n\n` +
                `💳 Por segurança, limitamos tentativas de pagamento.`
            );
            return;
        }

        const settings = db.getSettings();
        const plan = settings.plans[planType];

        if (!plan || !plan.isActive) {
            return await bot.sendMessage(user.id, "❌ Este plano não está disponível.");
        }
        
        await bot.sendMessage(user.id, `Gerando PIX para o plano *${plan.name}* via ${gateway}...`, { parse_mode: 'Markdown' });

        let pixData = null;

        if (gateway === 'MercadoPago') {
            pixData = await createMercadoPagoPix({ name: `Plano ${plan.name}`, price: plan.price }, user.id);
        } else if (gateway === 'Pushinpay') {
            pixData = await createPushinPayPix({ name: `Plano ${plan.name}`, price: plan.price });
        } else if (gateway === 'TriboPay') {
            if (!cpf) {
                return await bot.sendMessage(user.id, "❌ Ocorreu um erro. O CPF é necessário para este método. Por favor, inicie o processo novamente.");
            }
            pixData = await createTriboPayPix(plan, user, cpf);
        } else if (gateway === 'Pepper') {
            pixData = await createPepperPix(plan, user, cpf);
        }
        
        if (pixData && pixData.error) {
            return await bot.sendMessage(user.id, `❌ *Erro ao gerar PIX:* ${pixData.error}\n\nPor favor, verifique o CPF digitado e tente novamente.`);
        }

        if (pixData) {
            db.addPendingPayment(pixData.paymentId.toString(), {
                userId: user.id,
                userName: user.first_name,
                planType: planType,
                planName: plan.name,
                planDays: plan.days,
                gateway: gateway
            });

            const qrCodeBuffer = Buffer.from(pixData.qrCodeBase64, 'base64');
            await bot.sendPhoto(user.id, qrCodeBuffer, { caption: `✅ *PIX Gerado!* Pague para liberar seu acesso.` });
            await bot.sendMessage(user.id, `👇 Ou use o *PIX Copia e Cola* abaixo:\n\n\`${pixData.pixCopyPaste}\``, { parse_mode: 'Markdown' });

            // ✅ UPSELL NO CARRINHO - APÓS GERAR PIX
            try {
                const UpsellManager = require('../services/upsellManager');
                const upsellManager = new UpsellManager(bot);
                const upsellData = await upsellManager.showPrePurchaseUpsell(user.id, planType);
                
                if (upsellData) {
                    // Pequena pausa antes do upsell
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    await bot.sendMessage(user.id, upsellData.message, {
                        parse_mode: 'Markdown',
                        reply_markup: upsellData.keyboard
                    });
                }
            } catch (upsellError) {
                console.log(`⚠️ Erro no upsell para ${user.id}:`, upsellError.message);
                // Continua normalmente mesmo com erro no upsell
            }

        } else {
            await bot.sendMessage(user.id, "❌ Desculpe, ocorreu um erro ao gerar o PIX. Verifique se o plano está configurado corretamente para este gateway ou contate o suporte.");
        }
    } catch (error) {
        console.error(`Falha ao processar pagamento para ${user.id}. Erro: ${error.message}`);
        
        if (!error.message.includes('Rate limit')) {
            await bot.sendMessage(user.id, 
                "❌ Erro temporário. Tente novamente em alguns instantes."
            );
        }
    }
}

function registerUserHandlers(bot) {
    // Inicializa o funil de vendas
    funnelScheduler = new FunnelScheduler(bot);
    funnelScheduler.start();

    // ✅ INICIALIZA UPSELL HANDLERS - VERSÃO COMPLETA
    try {
        const UpsellManager = require('../services/upsellManager');
        const UpsellHandlers = require('./upsellHandlers');
        
        const upsellManager = new UpsellManager(bot);
        const upsellHandlers = new UpsellHandlers(bot, upsellManager);
        upsellHandlers.initialize(); // ✅ AGORA USA initialize() EM VEZ DE registerHandlers()
        
        console.log('✅ Upsell handlers registrados com sistema de acesso');
    } catch (error) {
        console.log('⚠️ Erro ao registrar upsell handlers:', error.message);
    }

    bot.onText(/\/start/, async (msg) => {
        try {
            // ✅ VALIDAÇÃO E RATE LIMITING
            securityMiddleware.validateUser(msg);
            securityMiddleware.commandRateLimit(5, 60000)(msg, 'start_command');
            await securityMiddleware.artificialDelay();
            
            const user = msg.from;
            if (user.id.toString() === config.adminUserId.toString()) return;
            
            console.log(`🔔 /start recebido de ${user.first_name} (${user.id})`);
            
            db.addUser(user.id);
            
            try {
                const activeSub = db.getUserActiveSubscription(user.id);
                if (activeSub) {
                    console.log(`✅ Usuário ${user.id} tem assinatura ativa - mostrando status`);
                    await sendSubscriptionStatus(bot, user.id, user.first_name);
                } else {
                    // ✅ CORREÇÃO CRÍTICA: Adiciona usuário ao funil SEMPRE que não tem assinatura
                    console.log(`🔴 Usuário ${user.id} SEM assinatura - ADICIONANDO AO FUNIL`);
                    funnelScheduler.addUserToFunnel(user.id);
                    
                    // ✅ VERIFICAÇÃO: Confirma que foi adicionado
                    const funnelUsers = db.getFunnelUsers();
                    console.log(`📊 Usuário ${user.id} adicionado ao funil? ${!!funnelUsers[user.id]}`);
                    console.log(`📊 Total de usuários no funil: ${Object.keys(funnelUsers).length}`);
                    
                    await showWelcomeScreen(bot, user.id);
                }
            } catch(error) {
                console.error(`❌ Falha crítica ao processar /start para ${user.id}:`, error.message);
                console.error(error.stack);
            }
        } catch (error) {
            if (error.message.includes('Rate limit')) {
                await bot.sendMessage(msg.chat.id, 
                    `⏳ ${error.message}\n\n` +
                    `⚠️ Para evitar abuso, limitamos o número de tentativas.`
                );
            } else {
                console.error('Erro em /start:', error.message);
                await bot.sendMessage(msg.chat.id, 
                    '❌ Ocorreu um erro. Tente novamente em alguns instantes.'
                );
            }
        }
    });

    bot.onText(/\/status/, async (msg) => {
        try {
            // ✅ VALIDAÇÃO E RATE LIMITING
            securityMiddleware.validateUser(msg);
            securityMiddleware.commandRateLimit(3, 30000)(msg, 'status_command');
            await securityMiddleware.artificialDelay();
            
            const user = msg.from;
            if (user.id.toString() === config.adminUserId.toString()) return;
            
            await sendSubscriptionStatus(bot, user.id, user.first_name);
        } catch (error) {
            if (error.message.includes('Rate limit')) {
                await bot.sendMessage(msg.chat.id, error.message);
            }
            // Log silencioso para outros erros
        }
    });

    bot.on('callback_query', async (cbq) => {
        try {
            // ✅ RATE LIMITING para callbacks
            securityMiddleware.callbackRateLimit(15, 60000)(cbq);
            await securityMiddleware.artificialDelay(50, 200);
            
            const user = cbq.from;
            if (user.id.toString() === config.adminUserId.toString()) return;
            
            await bot.answerCallbackQuery(cbq.id);

            const dataParts = cbq.data.split('_');
            const context = dataParts[0];
            
            try {
                if (context === 'user') {
                    const [context, action, planType, gateway] = dataParts;
                    
                    switch (action) {
                        case 'buy': {
                            const settings = db.getSettings();
                            const gatewaysAtivos = [];
                            if (settings.payment.mercadoPago?.isActive) gatewaysAtivos.push({ text: "💳 Mercado Pago", callback_data: `user_pay_${planType}_MercadoPago`});
                            if (settings.payment.pushinpay?.isActive) gatewaysAtivos.push({ text: "🅿️ Pushinpay", callback_data: `user_pay_${planType}_Pushinpay`});
                            if (settings.payment.triboPay?.isActive) gatewaysAtivos.push({ text: "T TriboPay", callback_data: `user_pay_${planType}_TriboPay`});
                            if (settings.payment.pepper?.isActive) gatewaysAtivos.push({ text: "🌶️ Pepper", callback_data: `user_pay_${planType}_Pepper`});

                            if (gatewaysAtivos.length > 1) {
                                await bot.sendMessage(user.id, "Escolha a forma de pagamento:", {
                                    reply_markup: {
                                        inline_keyboard: gatewaysAtivos.map(g => [g])
                                    }
                                });
                            } else if (gatewaysAtivos.length === 1) {
                                const gatewayName = gatewaysAtivos[0].callback_data.split('_')[3];
                                
                                if (gatewayName === 'TriboPay') {
                                    conversationState[user.id] = { type: 'awaiting_cpf_tribopay', planType: planType };
                                    await bot.sendMessage(user.id, 'Para gerar o PIX com a TriboPay, por favor, digite seu *CPF* (apenas números):', { parse_mode: 'Markdown' });
                                } else if (gatewayName === 'Pepper') {
                                    conversationState[user.id] = { type: 'awaiting_cpf_pepper', planType: planType };
                                    await bot.sendMessage(user.id, '🌶️ Para gerar o PIX com a Pepper, por favor, digite seu *CPF* (apenas números):', { parse_mode: 'Markdown' });
                                } else {
                                    await processPayment(bot, user, planType, gatewayName);
                                }
                            } else {
                                await bot.sendMessage(user.id, "❌ Nenhum método de pagamento está configurado no momento. Por favor, contate o suporte.");
                            }
                            break;
                        }
                        
                        case 'pay': {
                            if (gateway === 'TriboPay') {
                                conversationState[user.id] = { type: 'awaiting_cpf_tribopay', planType: planType };
                                await bot.sendMessage(user.id, 'Para gerar o PIX com a TriboPay, por favor, digite seu *CPF* (apenas números):', { parse_mode: 'Markdown' });
                            } else if (gateway === 'Pepper') {
                                conversationState[user.id] = { type: 'awaiting_cpf_pepper', planType: planType };
                                await bot.sendMessage(user.id, '🌶️ Para gerar o PIX com a Pepper, por favor, digite seu *CPF* (apenas números):', { parse_mode: 'Markdown' });
                            } else {
                                await processPayment(bot, user, planType, gateway);
                            }
                            break;
                        }
                    }
                } 
                else if (context === 'funnel') {
                    const action = dataParts[1];
                    
                    if (action === 'buy' && dataParts[2] === 'discount') {
                        // Mostra planos SEM desconto aplicado (o desconto já está na mensagem do funil)
                        const settings = db.getSettings();
                        
                        const planButtons = Object.entries(settings.plans)
                            .filter(([, plan]) => plan.isActive)
                            .map(([key, plan]) => ([{
                                text: `✅ ${plan.name} - R$${plan.price.toFixed(2)}`,
                                callback_data: `user_buy_${key}`
                            }]));

                        await bot.sendMessage(user.id, 
                            `🎊 *OFERTA COM DESCONTO ESPECIAL!* 🎊\n\n` +
                            `Aproveite esta oportunidade única! Escolha seu plano:`, {
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: planButtons }
                        });
                    }
                }
                // The upsell callback handling was intentionally removed from this user handlers file.
                // Upsell callbacks are now handled in handlers/upsellHandlers.js and admin handlers.
            } catch(error) {
                console.error(`Falha ao processar callback_query para ${user.id}. Erro: ${error.message}`);
            }
        } catch (error) {
            if (error.message.includes('Rate limit')) {
                await bot.answerCallbackQuery(cbq.id, {
                    text: '⏳ Muitas ações rápidas. Aguarde um momento.',
                    show_alert: true
                });
            } else {
                await bot.answerCallbackQuery(cbq.id, {
                    text: '❌ Erro. Tente novamente.',
                    show_alert: true
                });
            }
        }
    });

    bot.on('message', async (msg) => {
        try {
            // ✅ VALIDAÇÃO DE USUÁRIO
            securityMiddleware.validateUser(msg);
            
            const userId = msg.from.id;
            const state = conversationState[userId];

            if (userId.toString() === config.adminUserId.toString() || !state || !msg.text || msg.text.startsWith('/')) {
                return;
            }

            // ✅ RATE LIMITING para mensagens de conversação
            securityMiddleware.commandRateLimit(10, 60000)(msg, 'conversation');
            await securityMiddleware.artificialDelay();

            if (state.type === 'awaiting_cpf_tribopay' || state.type === 'awaiting_cpf_pepper') {
                const cpf = msg.text.replace(/\D/g, '');

                if (cpf.length !== 11) {
                    await bot.sendMessage(userId, "❌ CPF inválido. Por favor, digite um CPF com 11 dígitos (apenas números).");
                    return;
                }

                const gateway = state.type === 'awaiting_cpf_tribopay' ? 'TriboPay' : 'Pepper';
                delete conversationState[userId];
                
                await processPayment(bot, msg.from, state.planType, gateway, cpf);
            }
        } catch (error) {
            if (error.message.includes('Rate limit')) {
                await bot.sendMessage(msg.chat.id, 
                    `⏳ ${error.message}\n\n` +
                    `💬 Aguarde antes de enviar mais mensagens.`
                );
            }
        }
    });

    // ✅ VERIFICAÇÃO DE PAGAMENTOS PENDENTES
    setInterval(async () => {
        const pendingPayments = db.getPendingPayments();
        for (const paymentId in pendingPayments) {
            try {
                const paymentData = db.getPendingPayment(paymentId);
                if (!paymentData) continue;
                
                let status = null;
                if (paymentData.gateway === 'MercadoPago') {
                    status = await getMercadoPagoPaymentStatus(paymentId);
                } else if (paymentData.gateway === 'Pushinpay') {
                    status = await getPushinPayPaymentStatus(paymentId);
                } else if (paymentData.gateway === 'TriboPay') {
                    status = await getTriboPayPaymentStatus(paymentId);
                } else if (paymentData.gateway === 'Pepper') {
                    status = await getPepperPaymentStatus(paymentId);
                }

                if (status === 'approved') {
                    const mainChannelId = config.mainChannelId;
                    const inviteLink = await bot.createChatInviteLink(mainChannelId, { member_limit: 1 });
                    
                    await bot.sendMessage(paymentData.userId, `🎉 *Pagamento Aprovado!* 🎉\n\nSua assinatura do *${paymentData.planName}* está ativa! Clique no botão abaixo para entrar. *O link é de uso único!*`, {
                        reply_markup: { inline_keyboard: [[{ text: "Entrar no Grupo VIP", url: inviteLink.invite_link }]] },
                        parse_mode: 'Markdown'
                    });

                    const now = new Date();
                    const expiryDate = new Date(new Date().setDate(now.getDate() + paymentData.planDays));
                    
                    const newSubscription = {
                        userId: paymentData.userId,
                        userName: paymentData.userName,
                        planType: paymentData.planType,
                        planName: paymentData.planName,
                        purchaseDate: now.toISOString(),
                        expiryDate: expiryDate.toISOString(),
                        renewalNotified: false
                    };
                    db.addSubscription(newSubscription);
                    db.removePendingPayment(paymentId);
                    
                    // Remove usuário do funil após pagamento aprovado
                    funnelScheduler.removeUserFromFunnel(paymentData.userId);
                    
                    // ✅ RESETA RATE LIMITING do usuário após pagamento bem-sucedido
                    rateLimiter.resetUserLimits(paymentData.userId, 'payment');

                    // ✅ UPSELL PÓS-COMPRA - APÓS PAGAMENTO APROVADO
                    try {
                        const UpsellManager = require('../services/upsellManager');
                        const upsellManager = new UpsellManager(bot);
                        
                        // Envia upsell imediato (dia 0)
                        await upsellManager.sendPostPurchaseUpsell(paymentData.userId, paymentData.planType, 0);
                        
                        // Agenda upsell para dias futuros
                        setTimeout(async () => {
                            await upsellManager.sendPostPurchaseUpsell(paymentData.userId, paymentData.planType, 3);
                        }, 3 * 24 * 60 * 60 * 1000); // 3 dias
                        
                        setTimeout(async () => {
                            await upsellManager.sendPostPurchaseUpsell(paymentData.userId, paymentData.planType, 7);
                        }, 7 * 24 * 60 * 60 * 1000); // 7 dias
                        
                    } catch (upsellError) {
                        console.log(`⚠️ Erro no upsell pós-compra para ${paymentData.userId}:`, upsellError.message);
                    }
                } 
                else if (['rejected', 'cancelled', 'expired', 'canceled'].includes(status)) {
                    await bot.sendMessage(paymentData.userId, `⚠️ O pagamento para o *${paymentData.planName}* foi recusado ou expirou. Tente novamente ou contate o suporte.`, { parse_mode: 'Markdown' });
                    db.removePendingPayment(paymentId);
                }
            } catch (error) {
                const paymentData = db.getPendingPayment(paymentId);
                const userId = paymentData ? paymentData.userId : 'ID desconhecido';
                console.error(`Falha ao verificar pagamento ou notificar usuário ${userId}. Usuário pode ter bloqueado o bot. Erro: ${error.message}`);
                
                if (error.response && error.response.statusCode === 403) {
                    db.removePendingPayment(paymentId);
                    console.log(`Pagamento pendente ${paymentId} removido pois o usuário bloqueou o bot.`);
                }
            }
        }
    }, 20000); 
}

module.exports = { registerUserHandlers };