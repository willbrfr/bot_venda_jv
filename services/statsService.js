const db = require('../utils/database');

class StatsService {
    getBasicStats() {
        try {
            const users = db.getAllUsers();
            const subscriptions = db.getSubscriptions();
            const funnelUsers = db.getFunnelUsers();

            const activeSubs = subscriptions.filter(sub => {
                try {
                    const expiryDate = new Date(sub.expiryDate);
                    return expiryDate > new Date();
                } catch (error) {
                    return false;
                }
            });

            return {
                totalUsers: users.length,
                activeSubs: activeSubs.length,
                funnelUsers: Object.keys(funnelUsers).length,
                pendingPayments: 0
            };
        } catch (error) {
            console.error('❌ Erro no getBasicStats:', error);
            return {
                totalUsers: 0,
                activeSubs: 0,
                funnelUsers: 0,
                pendingPayments: 0
            };
        }
    }

    // ✅ ALIAS: getAdminStats é o mesmo que getBasicStats
    getAdminStats() {
        return this.getBasicStats();
    }

    getAdvancedStats() {
        try {
            const basicStats = this.getBasicStats();
            const subscriptions = db.getSubscriptions();
            const funnelStats = this.getFunnelStats();

            // Calcular taxas
            const conversionRate = basicStats.totalUsers > 0 ? 
                ((basicStats.activeSubs / basicStats.totalUsers) * 100).toFixed(1) : '0.0';

            const totalSubsEver = subscriptions.length;
            const churnRate = totalSubsEver > 0 ? 
                (((totalSubsEver - basicStats.activeSubs) / totalSubsEver) * 100).toFixed(1) : '0.0';

            // Planos populares
            const planCounts = {};
            subscriptions.forEach(sub => {
                if (sub && sub.planName) {
                    planCounts[sub.planName] = (planCounts[sub.planName] || 0) + 1;
                }
            });

            const popularPlans = Object.entries(planCounts)
                .map(([plan, count]) => ({ plan, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            if (popularPlans.length === 0) {
                popularPlans.push({ plan: 'Nenhum plano ativo', count: 0 });
            }

            return {
                ...basicStats,
                totalRevenue: '0.00',
                monthlyRevenue: '0.00',
                conversionRate,
                churnRate,
                averageTicket: '0.00',
                popularPlans,
                gatewayStats: [{ gateway: 'Nenhum pagamento', count: 0, percentage: '0.0' }],
                recentActivity: {},
                funnelConversionRate: funnelStats.conversionRate || '0.0'
            };
        } catch (error) {
            console.error('❌ Erro no getAdvancedStats:', error);
            return this.getFallbackStats();
        }
    }

    getFunnelStats() {
        try {
            const funnelUsers = db.getFunnelUsers();
            const total = Object.keys(funnelUsers).length;
            const converted = Object.values(funnelUsers).filter(user => user && user.hasPaid).length;
            const active = total - converted;

            const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

            let totalMessages = 0;
            let userCount = 0;
            
            Object.values(funnelUsers).forEach(user => {
                if (user) {
                    totalMessages += user.messageCount || 0;
                    userCount++;
                }
            });
            
            const averageMessages = userCount > 0 ? (totalMessages / userCount).toFixed(1) : '0.0';

            return {
                total,
                converted,
                active,
                conversionRate,
                averageMessages
            };
        } catch (error) {
            console.error('❌ Erro no getFunnelStats:', error);
            return {
                total: 0,
                converted: 0,
                active: 0,
                conversionRate: '0.0',
                averageMessages: '0.0'
            };
        }
    }

    getFallbackStats() {
        return {
            totalUsers: 0,
            activeSubs: 0,
            funnelUsers: 0,
            pendingPayments: 0,
            totalRevenue: '0.00',
            monthlyRevenue: '0.00',
            conversionRate: '0.0',
            churnRate: '0.0',
            averageTicket: '0.00',
            popularPlans: [{ plan: 'Nenhum plano ativo', count: 0 }],
            gatewayStats: [{ gateway: 'Nenhum pagamento', count: 0, percentage: '0.0' }],
            recentActivity: {},
            funnelConversionRate: '0.0'
        };
    }

    // ✅ MÉTODOS ADICIONAIS PARA DIFERENTES PAINÉIS
    getDashboardStats() {
        return this.getBasicStats();
    }

    getUserStats() {
        try {
            const basicStats = this.getBasicStats();
            const subscriptions = db.getSubscriptions();
            const funnelUsers = db.getFunnelUsers();

            const activeSubs = subscriptions.filter(sub => {
                try {
                    const expiryDate = new Date(sub.expiryDate);
                    return expiryDate > new Date();
                } catch (error) {
                    return false;
                }
            });

            const expiredSubs = subscriptions.filter(sub => {
                try {
                    const expiryDate = new Date(sub.expiryDate);
                    return expiryDate <= new Date();
                } catch (error) {
                    return false;
                }
            });

            const funnelActive = Object.values(funnelUsers).filter(user => 
                user && !user.hasPaid
            ).length;

            const funnelConverted = Object.values(funnelUsers).filter(user => 
                user && user.hasPaid
            ).length;

            return {
                totalUsers: basicStats.totalUsers,
                totalSubscriptions: subscriptions.length,
                activeSubscriptions: activeSubs.length,
                expiredSubscriptions: expiredSubs.length,
                funnelUsers: basicStats.funnelUsers,
                funnelActive,
                funnelConverted,
                conversionRate: basicStats.totalUsers > 0 ? 
                    ((activeSubs.length / basicStats.totalUsers) * 100).toFixed(1) : '0.0',
                funnelConversionRate: basicStats.funnelUsers > 0 ?
                    ((funnelConverted / basicStats.funnelUsers) * 100).toFixed(1) : '0.0'
            };
        } catch (error) {
            console.error('❌ Erro no getUserStats:', error);
            return {
                totalUsers: 0,
                totalSubscriptions: 0,
                activeSubscriptions: 0,
                expiredSubscriptions: 0,
                funnelUsers: 0,
                funnelActive: 0,
                funnelConverted: 0,
                conversionRate: '0.0',
                funnelConversionRate: '0.0'
            };
        }
    }

    getFinancialStats() {
        return {
            totalRevenue: '0.00',
            dailyRevenue: '0.00',
            weeklyRevenue: '0.00',
            monthlyRevenue: '0.00',
            totalPayments: 0,
            completedPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            successRate: '0.0',
            gatewayStats: {}
        };
    }

    // ✅ MÉTODO PARA ESTATÍSTICAS EM TEMPO REAL
    getRealTimeStats() {
        try {
            const basicStats = this.getBasicStats();
            const subscriptions = db.getSubscriptions();
            const funnelStats = this.getFunnelStats();

            // Usuários ativos nas últimas 24 horas
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

            // Esta é uma estimativa - você precisaria rastrear atividade de usuários
            const activeLast24h = Math.min(basicStats.totalUsers, Math.floor(basicStats.totalUsers * 0.1)); // 10% como estimativa

            // Novos usuários hoje
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // Estimativa baseada no total de usuários
            const newUsersToday = Math.min(10, Math.floor(basicStats.totalUsers * 0.01)); // 1% como estimativa

            return {
                ...basicStats,
                activeLast24h,
                newUsersToday,
                totalSubscriptions: subscriptions.length,
                funnelStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro no getRealTimeStats:', error);
            return {
                ...this.getFallbackStats(),
                activeLast24h: 0,
                newUsersToday: 0,
                totalSubscriptions: 0,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new StatsService();