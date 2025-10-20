const cron = require('node-cron');
const db = require('../utils/database');
const config = require('../config');
const WeeklyReporter = require('./weeklyReporter');

const checkSubscriptions = async (bot) => {
    console.log('🔄 Executando verificação de assinaturas...');
    const subscriptions = db.getSubscriptions();
    const mainChannelId = config.mainChannelId;
    const now = new Date();
    let updatedSubscriptions = [...subscriptions];
    let expiredCount = 0;
    let notifiedCount = 0;

    for (const sub of subscriptions) {
        const expiryDate = new Date(sub.expiryDate);
        const timeLeft = expiryDate.getTime() - now.getTime();

        if (timeLeft < 0) {
            try {
                // ✅ TENTA REMOVER DO CANAL PRIMEIRO
                try {
                    await bot.banChatMember(mainChannelId, sub.userId);
                    await bot.unbanChatMember(mainChannelId, sub.userId);
                    console.log(`✅ Assinatura de ${sub.userName} (${sub.userId}) expirou. Usuário removido do canal.`);
                } catch (channelError) {
                    console.log(`⚠️ Não foi possível remover ${sub.userId} do canal: ${channelError.message}`);
                    // Continua mesmo se não conseguir remover do canal
                }
                
                // ✅ NOTIFICA O USUÁRIO
                try {
                    await bot.sendMessage(sub.userId, 
                        "📅 *Sua assinatura expirou!*\n\n" +
                        "Seu acesso ao grupo VIP foi removido. Para voltar, basta iniciar uma nova assinatura a qualquer momento com /start.\n\n" +
                        "Aproveite para conferir nossos planos atualizados! 🚀", 
                        { parse_mode: 'Markdown' }
                    );
                } catch (msgError) {
                    console.log(`⚠️ Não foi possível notificar ${sub.userId}: ${msgError.message}`);
                }
                
                expiredCount++;
                updatedSubscriptions = updatedSubscriptions.filter(s => s.userId !== sub.userId);
            
            } catch (e) {
                console.error(`❌ Erro ao processar expiração de ${sub.userId}: ${e.message}`);
            }
        }
        else {
            const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
            
            // ✅ NOTIFICAÇÃO DE RENOVAÇÃO (3, 2, 1 dias)
            if (daysLeft <= 3 && !sub.renewalNotified) {
                try {
                    let message = '';
                    let emoji = '🔔';
                    
                    if (daysLeft === 3) {
                        message = `🔔 *Lembrete de Renovação* 🔔\n\nSua assinatura expira em *${daysLeft} dias*! Mantenha seu acesso renovando a tempo.`;
                    } else if (daysLeft === 2) {
                        message = `⚠️ *Atenção: Renovação* ⚠️\n\nFaltam apenas *${daysLeft} dias* para sua assinatura expirar! Não perca o acesso.`;
                    } else if (daysLeft === 1) {
                        message = `🚨 *ÚLTIMO DIA!* 🚨\n\nSua assinatura expira *AMANHÃ*! Renove agora para não perder o acesso.`;
                    }
                    
                    if (message) {
                        await bot.sendMessage(sub.userId, 
                            message + "\n\nUse o comando /start para ver os planos e renovar!",
                            { parse_mode: 'Markdown' }
                        );
                        
                        const subIndex = updatedSubscriptions.findIndex(s => s.userId === sub.userId);
                        if(subIndex !== -1) {
                            updatedSubscriptions[subIndex].renewalNotified = true;
                        }
                        
                        notifiedCount++;
                        console.log(`📧 Notificação de renovação enviada para ${sub.userName} (${daysLeft} dias)`);
                    }

                } catch(e) {
                    console.error(`❌ Erro ao enviar aviso de renovação para ${sub.userId}: ${e.message}`);
                }
            }
            
            // ✅ RESETA NOTIFICAÇÃO SE O USUÁRIO RENOVOU
            if (daysLeft > 3 && sub.renewalNotified) {
                const subIndex = updatedSubscriptions.findIndex(s => s.userId === sub.userId);
                if(subIndex !== -1) {
                    updatedSubscriptions[subIndex].renewalNotified = false;
                    console.log(`🔄 Notificação resetada para ${sub.userName} (assinatura renovada)`);
                }
            }
        }
    }
    
    // ✅ ATUALIZA BANCO DE DADOS APENAS SE HOUVER MUDANÇAS
    if (expiredCount > 0 || notifiedCount > 0) {
        db.updateAllSubscriptions(updatedSubscriptions);
        console.log(`✅ Verificação concluída: ${expiredCount} expiradas, ${notifiedCount} notificadas`);
    } else {
        console.log('✅ Verificação concluída: sem mudanças necessárias');
    }
};

// ✅ NOVA FUNÇÃO: Verificação de saúde do sistema
const systemHealthCheck = async (bot) => {
    try {
        console.log('🏥 Verificação de saúde do sistema...');
        
        const stats = {
            totalUsers: db.getAllUsers().length,
            activeSubscriptions: db.getSubscriptions().length,
            pendingPayments: Object.keys(db.getPendingPayments()).length,
            funnelUsers: Object.keys(db.getFunnelUsers()).length
        };
        
        // ✅ VERIFICA SE O BOT AINDA ESTÁ RESPONDENDO
        try {
            await bot.getMe();
            stats.botStatus = '✅ Online';
        } catch (error) {
            stats.botStatus = '❌ Offline';
            console.error('❌ Bot não está respondendo:', error.message);
        }
        
        // ✅ VERIFICA SE O CANAL PRINCIPAL ESTÁ ACESSÍVEL
        try {
            const chat = await bot.getChat(config.mainChannelId);
            stats.channelStatus = '✅ Acessível';
            stats.channelTitle = chat.title;
        } catch (error) {
            stats.channelStatus = '❌ Inacessível';
            console.error('❌ Canal principal inacessível:', error.message);
        }
        
        console.log('📊 Estatísticas do sistema:', stats);
        
        // ✅ NOTIFICA ADMIN SE HOUVER PROBLEMAS
        if (stats.botStatus === '❌ Offline' || stats.channelStatus === '❌ Inacessível') {
            try {
                await bot.sendMessage(config.adminUserId,
                    `🚨 *ALERTA DE SAÚDE DO SISTEMA*\n\n` +
                    `*Status do Bot:* ${stats.botStatus}\n` +
                    `*Status do Canal:* ${stats.channelStatus}\n` +
                    `*Usuários:* ${stats.totalUsers}\n` +
                    `*Assinantes:* ${stats.activeSubscriptions}\n` +
                    `*Pagamentos Pendentes:* ${stats.pendingPayments}\n` +
                    `*Funil:* ${stats.funnelUsers} usuários\n\n` +
                    `Verifique a conectividade do sistema.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.error('❌ Não foi possível notificar admin:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro na verificação de saúde:', error.message);
    }
};

// ✅ NOVA FUNÇÃO: Verifica e envia upsells pós-compra (dias 0,3,7)
async function checkPostPurchaseUpsells(bot) {
    try {
        console.log('🔄 Verificando upsells pós-compra...');
        const subscriptions = db.getSubscriptions();
        const now = new Date();
        
        for (const sub of subscriptions) {
            const purchaseDate = new Date(sub.purchaseDate);
            const daysSincePurchase = Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24));
            
            // Upsell para dias específicos (0, 3, 7)
            if ([0, 3, 7].includes(daysSincePurchase)) {
                const upsellManager = new (require('./upsellManager'))(bot);
                await upsellManager.sendPostPurchaseUpsell(sub.userId, sub.planType, daysSincePurchase);
            }
        }
    } catch (error) {
        console.error('❌ Erro nos upsells pós-compra:', error.message);
    }
};

function startNotificationScheduler(bot) {
    // ✅ AGENDAMENTO PRINCIPAL: Verificação diária de assinaturas
    cron.schedule('0 1 * * *', () => checkSubscriptions(bot), {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    // ✅ NOVO: Verificação de saúde a cada 6 horas
    cron.schedule('0 */6 * * *', () => systemHealthCheck(bot), {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    // ✅ NOVO: Limpeza de dados temporários a cada 12 horas
    cron.schedule('0 */12 * * *', () => {
        console.log('🧹 Executando limpeza de dados temporários...');
        const cleanupStats = db.cleanupDatabase();
        if (cleanupStats.total > 0) {
            console.log(`✅ Limpeza concluída: ${cleanupStats.total} registros removidos`);
        }
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    // ✅ NOVO: Agendamento diário para upsells pós-compra (10:00)
    cron.schedule('0 10 * * *', () => checkPostPurchaseUpsells(bot), {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    console.log('⏰ Agendadores configurados:');
    console.log('   • Verificação de assinaturas: Diariamente às 01:00');
    console.log('   • Verificação de saúde: A cada 6 horas');
    console.log('   • Limpeza de dados: A cada 12 horas');
    console.log('   • Upsells pós-compra: Diariamente às 10:00');
}

// Importar e iniciar relatório semanal
function startWeeklyReporter(bot) {
    const weeklyReporter = new WeeklyReporter(bot);
    weeklyReporter.startWeeklySchedule();
}

// ✅ ATUALIZAR O module.exports
module.exports = { 
    startNotificationScheduler,
    checkSubscriptions, // ✅ EXPORT PARA TESTES
    systemHealthCheck,   // ✅ EXPORT PARA TESTES
    startWeeklyReporter // NOVO
};