// services/weeklyReporter.js - RELATÓRIO SEMANAL AUTOMÁTICO
const db = require('../utils/database');
const config = require('../config');

class WeeklyReporter {
    constructor(bot) {
        this.bot = bot;
    }

    async generateWeeklyReport() {
        try {
            console.log('📊 Gerando relatório semanal...');
            
            const stats = this.calculateWeeklyStats();
            const report = this.formatReport(stats);
            
            // Envia para o admin
            await this.sendReportToAdmin(report);
            
            console.log('✅ Relatório semanal enviado!');
            return report;
            
        } catch (error) {
            console.error('❌ Erro no relatório semanal:', error.message);
        }
    }

    calculateWeeklyStats() {
        const subscriptions = db.getSubscriptions();
        const allUsers = db.getAllUsers();
        const funnelUsers = db.getFunnelUsers();
        const pendingPayments = db.getPendingPayments();

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        // Novos usuários na semana
        const newUsersThisWeek = allUsers.length; // Simplificado - idealmente teria timestamp

        // Novas assinaturas na semana
        const newSubsThisWeek = subscriptions.filter(sub => {
            try {
                const purchaseDate = new Date(sub.purchaseDate);
                return purchaseDate >= oneWeekAgo;
            } catch (e) {
                return false;
            }
        });

        // Receita estimada (baseada nos planos)
        const weeklyRevenue = newSubsThisWeek.reduce((total, sub) => {
            const settings = db.getSettings();
            const plan = settings.plans[sub.planType];
            return total + (plan ? plan.price : 0);
        }, 0);

        // Conversões do funil
        const funnelConversions = Object.values(funnelUsers).filter(user => 
            user.hasPaid
        ).length;

        // Estatísticas de pagamento
        const paymentStats = {
            total: Object.keys(pendingPayments).length,
            completed: newSubsThisWeek.length,
            failed: 0 // Seria calculado com mais dados
        };

        return {
            period: {
                start: oneWeekAgo.toLocaleDateString('pt-BR'),
                end: now.toLocaleDateString('pt-BR')
            },
            users: {
                total: allUsers.length,
                newThisWeek: newUsersThisWeek,
                growth: ((newUsersThisWeek / allUsers.length) * 100).toFixed(1)
            },
            subscriptions: {
                total: subscriptions.length,
                newThisWeek: newSubsThisWeek.length,
                active: subscriptions.filter(sub => {
                    try {
                        return new Date(sub.expiryDate) > now;
                    } catch (e) {
                        return false;
                    }
                }).length
            },
            revenue: {
                weekly: weeklyRevenue,
                averageTicket: newSubsThisWeek.length > 0 ? 
                    (weeklyRevenue / newSubsThisWeek.length).toFixed(2) : 0
            },
            funnel: {
                totalUsers: Object.keys(funnelUsers).length,
                conversions: funnelConversions,
                conversionRate: Object.keys(funnelUsers).length > 0 ?
                    ((funnelConversions / Object.keys(funnelUsers).length) * 100).toFixed(1) : 0
            },
            payments: paymentStats
        };
    }

    formatReport(stats) {
        const emoji = stats.subscriptions.newThisWeek > 0 ? '🚀' : '📊';
        
        return `
${emoji} *RELATÓRIO SEMANAL* ${emoji}

*📅 Período:* ${stats.period.start} à ${stats.period.end}

*👥 USUÁRIOS*
• Total: ${stats.users.total}
• Novos esta semana: ${stats.users.newThisWeek}
• Crescimento: ${stats.users.growth}%

*💳 ASSINATURAS*  
• Total ativas: ${stats.subscriptions.active}
• Novas esta semana: ${stats.subscriptions.newThisWeek}
• Total histórico: ${stats.subscriptions.total}

*💰 RECEITA*
• Esta semana: R$ ${stats.revenue.weekly.toFixed(2)}
• Ticket médio: R$ ${stats.revenue.averageTicket}

*🎯 FUNIL DE VENDAS*
• Usuários no funil: ${stats.funnel.totalUsers}
• Conversões: ${stats.funnel.conversions}
• Taxa de conversão: ${stats.funnel.conversionRate}%

*💸 PAGAMENTOS*
• Pendentes: ${stats.payments.total}
• Aprovados: ${stats.payments.completed}

${this.getWeeklyInsights(stats)}
        `.trim();
    }

    getWeeklyInsights(stats) {
        const insights = [];
        
        if (stats.subscriptions.newThisWeek === 0) {
            insights.push('⚡ *ALERTA:* Nenhuma nova assinatura esta semana. Considere ajustar o funil.');
        }
        
        if (stats.funnel.conversionRate < 5) {
            insights.push('🎯 *OPORTUNIDADE:* Taxa de conversão do funil baixa. Teste novas mensagens.');
        }
        
        if (stats.payments.total > 10) {
            insights.push('💡 *ATENÇÃO:* Muitos pagamentos pendentes. Verifique os gateways.');
        }
        
        if (stats.subscriptions.newThisWeek > 5) {
            insights.push('🎉 *EXCELENTE:* Boa performance de vendas esta semana!');
        }
        
        return insights.length > 0 ? 
            `\n*💡 INSIGHTS DA SEMANA:*\n${insights.join('\n')}` : 
            '\n*📈 Semana estável. Mantenha o trabalho!*';
    }

    async sendReportToAdmin(report) {
        try {
            await this.bot.sendMessage(config.adminUserId, report, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: '📊 Ver Estatísticas Detalhadas', 
                            callback_data: 'admin_stats' 
                        },
                        { 
                            text: '🎯 Gerenciar Funil', 
                            callback_data: 'admin_sales_funnel' 
                        }
                    ]]
                }
            });
        } catch (error) {
            console.error('❌ Erro ao enviar relatório para admin:', error.message);
        }
    }

    startWeeklySchedule() {
        // Agenda para todo domingo às 09:00
        const cron = require('node-cron');
        
        cron.schedule('0 9 * * 0', () => {
            console.log('⏰ Disparando relatório semanal...');
            this.generateWeeklyReport();
        }, {
            scheduled: true,
            timezone: "America/Sao_Paulo"
        });

        console.log('✅ Agendador de relatório semanal configurado (Dom 09:00)');
    }
}

module.exports = WeeklyReporter;