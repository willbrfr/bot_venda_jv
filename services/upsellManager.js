// services/upsellManager.js - VERSÃO COMPLETA COM CONTROLE DE ACESSO
const db = require('../utils/database');

class UpsellManager {
    constructor(bot) {
        this.bot = bot;
    }

    // 🎯 CONFIGURAÇÃO COM CAMPOS DE ACESSO
    getUpsellConfig() {
        const settings = db.getSettings();
        
        // ✅ VERIFICA SE A ESTRUTURA EXISTE E É COMPATÍVEL
        if (!settings.upsell || !settings.upsell.carrinho || !settings.upsell.posCompra) {
            console.log('🔄 Criando estrutura do upsell...');
            // Configuração padrão com 3 produtos fixos e campos de acesso
            settings.upsell = {
                isActive: true,
                carrinho: {
                    produto1: {
                        isActive: true,
                        price: 49.90,
                        message: "💎 *ACESSO VIP!*\n\nQuer conteúdo exclusivo por apenas R$ 49,90?\n\n✅ Grupo secreto\n✅ Materiais extras\n✅ Suporte prioritário",
                        hasAccess: true,
                        accessType: "group", // group, channel, or null
                        accessLink: null,
                        accessName: "Grupo VIP Extra"
                    },
                    produto2: {
                        isActive: true,
                        price: 79.90,
                        message: "🚀 *MENTORIA!*\n\nAcelere seus resultados com mentoria personalizada por R$ 79,90!\n\n✅ 1 hora de consultoria\n✅ Plano personalizado\n✅ Acompanhamento",
                        hasAccess: false,
                        accessType: null,
                        accessLink: null,
                        accessName: ""
                    },
                    produto3: {
                        isActive: true,
                        price: 99.90,
                        message: "🔥 *CONTEÚDO PREMIUM!*\n\nAcesso vitalício a todo conteúdo premium por R$ 99,90!\n\n✅ Todos os cursos\n✅ Atualizações gratuitas\n✅ Suporte vitalício",
                        hasAccess: true,
                        accessType: "channel",
                        accessLink: null,
                        accessName: "Canal Premium"
                    }
                },
                posCompra: {
                    produto1: {
                        isActive: true,
                        price: 29.90,
                        message: "🎉 *PARABÉNS PELA COMPRA!*\n\nQue tal fazer upgrade para o plano mensal por apenas R$ 29,90?\n\n✅ 30 dias de acesso\n✅ Conteúdo extra\n✅ Economize 50%",
                        hasAccess: true,
                        accessType: "group",
                        accessLink: null,
                        accessName: "Upgrade Mensal"
                    },
                    produto2: {
                        isActive: true,
                        price: 49.90,
                        message: "📚 *MATERIAL EXTRA!*\n\nAproveite nosso material complementar por R$ 49,90!\n\n✅ E-books exclusivos\n✅ Templates prontos\n✅ Checklists",
                        hasAccess: false,
                        accessType: null,
                        accessLink: null,
                        accessName: ""
                    },
                    produto3: {
                        isActive: true,
                        price: 69.90,
                        message: "👥 *GRUPO AVANÇADO!*\n\nEntre no nosso grupo avançado por R$ 69,90!\n\n✅ Networking exclusivo\n✅ Mentores experientes\n✅ Oportunidades únicas",
                        hasAccess: true,
                        accessType: "group",
                        accessLink: null,
                        accessName: "Grupo Avançado"
                    }
                }
            };
            db.updateSettings(settings);
            console.log('✅ Estrutura do upsell criada com sucesso!');
        }
        
        // ✅ GARANTE QUE TODOS OS PRODUTOS EXISTEM
        this.ensureProdutosExistem(settings.upsell);
        
        return settings.upsell;
    }

    // ✅ VERIFICA E CRIA PRODUTOS QUE ESTÃO FALTANDO
    ensureProdutosExistem(upsellConfig) {
        let needsUpdate = false;
        
        // Produtos padrão do carrinho
        const produtosCarrinho = {
            produto1: {
                isActive: true,
                price: 49.90,
                message: "💎 *ACESSO VIP!*\n\nQuer conteúdo exclusivo por apenas R$ 49,90?\n\n✅ Grupo secreto\n✅ Materiais extras\n✅ Suporte prioritário",
                hasAccess: true,
                accessType: "group",
                accessLink: null,
                accessName: "Grupo VIP Extra"
            },
            produto2: {
                isActive: true,
                price: 79.90,
                message: "🚀 *MENTORIA!*\n\nAcelere seus resultados com mentoria personalizada por R$ 79,90!\n\n✅ 1 hora de consultoria\n✅ Plano personalizado\n✅ Acompanhamento",
                hasAccess: false,
                accessType: null,
                accessLink: null,
                accessName: ""
            },
            produto3: {
                isActive: true,
                price: 99.90,
                message: "🔥 *CONTEÚDO PREMIUM!*\n\nAcesso vitalício a todo conteúdo premium por R$ 99,90!\n\n✅ Todos os cursos\n✅ Atualizações gratuitas\n✅ Suporte vitalício",
                hasAccess: true,
                accessType: "channel",
                accessLink: null,
                accessName: "Canal Premium"
            }
        };

        // Produtos padrão pós-compra
        const produtosPosCompra = {
            produto1: {
                isActive: true,
                price: 29.90,
                message: "🎉 *PARABÉNS PELA COMPRA!*\n\nQue tal fazer upgrade para o plano mensal por apenas R$ 29,90?\n\n✅ 30 dias de acesso\n✅ Conteúdo extra\n✅ Economize 50%",
                hasAccess: true,
                accessType: "group",
                accessLink: null,
                accessName: "Upgrade Mensal"
            },
            produto2: {
                isActive: true,
                price: 49.90,
                message: "📚 *MATERIAL EXTRA!*\n\nAproveite nosso material complementar por R$ 49,90!\n\n✅ E-books exclusivos\n✅ Templates prontos\n✅ Checklists",
                hasAccess: false,
                accessType: null,
                accessLink: null,
                accessName: ""
            },
            produto3: {
                isActive: true,
                price: 69.90,
                message: "👥 *GRUPO AVANÇADO!*\n\nEntre no nosso grupo avançado por R$ 69,90!\n\n✅ Networking exclusivo\n✅ Mentores experientes\n✅ Oportunidades únicas",
                hasAccess: true,
                accessType: "group",
                accessLink: null,
                accessName: "Grupo Avançado"
            }
        };

        // Verifica e cria produtos do carrinho
        if (!upsellConfig.carrinho) {
            upsellConfig.carrinho = {};
            needsUpdate = true;
        }

        for (let i = 1; i <= 3; i++) {
            const key = `produto${i}`;
            if (!upsellConfig.carrinho[key]) {
                upsellConfig.carrinho[key] = produtosCarrinho[key];
                needsUpdate = true;
                console.log(`✅ Criado ${key} no carrinho`);
            } else {
                // ✅ GARANTE QUE OS NOVOS CAMPOS EXISTEM
                if (typeof upsellConfig.carrinho[key].hasAccess === 'undefined') {
                    upsellConfig.carrinho[key].hasAccess = produtosCarrinho[key].hasAccess;
                    upsellConfig.carrinho[key].accessType = produtosCarrinho[key].accessType;
                    upsellConfig.carrinho[key].accessLink = produtosCarrinho[key].accessLink;
                    upsellConfig.carrinho[key].accessName = produtosCarrinho[key].accessName;
                    needsUpdate = true;
                }
            }
        }

        // Verifica e cria produtos pós-compra
        if (!upsellConfig.posCompra) {
            upsellConfig.posCompra = {};
            needsUpdate = true;
        }

        for (let i = 1; i <= 3; i++) {
            const key = `produto${i}`;
            if (!upsellConfig.posCompra[key]) {
                upsellConfig.posCompra[key] = produtosPosCompra[key];
                needsUpdate = true;
                console.log(`✅ Criado ${key} no pós-compra`);
            } else {
                // ✅ GARANTE QUE OS NOVOS CAMPOS EXISTEM
                if (typeof upsellConfig.posCompra[key].hasAccess === 'undefined') {
                    upsellConfig.posCompra[key].hasAccess = produtosPosCompra[key].hasAccess;
                    upsellConfig.posCompra[key].accessType = produtosPosCompra[key].accessType;
                    upsellConfig.posCompra[key].accessLink = produtosPosCompra[key].accessLink;
                    upsellConfig.posCompra[key].accessName = produtosPosCompra[key].accessName;
                    needsUpdate = true;
                }
            }
        }

        // Salva se houve alterações
        if (needsUpdate) {
            const settings = db.getSettings();
            settings.upsell = upsellConfig;
            db.updateSettings(settings);
            console.log('🔄 Estrutura do upsell atualizada com campos de acesso!');
        }
    }

    // 💾 SALVAR CONFIGURAÇÃO
    saveUpsellConfig(config) {
        const settings = db.getSettings();
        settings.upsell = config;
        db.updateSettings(settings);
        return true;
    }

    // ✅ CONCEDER ACESSO AO USUÁRIO
    async grantUpsellAccess(userId, produtoNumero, tipo) {
        try {
            const config = this.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];
            
            if (!produto || !produto.hasAccess || !produto.accessLink) {
                return { success: false, error: 'Produto sem acesso configurado' };
            }

            // Verificar se usuário já tem acesso
            const existingAccess = db.getUpsellAccess(userId, tipo, produtoNumero);
            if (existingAccess && existingAccess.active) {
                return { 
                    success: false, 
                    error: 'Usuário já tem acesso a este produto',
                    existing: true 
                };
            }

            // Criar link de convite único
            const inviteLink = await this.bot.createChatInviteLink(produto.accessLink, {
                member_limit: 1,
                creates_join_request: false
            });

            // Obter nome do usuário para registro
            let userName = 'Usuário';
            try {
                const user = await this.bot.getChat(userId);
                userName = user.first_name || `User${userId}`;
            } catch (error) {
                console.log('⚠️ Não foi possível obter nome do usuário');
            }

            // Registrar o acesso no banco de dados
            db.addUpsellAccess({
                userId: userId,
                userName: userName,
                tipo: tipo,
                produtoNumero: produtoNumero,
                productName: produto.accessName,
                inviteLink: inviteLink.invite_link
            });

            console.log(`✅ Acesso concedido: ${userName} (${userId}) → ${produto.accessName}`);

            return {
                success: true,
                inviteLink: inviteLink.invite_link,
                productName: produto.accessName,
                accessType: produto.accessType
            };
        } catch (error) {
            console.error('❌ Erro ao conceder acesso:', error);
            
            // Tratamento específico para erros comuns
            if (error.response && error.response.statusCode === 400) {
                return { 
                    success: false, 
                    error: 'Bot não é administrador no grupo/canal' 
                };
            } else if (error.response && error.response.statusCode === 403) {
                return { 
                    success: false, 
                    error: 'Bot foi removido do grupo/canal' 
                };
            }
            
            return { success: false, error: error.message };
        }
    }

    // ✅ REVOGAR ACESSO DO USUÁRIO
    async revokeUpsellAccess(userId, produtoNumero, tipo) {
        try {
            const config = this.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];
            
            // Tentar remover do grupo/canal
            if (produto && produto.accessLink) {
                try {
                    await this.bot.banChatMember(produto.accessLink, userId);
                    await this.bot.unbanChatMember(produto.accessLink, userId);
                    console.log(`✅ Usuário ${userId} removido do ${produto.accessType}`);
                } catch (error) {
                    console.log(`⚠️ Não foi possível remover usuário ${userId} do ${produto.accessType}:`, error.message);
                    // Continua mesmo se não conseguir remover fisicamente
                }
            }
            
            // Marcar como inativo no banco
            const revoked = db.revokeUpsellAccess(userId, tipo, produtoNumero);
            
            if (revoked) {
                console.log(`✅ Acesso revogado: ${userId} → ${produto?.accessName || 'Produto'}`);
                return { success: true };
            } else {
                return { success: false, error: 'Acesso não encontrado' };
            }
        } catch (error) {
            console.error('❌ Erro ao revogar acesso:', error);
            return { success: false, error: error.message };
        }
    }

    // ✅ OBTER ACESSOS DO USUÁRIO
    getUserUpsellAccesses(userId) {
        return db.getUserUpsellAccesses(userId);
    }

    // ✅ OBTER TODOS OS ACESSOS DE UM PRODUTO
    getProductUpsellAccesses(tipo, produtoNumero) {
        return db.getProductUpsellAccesses(tipo, produtoNumero);
    }

    // ✅ VERIFICAR SE USUÁRIO TEM ACESSO ESPECÍFICO
    userHasAccess(userId, tipo, produtoNumero) {
        const access = db.getUpsellAccess(userId, tipo, produtoNumero);
        return access && access.active === true;
    }

    // 🛒 UPSELL NO CARRINHO (MANTIDO PARA COMPATIBILIDADE)
    async showUpsellCarrinho(userId, produtoNumero) {
        const config = this.getUpsellConfig();
        if (!config.isActive) return null;

        const produto = config.carrinho[`produto${produtoNumero}`];
        if (!produto || !produto.isActive) return null;

        const keyboard = {
            inline_keyboard: [
                [
                    { 
                        text: `✅ SIM, QUERO - R$ ${produto.price.toFixed(2)}`, 
                        callback_data: `upsell_accept_carrinho_${produtoNumero}`
                    }
                ],
                [
                    { 
                        text: '❌ NÃO, OBRIGADO', 
                        callback_data: `upsell_decline_carrinho_${produtoNumero}`
                    }
                ]
            ]
        };

        return {
            message: produto.message,
            keyboard: keyboard,
            price: produto.price,
            hasAccess: produto.hasAccess
        };
    }

    // 📅 UPSELL PÓS-COMPRA (MANTIDO PARA COMPATIBILIDADE)
    async sendUpsellPos(userId, produtoNumero) {
        const config = this.getUpsellConfig();
        if (!config.isActive) return;

        const produto = config.posCompra[`produto${produtoNumero}`];
        if (!produto || !produto.isActive) return;

        const keyboard = {
            inline_keyboard: [
                [
                    { 
                        text: `✅ QUERO SABER MAIS - R$ ${produto.price.toFixed(2)}`, 
                        callback_data: `upsell_accept_pos_${produtoNumero}`
                    }
                ],
                [
                    { 
                        text: '👍 TUDO BEM', 
                        callback_data: `upsell_decline_pos_${produtoNumero}`
                    }
                ]
            ]
        };

        try {
            await this.bot.sendMessage(userId, produto.message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            return true;
        } catch (error) {
            console.log(`❌ Não foi possível enviar upsell para ${userId}`);
            return false;
        }
    }

    // ✅ NOVO: GERAR RELATÓRIO DE ACESSOS
    getAccessReport() {
        const allAccesses = db.getUpsellAccesses();
        const stats = {
            total: Object.keys(allAccesses).length,
            active: 0,
            revoked: 0,
            byProduct: {},
            recent: []
        };

        Object.values(allAccesses).forEach(access => {
            if (access.active) {
                stats.active++;
            } else {
                stats.revoked++;
            }

            // Estatísticas por produto
            const productKey = `${access.tipo}_${access.produtoNumero}`;
            if (!stats.byProduct[productKey]) {
                stats.byProduct[productKey] = {
                    total: 0,
                    active: 0,
                    productName: access.productName
                };
            }
            stats.byProduct[productKey].total++;
            if (access.active) stats.byProduct[productKey].active++;

            // Acessos recentes (últimos 7 dias)
            const accessDate = new Date(access.accessDate);
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            if (accessDate > sevenDaysAgo && access.active) {
                stats.recent.push(access);
            }
        });

        stats.recent.sort((a, b) => new Date(b.accessDate) - new Date(a.accessDate));

        return stats;
    }
}

module.exports = UpsellManager;