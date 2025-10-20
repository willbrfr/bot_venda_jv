// handlers/upsellHandlers.js - VERSÃO COMPLETA COM CONCESSÃO DE ACESSO
class UpsellHandlers {
    constructor(bot, upsellManager) {
        this.bot = bot;
        this.upsellManager = upsellManager;
    }

    // 🎯 REGISTRAR HANDLERS DOS UPSELLS
    registerHandlers() {
        this.bot.on('callback_query', async (cbq) => {
            const data = cbq.data;
            
            // ✅ FORMATO: upsell_accept_carrinho_1 ou upsell_decline_carrinho_1
            if (data.startsWith('upsell_accept_carrinho_')) {
                await this.handleAcceptCarrinho(cbq);
            } 
            else if (data.startsWith('upsell_decline_carrinho_')) {
                await this.handleDeclineCarrinho(cbq);
            }
            else if (data.startsWith('upsell_accept_pos_')) {
                await this.handleAcceptPos(cbq);
            }
            else if (data.startsWith('upsell_decline_pos_')) {
                await this.handleDeclinePos(cbq);
            }
        });
    }

    // ✅ USUÁRIO ACEITOU UPSELL NO CARRINHO - CONCEDE ACESSO AUTOMÁTICO
    async handleAcceptCarrinho(cbq) {
        const produtoNumero = cbq.data.split('_')[3];
        const userId = cbq.from.id;
        
        try {
            await this.bot.answerCallbackQuery(cbq.id, { text: '✅ Produto adicionado ao carrinho!' });
            
            const config = this.upsellManager.getUpsellConfig();
            const produto = config.carrinho[`produto${produtoNumero}`];
            
            if (!produto) {
                await this.bot.sendMessage(userId, "❌ Erro: Produto não encontrado.");
                return;
            }

            let message = `🎉 *PRODUTO EXTRA ADICIONADO!*\n\n` +
                         `Você adicionou um produto extra ao seu pedido:\n\n` +
                         `💰 *Valor:* R$ ${produto.price.toFixed(2)}\n` +
                         `📦 *Será cobrado junto com sua assinatura*\n\n`;

            // ✅ CONCEDER ACESSO AUTOMÁTICO SE CONFIGURADO
            if (produto.hasAccess && produto.accessLink) {
                const accessResult = await this.upsellManager.grantUpsellAccess(
                    userId, 
                    produtoNumero, 
                    'carrinho'
                );
                
                if (accessResult.success) {
                    message += `🔐 *ACESSO CONCEDIDO!*\n\n` +
                              `🎊 Parabéns! Você agora tem acesso ao: *${accessResult.productName}*\n\n` +
                              `🔗 *Clique no link abaixo para entrar:*\n` +
                              `${accessResult.inviteLink}\n\n` +
                              `⚠️ *Este link é de uso único e expira em 24 horas.*`;
                    
                    // Enviar mensagem separada com o link para facilitar o clique
                    await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
                    
                    // Enviar link em mensagem separada
                    await this.bot.sendMessage(userId,
                        `🔗 *LINK DE ACESSO DIRETO:*\n\n` +
                        `${accessResult.inviteLink}\n\n` +
                        `Clique no link acima para entrar no ${accessResult.accessType === 'group' ? 'grupo' : 'canal'}!`,
                        { parse_mode: 'Markdown' }
                    );
                    
                } else if (accessResult.existing) {
                    message += `🔐 *VOCÊ JÁ TEM ACESSO!*\n\n` +
                              `Você já possui acesso ao: *${produto.accessName}*\n\n` +
                              `Verifique sua lista de grupos/canais ou entre em contato com o suporte se precisar de ajuda.`;
                    
                    await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
                } else {
                    message += `⚠️ *Produto adicionado, mas acesso pendente*\n\n` +
                              `Entre em contato com o suporte para liberar seu acesso ao: *${produto.accessName}*`;
                    
                    await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
                    
                    // Notificar admin sobre erro de acesso
                    await this.notifyAdminAccessError(userId, produto, accessResult.error);
                }
            } else {
                // Produto sem acesso configurado
                message += `Seu PIX será gerado com o valor total!`;
                await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
            }

            console.log(`📊 Upsell aceito: usuário ${userId}, produto ${produtoNumero}`);
            
        } catch (error) {
            console.error(`❌ Erro ao processar upsell carrinho para ${userId}:`, error);
            await this.bot.answerCallbackQuery(cbq.id, { text: '❌ Erro ao processar' });
            await this.bot.sendMessage(userId, "❌ Ocorreu um erro ao processar seu pedido. Tente novamente.");
        }
    }

    // ❌ USUÁRIO RECUSOU UPSELL NO CARRINHO
    async handleDeclineCarrinho(cbq) {
        const userId = cbq.from.id;
        
        try {
            await this.bot.answerCallbackQuery(cbq.id, { text: 'Tudo bem! Continuando...' });
            
            await this.bot.sendMessage(userId,
                `✅ Certo! Continuando com seu pedido principal...\n\n` +
                `Seu PIX será gerado apenas com o valor da assinatura.`,
                { parse_mode: 'Markdown' }
            );
            
            console.log(`📊 Upsell recusado: usuário ${userId}`);
            
        } catch (error) {
            console.error(`❌ Erro ao processar recusa de upsell para ${userId}:`, error);
        }
    }

    // ✅ USUÁRIO ACEITOU UPSELL PÓS-COMPRA - OFERECE ACESSO IMEDIATO
    async handleAcceptPos(cbq) {
        const produtoNumero = cbq.data.split('_')[3];
        const userId = cbq.from.id;
        
        try {
            await this.bot.answerCallbackQuery(cbq.id, { text: '✅ Interessado no produto!' });
            
            const config = this.upsellManager.getUpsellConfig();
            const produto = config.posCompra[`produto${produtoNumero}`];
            
            if (!produto) {
                await this.bot.sendMessage(userId, "❌ Erro: Produto não encontrado.");
                return;
            }

            // ✅ OFERECER ACESSO IMEDIATO SE CONFIGURADO
            if (produto.hasAccess && produto.accessLink) {
                const message = `🎉 *INTERESSE CONFIRMADO!*\n\n` +
                               `Você demonstrou interesse em:\n\n` +
                               `📛 *Produto:* ${produto.accessName}\n` +
                               `💰 *Valor:* R$ ${produto.price.toFixed(2)}\n\n` +
                               `🔐 *QUER ACESSO IMEDIATO?*\n\n` +
                               `Pague via PIX e tenha acesso instantâneo!`;
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { 
                                text: `💳 Pagar R$ ${produto.price.toFixed(2)}`, 
                                callback_data: `upsell_pay_pos_${produtoNumero}` 
                            }
                        ],
                        [
                            { 
                                text: '💬 Falar com Suporte', 
                                url: 'https://t.me/seu_suporte' 
                            }
                        ],
                        [
                            { 
                                text: '📋 Ver Detalhes', 
                                callback_data: `upsell_info_pos_${produtoNumero}` 
                            }
                        ]
                    ]
                };
                
                await this.bot.sendMessage(userId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                
            } else {
                // Produto sem acesso configurado
                const message = `🎉 *INTERESSE CONFIRMADO!*\n\n` +
                               `Você demonstrou interesse em nosso produto extra:\n\n` +
                               `💰 *Valor:* R$ ${produto.price.toFixed(2)}\n\n` +
                               `📞 *Entre em contato com o suporte para finalizar a compra!*\n\n` +
                               `Nosso time entrará em contato em breve!`;
                
                await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
                
                // Notificar admin sobre interesse
                await this.notifyAdminInterest(userId, produto);
            }

            console.log(`📊 Upsell pós-compra aceito: usuário ${userId}, produto ${produtoNumero}`);
            
        } catch (error) {
            console.error(`❌ Erro ao processar upsell pós-compra para ${userId}:`, error);
            await this.bot.answerCallbackQuery(cbq.id, { text: '❌ Erro ao processar' });
            await this.bot.sendMessage(userId, "❌ Ocorreu um erro. Tente novamente.");
        }
    }

    // ❌ USUÁRIO RECUSOU UPSELL PÓS-COMPRA
    async handleDeclinePos(cbq) {
        const userId = cbq.from.id;
        
        try {
            await this.bot.answerCallbackQuery(cbq.id, { text: 'Tudo bem! Obrigado 😊' });
            
            // Mensagem opcional de agradecimento
            await this.bot.sendMessage(userId,
                `Obrigado pelo feedback! 😊\n\n` +
                `Continue aproveitando sua assinatura! 🚀`,
                { parse_mode: 'Markdown' }
            );
            
            console.log(`📊 Upsell pós-compra recusado: usuário ${userId}`);
            
        } catch (error) {
            console.error(`❌ Erro ao processar recusa de upsell pós-compra para ${userId}:`, error);
        }
    }

    // 💰 PROCESSAR PAGAMENTO DE UPSELL PÓS-COMPRA - NOVO
    async handlePayUpsellPos(cbq) {
        const produtoNumero = cbq.data.split('_')[3];
        const userId = cbq.from.id;
        
        try {
            await this.bot.answerCallbackQuery(cbq.id, { text: 'Gerando PIX para o upsell...' });
            
            const config = this.upsellManager.getUpsellConfig();
            const produto = config.posCompra[`produto${produtoNumero}`];
            
            if (!produto) {
                await this.bot.sendMessage(userId, "❌ Erro: Produto não encontrado.");
                return;
            }

            // Aqui você integraria com seu sistema de pagamento
            // Por enquanto, vamos simular um processo de pagamento
            const message = `💰 *PAGAMENTO DO UPSELL*\n\n` +
                           `*Produto:* ${produto.accessName || `Produto ${produtoNumero}`}\n` +
                           `*Valor:* R$ ${produto.price.toFixed(2)}\n\n` +
                           `📞 *Entre em contato com o suporte para finalizar o pagamento:*\n` +
                           `https://t.me/seu_suporte\n\n` +
                           `💬 *Envie esta mensagem para o suporte:*\n` +
                           `"Quero pagar o upsell ${produtoNumero} - R$ ${produto.price.toFixed(2)}"`;
            
            await this.bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
            
            // Notificar admin sobre intenção de pagamento
            await this.notifyAdminPaymentIntent(userId, produto);
            
        } catch (error) {
            console.error(`❌ Erro ao processar pagamento de upsell para ${userId}:`, error);
            await this.bot.answerCallbackQuery(cbq.id, { text: '❌ Erro ao processar' });
        }
    }

    // 📋 MOSTRAR DETALHES DO UPSELL PÓS-COMPRA - NOVO
    async handleUpsellInfo(cbq) {
        const produtoNumero = cbq.data.split('_')[3];
        const userId = cbq.from.id;
        
        try {
            await this.bot.answerCallbackQuery(cbq.id);
            
            const config = this.upsellManager.getUpsellConfig();
            const produto = config.posCompra[`produto${produtoNumero}`];
            
            if (!produto) {
                await this.bot.sendMessage(userId, "❌ Erro: Produto não encontrado.");
                return;
            }

            let message = `📋 *DETALHES DO PRODUTO*\n\n` +
                         `📛 *Nome:* ${produto.accessName || `Produto ${produtoNumero}`}\n` +
                         `💰 *Valor:* R$ ${produto.price.toFixed(2)}\n\n` +
                         `📝 *Descrição:*\n${produto.message}\n\n`;
            
            if (produto.hasAccess && produto.accessLink) {
                message += `🔐 *INCLUI ACESSO A:* ${produto.accessType === 'group' ? '👥 Grupo' : '📢 Canal'}\n\n`;
            }
            
            message += `💡 *Como adquirir:*\n` +
                      `1. Entre em contato com o suporte\n` +
                      `2. Informe o código: UPSELL${produtoNumero}\n` +
                      `3. Efetue o pagamento via PIX\n` +
                      `4. Receba acesso imediato!`;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { 
                            text: `💳 Quero Comprar - R$ ${produto.price.toFixed(2)}`, 
                            callback_data: `upsell_pay_pos_${produtoNumero}` 
                        }
                    ],
                    [
                        { 
                            text: '💬 Falar com Suporte', 
                            url: 'https://t.me/seu_suporte' 
                        }
                    ]
                ]
            };
            
            await this.bot.sendMessage(userId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error(`❌ Erro ao mostrar detalhes de upsell para ${userId}:`, error);
        }
    }

    // 🔔 NOTIFICAR ADMIN SOBRE ERRO DE ACESSO - NOVO
    async notifyAdminAccessError(userId, produto, error) {
        try {
            const adminId = process.env.ADMIN_USER_ID; // Ou do seu config
            if (!adminId) return;
            
            const message = `🚨 *ERRO DE ACESSO AO UPSELL*\n\n` +
                           `👤 *Usuário:* ${userId}\n` +
                           `📦 *Produto:* ${produto.accessName}\n` +
                           `❌ *Erro:* ${error}\n\n` +
                           `⚠️ *Verifique:*\n` +
                           `• Bot é admin no grupo/canal?\n` +
                           `• Link está correto?\n` +
                           `• Permissões estão configuradas?`;
            
            await this.bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('❌ Erro ao notificar admin:', error);
        }
    }

    // 🔔 NOTIFICAR ADMIN SOBRE INTERESSE - NOVO
    async notifyAdminInterest(userId, produto) {
        try {
            const adminId = process.env.ADMIN_USER_ID;
            if (!adminId) return;
            
            const message = `🎯 *INTERESSE EM UPSELL*\n\n` +
                           `👤 *Usuário:* ${userId}\n` +
                           `📦 *Produto:* ${produto.accessName || 'Produto sem acesso'}\n` +
                           `💰 *Valor:* R$ ${produto.price.toFixed(2)}\n\n` +
                           `💬 *Entre em contato para finalizar a venda!*`;
            
            await this.bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('❌ Erro ao notificar admin sobre interesse:', error);
        }
    }

    // 🔔 NOTIFICAR ADMIN SOBRE INTENÇÃO DE PAGAMENTO - NOVO
    async notifyAdminPaymentIntent(userId, produto) {
        try {
            const adminId = process.env.ADMIN_USER_ID;
            if (!adminId) return;
            
            const message = `💳 *INTENÇÃO DE PAGAMENTO - UPSELL*\n\n` +
                           `👤 *Usuário:* ${userId}\n` +
                           `📦 *Produto:* ${produto.accessName}\n` +
                           `💰 *Valor:* R$ ${produto.price.toFixed(2)}\n` +
                           `🔗 *Tipo:* ${produto.accessType === 'group' ? 'Grupo' : 'Canal'}\n\n` +
                           `✅ *Usuário solicitou pagamento!*`;
            
            await this.bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('❌ Erro ao notificar admin sobre pagamento:', error);
        }
    }

    // 🔄 REGISTRAR HANDLERS ADICIONAIS - NOVO
    registerAdditionalHandlers() {
        // Handler para pagamento de upsell pós-compra
        this.bot.on('callback_query', async (cbq) => {
            const data = cbq.data;
            
            if (data.startsWith('upsell_pay_pos_')) {
                await this.handlePayUpsellPos(cbq);
            }
            else if (data.startsWith('upsell_info_pos_')) {
                await this.handleUpsellInfo(cbq);
            }
        });
    }

    // 🎯 INICIALIZAR TODOS OS HANDLERS
    initialize() {
        this.registerHandlers();
        this.registerAdditionalHandlers();
        console.log('✅ Upsell handlers inicializados com sistema de acesso');
    }
}

module.exports = UpsellHandlers;