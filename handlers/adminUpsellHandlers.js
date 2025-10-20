const db = require('../utils/database');

class AdminUpsellHandlers {
    constructor(bot, upsellManager) {
        this.bot = bot;
        this.upsellManager = upsellManager;
        this.editingState = null;
    }

    // 🎯 PAINEL PRINCIPAL DO UPSELL (MANTIDO)
    async showUpsellPanel(chatId) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const status = config.isActive ? "✅ ATIVADO" : "❌ DESATIVADO";

            const message = `🚀 *UPSELL AUTOMÁTICO*

📊 Status: ${status}

👉 *ESCOLHA ONDE CONFIGURAR:*`;

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🛒 Upsell no Carrinho", callback_data: "upsell_menu_carrinho" }],
                        [{ text: "📅 Upsell Pós-Compra", callback_data: "upsell_menu_pos" }],
                        [{ text: config.isActive ? "❌ Desativar Upsell" : "✅ Ativar Upsell", callback_data: "upsell_toggle" }],
                        [{ text: "📊 Ver Resumo", callback_data: "upsell_resumo" }],
                        [{ text: "👥 Gerenciar Acessos", callback_data: "upsell_manage_access" }],
                        [{ text: "🔙 Voltar", callback_data: "admin_panel" }]
                    ]
                }
            });
        } catch (error) {
            console.error('❌ Erro no showUpsellPanel:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar configurações do upsell.");
        }
    }

    // 🛒 UPSELL NO CARRINHO - ATUALIZADO COM INFO DE ACESSO
    async showUpsellCarrinho(chatId) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            
            let message = `🛒 *UPSELL NO CARRINHO*

Ofereça produtos extras *antes* do pagamento.

📦 *Produtos Disponíveis:*\n\n`;

            for (let i = 1; i <= 3; i++) {
                const produto = config.carrinho[`produto${i}`];
                if (produto) {
                    const status = produto.isActive ? "✅" : "❌";
                    const access = produto.hasAccess ? "🔐" : "🔓";
                    message += `${i}. ${status}${access} Produto ${i} - R$ ${produto.price.toFixed(2)}\n`;
                } else {
                    message += `${i}. ❌🔓 Produto ${i} - NÃO CONFIGURADO\n`;
                }
            }

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📦 Produto 1", callback_data: "upsell_edit_carrinho_1" }],
                        [{ text: "📦 Produto 2", callback_data: "upsell_edit_carrinho_2" }],
                        [{ text: "📦 Produto 3", callback_data: "upsell_edit_carrinho_3" }],
                        [{ text: "🔙 Voltar", callback_data: "upsell_main" }]
                    ]
                }
            });
        } catch (error) {
            console.error('❌ Erro no showUpsellCarrinho:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar upsell do carrinho.");
        }
    }

    // 📅 UPSELL PÓS-COMPRA - ATUALIZADO COM INFO DE ACESSO
    async showUpsellPos(chatId) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            
            let message = `📅 *UPSELL PÓS-COMPRA*

Ofereça produtos extras *depois* do pagamento.

⏰ *Produtos Programados:*\n\n`;

            for (let i = 1; i <= 3; i++) {
                const produto = config.posCompra[`produto${i}`];
                if (produto) {
                    const status = produto.isActive ? "✅" : "❌";
                    const access = produto.hasAccess ? "🔐" : "🔓";
                    const dias = i === 1 ? '0' : i === 2 ? '3' : '7';
                    message += `${i}. ${status}${access} Dia ${dias} - R$ ${produto.price.toFixed(2)}\n`;
                } else {
                    const dias = i === 1 ? '0' : i === 2 ? '3' : '7';
                    message += `${i}. ❌🔓 Dia ${dias} - NÃO CONFIGURADO\n`;
                }
            }

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📦 Produto 1 (0 dias)", callback_data: "upsell_edit_pos_1" }],
                        [{ text: "📦 Produto 2 (3 dias)", callback_data: "upsell_edit_pos_2" }],
                        [{ text: "📦 Produto 3 (7 dias)", callback_data: "upsell_edit_pos_3" }],
                        [{ text: "🔙 Voltar", callback_data: "upsell_main" }]
                    ]
                }
            });
        } catch (error) {
            console.error('❌ Erro no showUpsellPos:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar upsell pós-compra.");
        }
    }

    // ✏️ EDITOR DE PRODUTO - CARRINHO (ATUALIZADO COM BOTÃO DE ACESSO)
    async showEditorCarrinho(chatId, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const produto = config.carrinho[`produto${produtoNumero}`];
            
            if (!produto) {
                await this.bot.sendMessage(chatId, "❌ Produto não encontrado.");
                return this.showUpsellCarrinho(chatId);
            }

            const status = produto.isActive ? "✅ ATIVO" : "❌ INATIVO";
            const accessStatus = produto.hasAccess ? "🔐 COM ACESSO" : "🔓 SEM ACESSO";
            const accessType = produto.accessType === 'group' ? '👥 Grupo' : 
                              produto.accessType === 'channel' ? '📢 Canal' : '❌ Nenhum';

            const message = `✏️ *EDITANDO PRODUTO ${produtoNumero} - CARRINHO*

📊 Status: ${status}
🔐 Acesso: ${accessStatus}
📋 Tipo: ${accessType}
💰 Valor: R$ ${produto.price.toFixed(2)}
📝 Texto: ${produto.message.substring(0, 50)}...`;

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📝 Alterar Texto", callback_data: `upsell_text_carrinho_${produtoNumero}` },
                            { text: "💰 Alterar Valor", callback_data: `upsell_price_carrinho_${produtoNumero}` }
                        ],
                        [
                            { text: produto.isActive ? "❌ Desativar" : "✅ Ativar", callback_data: `upsell_toggle_carrinho_${produtoNumero}` },
                            { text: "🔐 Configurar Acesso", callback_data: `upsell_access_carrinho_${produtoNumero}` }
                        ],
                        [
                            { text: "👁️ Ver Preview", callback_data: `upsell_preview_carrinho_${produtoNumero}` }
                        ],
                        [
                            { text: "🔙 Voltar", callback_data: "upsell_menu_carrinho" }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('❌ Erro no showEditorCarrinho:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar editor do produto.");
        }
    }

    // ✏️ EDITOR PÓS-COMPRA (ATUALIZADO COM BOTÃO DE ACESSO)
    async showEditorPos(chatId, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const produto = config.posCompra[`produto${produtoNumero}`];
            
            if (!produto) {
                await this.bot.sendMessage(chatId, "❌ Produto não encontrado.");
                return this.showUpsellPos(chatId);
            }

            const status = produto.isActive ? "✅ ATIVO" : "❌ INATIVO";
            const accessStatus = produto.hasAccess ? "🔐 COM ACESSO" : "🔓 SEM ACESSO";
            const accessType = produto.accessType === 'group' ? '👥 Grupo' : 
                              produto.accessType === 'channel' ? '📢 Canal' : '❌ Nenhum';
            const dias = produtoNumero === '1' ? '0' : produtoNumero === '2' ? '3' : '7';

            const message = `✏️ *EDITANDO PRODUTO ${produtoNumero} - PÓS-COMPRA*

⏰ Dias após compra: ${dias}
📊 Status: ${status}
🔐 Acesso: ${accessStatus}
📋 Tipo: ${accessType}
💰 Valor: R$ ${produto.price.toFixed(2)}
📝 Texto: ${produto.message.substring(0, 50)}...`;

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📝 Alterar Texto", callback_data: `upsell_text_pos_${produtoNumero}` },
                            { text: "💰 Alterar Valor", callback_data: `upsell_price_pos_${produtoNumero}` }
                        ],
                        [
                            { text: produto.isActive ? "❌ Desativar" : "✅ Ativar", callback_data: `upsell_toggle_pos_${produtoNumero}` },
                            { text: "🔐 Configurar Acesso", callback_data: `upsell_access_pos_${produtoNumero}` }
                        ],
                        [
                            { text: "👁️ Ver Preview", callback_data: `upsell_preview_pos_${produtoNumero}` }
                        ],
                        [
                            { text: "🔙 Voltar", callback_data: "upsell_menu_pos" }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('❌ Erro no showEditorPos:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar editor do produto.");
        }
    }

    // 🔐 EDITOR DE ACESSO - NOVO
    async showAccessEditor(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];
            
            if (!produto) {
                await this.bot.sendMessage(chatId, "❌ Produto não encontrado.");
                return;
            }

            const status = produto.hasAccess ? "✅ ATIVO" : "❌ INATIVO";
            const accessType = produto.accessType === 'group' ? '👥 Grupo' : 
                              produto.accessType === 'channel' ? '📢 Canal' : '❌ Nenhum';
            const accessLink = produto.accessLink ? 
                `\`${produto.accessLink.substring(0, 30)}...\`` : 
                "Não configurado";

            // Obter estatísticas de acesso
            const accessUsers = this.upsellManager.getProductUpsellAccesses(tipo, produtoNumero);
            const activeUsers = accessUsers.filter(access => access.active).length;

            const message = `🔐 *CONFIGURAR ACESSO - ${tipo === 'carrinho' ? 'CARRINHO' : 'PÓS-COMPRA'} - Produto ${produtoNumero}*

📊 Status: ${status}
📋 Tipo: ${accessType}
🔗 Link: ${accessLink}
📛 Nome: ${produto.accessName || "Não definido"}
👥 Usuários com acesso: ${activeUsers} ativos`;

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { 
                                text: produto.hasAccess ? "❌ Desativar Acesso" : "✅ Ativar Acesso", 
                                callback_data: `upsell_toggle_access_${tipo}_${produtoNumero}` 
                            }
                        ],
                        [
                            { 
                                text: "👥 Definir como Grupo", 
                                callback_data: `upsell_set_accesstype_${tipo}_${produtoNumero}_group` 
                            },
                            { 
                                text: "📢 Definir como Canal", 
                                callback_data: `upsell_set_accesstype_${tipo}_${produtoNumero}_channel` 
                            }
                        ],
                        [
                            { 
                                text: "🔗 Configurar Link", 
                                callback_data: `upsell_set_accesslink_${tipo}_${produtoNumero}` 
                            },
                            { 
                                text: "📛 Configurar Nome", 
                                callback_data: `upsell_set_accessname_${tipo}_${produtoNumero}` 
                            }
                        ],
                        [
                            { 
                                text: "👥 Ver Usuários com Acesso", 
                                callback_data: `upsell_view_access_${tipo}_${produtoNumero}` 
                            }
                        ],
                        [
                            { 
                                text: "🔙 Voltar", 
                                callback_data: tipo === 'carrinho' ? 
                                    `upsell_edit_carrinho_${produtoNumero}` : 
                                    `upsell_edit_pos_${produtoNumero}` 
                            }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('❌ Erro no showAccessEditor:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar editor de acesso.");
        }
    }

    // 👥 PAINEL DE GERENCIAMENTO DE ACESSOS - NOVO
    async showAccessManagementPanel(chatId) {
        try {
            const accessReport = this.upsellManager.getAccessReport();
            
            const message = `👥 *GERENCIAR ACESSOS DE UPSELL*

📊 *Estatísticas Gerais:*
• Total de acessos: ${accessReport.total}
• Acessos ativos: ${accessReport.active}
• Acessos revogados: ${accessReport.revoked}
• Acessos recentes (7 dias): ${accessReport.recent.length}

📦 *Acessos por Produto:*`;

            const keyboard = {
                inline_keyboard: []
            };

            // Adicionar produtos do carrinho
            for (let i = 1; i <= 3; i++) {
                const productAccess = accessReport.byProduct[`carrinho_${i}`];
                if (productAccess) {
                    keyboard.inline_keyboard.push([
                        { 
                            text: `🛒 Produto ${i} - ${productAccess.active}/${productAccess.total} usuários`, 
                            callback_data: `upsell_view_access_carrinho_${i}` 
                        }
                    ]);
                }
            }

            // Adicionar produtos pós-compra
            for (let i = 1; i <= 3; i++) {
                const productAccess = accessReport.byProduct[`pos_${i}`];
                if (productAccess) {
                    keyboard.inline_keyboard.push([
                        { 
                            text: `📅 Produto ${i} - ${productAccess.active}/${productAccess.total} usuários`, 
                            callback_data: `upsell_view_access_pos_${i}` 
                        }
                    ]);
                }
            }

            keyboard.inline_keyboard.push([
                { text: "🔄 Atualizar", callback_data: "upsell_manage_access" },
                { text: "🔙 Voltar", callback_data: "upsell_main" }
            ]);

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('❌ Erro no showAccessManagementPanel:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar painel de acessos.");
        }
    }

    // 👁️ VISUALIZAR USUÁRIOS COM ACESSO - NOVO
    async showProductAccessUsers(chatId, tipo, produtoNumero) {
        try {
            const accessUsers = this.upsellManager.getProductUpsellAccesses(tipo, produtoNumero);
            const activeUsers = accessUsers.filter(access => access.active);
            const revokedUsers = accessUsers.filter(access => !access.active);

            const config = this.upsellManager.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];

            let message = `👥 *USUÁRIOS COM ACESSO - ${produto?.accessName || `Produto ${produtoNumero}`}*

✅ *Ativos:* ${activeUsers.length} usuários
❌ *Revogados:* ${revokedUsers.length} usuários\n\n`;

            if (activeUsers.length > 0) {
                message += `*Usuários Ativos:*\n`;
                activeUsers.slice(0, 10).forEach((access, index) => {
                    const date = new Date(access.accessDate).toLocaleDateString('pt-BR');
                    message += `${index + 1}. ${access.userName} (${access.userId}) - ${date}\n`;
                });
                
                if (activeUsers.length > 10) {
                    message += `\n... e mais ${activeUsers.length - 10} usuários`;
                }
            } else {
                message += `Nenhum usuário com acesso ativo no momento.`;
            }

            const keyboard = {
                inline_keyboard: [
                    [
                        { 
                            text: "🗑️ Revogar Todos os Acessos", 
                            callback_data: `upsell_revoke_all_${tipo}_${produtoNumero}` 
                        }
                    ]
                ]
            };

            // Adicionar botões para revogar acesso individual se houver usuários
            if (activeUsers.length > 0) {
                activeUsers.slice(0, 5).forEach(access => {
                    keyboard.inline_keyboard.push([
                        { 
                            text: `❌ Revogar ${access.userName}`, 
                            callback_data: `upsell_revoke_user_${tipo}_${produtoNumero}_${access.userId}` 
                        }
                    ]);
                });
            }

            keyboard.inline_keyboard.push([
                { text: "🔙 Voltar", callback_data: `upsell_access_${tipo}_${produtoNumero}` }
            ]);

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('❌ Erro no showProductAccessUsers:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar lista de usuários.");
        }
    }

    // 🔄 TOGGLE ACESSO - NOVO
    async toggleAccess(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];
            
            produto.hasAccess = !produto.hasAccess;
            
            // Se está ativando acesso sem tipo definido, define como grupo por padrão
            if (produto.hasAccess && !produto.accessType) {
                produto.accessType = 'group';
            }
            
            this.upsellManager.saveUpsellConfig(config);
            await this.bot.sendMessage(chatId, 
                `✅ Acesso ${produto.hasAccess ? 'ATIVADO' : 'DESATIVADO'} para este produto!`
            );
            
            await this.showAccessEditor(chatId, tipo, produtoNumero);
        } catch (error) {
            console.error('❌ Erro no toggleAccess:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao alterar status do acesso.");
        }
    }

    // 🎯 DEFINIR TIPO DE ACESSO - NOVO
    async setAccessType(chatId, tipo, produtoNumero, accessType) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];
            
            produto.accessType = accessType;
            produto.hasAccess = true; // Ativar automaticamente ao definir tipo
            
            this.upsellManager.saveUpsellConfig(config);
            await this.bot.sendMessage(chatId, 
                `✅ Tipo de acesso definido como: ${accessType === 'group' ? '👥 Grupo' : '📢 Canal'}`
            );
            
            await this.showAccessEditor(chatId, tipo, produtoNumero);
        } catch (error) {
            console.error('❌ Erro no setAccessType:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao definir tipo de acesso.");
        }
    }

    // 🔗 INICIAR EDIÇÃO DE LINK - NOVO
    async startAccessLinkEdit(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];
            
            await this.bot.sendMessage(chatId, 
                `🔗 *CONFIGURAR LINK DE ACESSO*\n\n` +
                `Envie o link do ${produto.accessType === 'group' ? 'grupo' : 'canal'}:\n\n` +
                `💡 *Formato:* https://t.me/... ou @username\n` +
                `⚠️ *O bot precisa ser administrador no ${produto.accessType === 'group' ? 'grupo' : 'canal'}!*\n\n` +
                `*Link atual:* ${produto.accessLink || "Não configurado"}`,
                { parse_mode: 'Markdown' }
            );

            this.editingState = { 
                chatId, 
                type: 'access_link', 
                tipo: tipo,
                produtoNumero: produtoNumero
            };
        } catch (error) {
            console.error('❌ Erro no startAccessLinkEdit:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao iniciar edição do link.");
        }
    }

    // 📛 INICIAR EDIÇÃO DE NOME - NOVO
    async startAccessNameEdit(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const produto = tipo === 'carrinho' ? 
                config.carrinho[`produto${produtoNumero}`] : 
                config.posCompra[`produto${produtoNumero}`];
            
            await this.bot.sendMessage(chatId, 
                `📛 *CONFIGURAR NOME DO ACESSO*\n\n` +
                `Digite o nome que aparecerá para o usuário:\n\n` +
                `*Nome atual:* "${produto.accessName || "Não definido"}"\n\n` +
                `💡 *Exemplo:* "Grupo VIP Extra", "Canal Premium", "Mentoria Exclusiva"`,
                { parse_mode: 'Markdown' }
            );

            this.editingState = { 
                chatId, 
                type: 'access_name', 
                tipo: tipo,
                produtoNumero: produtoNumero
            };
        } catch (error) {
            console.error('❌ Erro no startAccessNameEdit:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao iniciar edição do nome.");
        }
    }

    // 🗑️ REVOGAR ACESSO DE USUÁRIO - NOVO
    async revokeUserAccess(chatId, tipo, produtoNumero, userId) {
        try {
            const result = await this.upsellManager.revokeUpsellAccess(userId, produtoNumero, tipo);
            
            if (result.success) {
                await this.bot.sendMessage(chatId, `✅ Acesso revogado do usuário ${userId}`);
            } else {
                await this.bot.sendMessage(chatId, `❌ Erro ao revogar acesso: ${result.error}`);
            }
            
            // Volta para a lista de usuários
            await this.showProductAccessUsers(chatId, tipo, produtoNumero);
        } catch (error) {
            console.error('❌ Erro no revokeUserAccess:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao revogar acesso do usuário.");
        }
    }

    // 🗑️ REVOGAR TODOS OS ACESSOS - NOVO
    async revokeAllAccess(chatId, tipo, produtoNumero) {
        try {
            const accessUsers = this.upsellManager.getProductUpsellAccesses(tipo, produtoNumero);
            const activeUsers = accessUsers.filter(access => access.active);
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const access of activeUsers) {
                const result = await this.upsellManager.revokeUpsellAccess(access.userId, produtoNumero, tipo);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }
            
            await this.bot.sendMessage(chatId, 
                `🗑️ *Revogação em Lote Concluída*\n\n` +
                `✅ Sucessos: ${successCount} usuários\n` +
                `❌ Erros: ${errorCount} usuários`,
                { parse_mode: 'Markdown' }
            );
            
            await this.showProductAccessUsers(chatId, tipo, produtoNumero);
        } catch (error) {
            console.error('❌ Erro no revokeAllAccess:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao revogar acessos em lote.");
        }
    }

    // 📊 RESUMO - ATUALIZADO COM INFO DE ACESSO
    async showResumo(chatId) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            const accessReport = this.upsellManager.getAccessReport();
            
            let message = `📊 *RESUMO DO UPSELL*\n\n`;
            message += `📊 Status Geral: ${config.isActive ? "✅ ATIVO" : "❌ INATIVO"}\n`;
            message += `👥 Acessos Totais: ${accessReport.total} (${accessReport.active} ativos)\n\n`;
            
            message += `🛒 *UPSELL NO CARRINHO:*\n`;
            for (let i = 1; i <= 3; i++) {
                const prod = config.carrinho[`produto${i}`];
                if (prod) {
                    const access = prod.hasAccess ? "🔐" : "🔓";
                    message += `${i}. ${prod.isActive ? "✅" : "❌"}${access} R$ ${prod.price.toFixed(2)} - ${prod.message.substring(0, 30)}...\n`;
                } else {
                    message += `${i}. ❌🔓 NÃO CONFIGURADO\n`;
                }
            }
            
            message += `\n📅 *UPSELL PÓS-COMPRA:*\n`;
            for (let i = 1; i <= 3; i++) {
                const prod = config.posCompra[`produto${i}`];
                const dias = i === 1 ? '0' : i === 2 ? '3' : '7';
                if (prod) {
                    const access = prod.hasAccess ? "🔐" : "🔓";
                    message += `${i}. ${prod.isActive ? "✅" : "❌"}${access} Dia ${dias} - R$ ${prod.price.toFixed(2)} - ${prod.message.substring(0, 30)}...\n`;
                } else {
                    message += `${i}. ❌🔓 Dia ${dias} - NÃO CONFIGURADO\n`;
                }
            }

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔄 Atualizar", callback_data: "upsell_resumo" }],
                        [{ text: "👥 Gerenciar Acessos", callback_data: "upsell_manage_access" }],
                        [{ text: "🔙 Voltar", callback_data: "upsell_main" }]
                    ]
                }
            });
        } catch (error) {
            console.error('❌ Erro no showResumo:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao carregar resumo do upsell.");
        }
    }

    // 💾 SALVAR EDIÇÃO - ATUALIZADO PARA NOVOS CAMPOS
    async saveEdit(chatId, newValue) {
        if (!this.editingState) return;

        const config = this.upsellManager.getUpsellConfig();
        const { type, tipo, produtoNumero } = this.editingState;

        try {
            if (type === 'text') {
                if (tipo === 'carrinho') {
                    config.carrinho[`produto${produtoNumero}`].message = newValue;
                } else {
                    config.posCompra[`produto${produtoNumero}`].message = newValue;
                }
                await this.bot.sendMessage(chatId, "✅ Texto salvo!");
            } 
            else if (type === 'price') {
                const price = parseFloat(newValue.replace(',', '.'));
                if (isNaN(price)) throw new Error("Preço inválido");

                if (tipo === 'carrinho') {
                    config.carrinho[`produto${produtoNumero}`].price = price;
                } else {
                    config.posCompra[`produto${produtoNumero}`].price = price;
                }
                await this.bot.sendMessage(chatId, "✅ Preço salvo!");
            }
            else if (type === 'access_link') {
                // Validar formato do link
                if (!newValue.match(/^(https:\/\/t\.me\/|@)/)) {
                    throw new Error("Link inválido. Use https://t.me/... ou @username");
                }

                if (tipo === 'carrinho') {
                    config.carrinho[`produto${produtoNumero}`].accessLink = newValue;
                } else {
                    config.posCompra[`produto${produtoNumero}`].accessLink = newValue;
                }
                await this.bot.sendMessage(chatId, "✅ Link de acesso salvo!");
            }
            else if (type === 'access_name') {
                if (tipo === 'carrinho') {
                    config.carrinho[`produto${produtoNumero}`].accessName = newValue;
                } else {
                    config.posCompra[`produto${produtoNumero}`].accessName = newValue;
                }
                await this.bot.sendMessage(chatId, "✅ Nome de acesso salvo!");
            }

            this.upsellManager.saveUpsellConfig(config);

            // Volta para o editor correto
            if (type === 'access_link' || type === 'access_name') {
                await this.showAccessEditor(chatId, tipo, produtoNumero);
            } else if (tipo === 'carrinho') {
                await this.showEditorCarrinho(chatId, produtoNumero);
            } else {
                await this.showEditorPos(chatId, produtoNumero);
            }

        } catch (error) {
            await this.bot.sendMessage(chatId, `❌ Erro: ${error.message}`);
            // Em caso de erro, volta para o painel correto
            if (type === 'access_link' || type === 'access_name') {
                await this.showAccessEditor(chatId, tipo, produtoNumero);
            } else if (tipo === 'carrinho') {
                await this.showUpsellCarrinho(chatId);
            } else {
                await this.showUpsellPos(chatId);
            }
        }

        this.editingState = null;
    }

    // 📝 EDITOR DE TEXTO (mantido)
    async startTextEdit(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            let currentText = "";
            
            if (tipo === 'carrinho') {
                currentText = config.carrinho[`produto${produtoNumero}`].message;
            } else {
                currentText = config.posCompra[`produto${produtoNumero}`].message;
            }

            await this.bot.sendMessage(chatId, 
                `📝 *EDITANDO TEXTO - Produto ${produtoNumero}*\n\n` +
                `Digite o novo texto:\n\n` +
                `*Texto Atual:*\n"${currentText}"\n\n` +
                `💡 *Dicas:*\n` +
                `• Use emojis 🎉💎🔥\n` +
                `• Destaque benefícios\n` +
                `• Crie urgência!`,
                { parse_mode: 'Markdown' }
            );

            this.editingState = { 
                chatId, 
                type: 'text', 
                tipo: tipo,
                produtoNumero: produtoNumero
            };
        } catch (error) {
            console.error('❌ Erro no startTextEdit:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao iniciar edição de texto.");
        }
    }

    // 💰 EDITOR DE PREÇO (mantido)
    async startPriceEdit(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            let currentPrice = 0;
            
            if (tipo === 'carrinho') {
                currentPrice = config.carrinho[`produto${produtoNumero}`].price;
            } else {
                currentPrice = config.posCompra[`produto${produtoNumero}`].price;
            }

            await this.bot.sendMessage(chatId, 
                `💰 *EDITANDO PREÇO - Produto ${produtoNumero}*\n\n` +
                `Digite o novo preço:\n\n` +
                `*Preço Atual:* R$ ${currentPrice.toFixed(2)}\n\n` +
                `💡 *Exemplo:* 49.90, 79.90, 99.90`,
                { parse_mode: 'Markdown' }
            );

            this.editingState = { 
                chatId, 
                type: 'price', 
                tipo: tipo,
                produtoNumero: produtoNumero
            };
        } catch (error) {
            console.error('❌ Erro no startPriceEdit:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao iniciar edição de preço.");
        }
    }

    // 🔄 TOGGLE PRODUTO (mantido)
    async toggleProduto(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();

            if (tipo === 'carrinho') {
                config.carrinho[`produto${produtoNumero}`].isActive = !config.carrinho[`produto${produtoNumero}`].isActive;
            } else {
                config.posCompra[`produto${produtoNumero}`].isActive = !config.posCompra[`produto${produtoNumero}`].isActive;
            }

            this.upsellManager.saveUpsellConfig(config);
            await this.bot.sendMessage(chatId, "✅ Status alterado!");

            // Volta para o editor
            if (tipo === 'carrinho') {
                await this.showEditorCarrinho(chatId, produtoNumero);
            } else {
                await this.showEditorPos(chatId, produtoNumero);
            }
        } catch (error) {
            console.error('❌ Erro no toggleProduto:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao alterar status do produto.");
        }
    }

    // 🔄 TOGGLE GERAL (mantido)
    async toggleUpsell(chatId) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            config.isActive = !config.isActive;
            
            this.upsellManager.saveUpsellConfig(config);
            
            // ✅ MENSAGEM TEMPORÁRIA SEM VOLTAR AUTOMATICAMENTE
            const statusMessage = await this.bot.sendMessage(chatId, 
                `✅ Upsell ${config.isActive ? 'ATIVADO' : 'DESATIVADO'} com sucesso!`
            );
            
            // ✅ APAGA A MENSAGEM DE STATUS APÓS 2 SEGUNDOS
            setTimeout(async () => {
                try {
                    await this.bot.deleteMessage(chatId, statusMessage.message_id);
                } catch (error) {
                    console.log('ℹ️ Não conseguiu apagar mensagem de status');
                }
            }, 2000);
            
        } catch (error) {
            console.error('❌ Erro no toggleUpsell:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao alterar status do upsell.");
        }
    }

    // 👁️ PREVIEW (mantido)
    async showPreview(chatId, tipo, produtoNumero) {
        try {
            const config = this.upsellManager.getUpsellConfig();
            let produto, titulo;

            if (tipo === 'carrinho') {
                produto = config.carrinho[`produto${produtoNumero}`];
                titulo = "🛒 UPSELL NO CARRINHO";
            } else {
                produto = config.posCompra[`produto${produtoNumero}`];
                titulo = "📅 UPSELL PÓS-COMPRA";
            }

            if (!produto) {
                await this.bot.sendMessage(chatId, "❌ Produto não encontrado para preview.");
                return;
            }

            const keyboard = {
                inline_keyboard: [
                    [
                        { 
                            text: `✅ SIM, QUERO - R$ ${produto.price.toFixed(2)}`, 
                            callback_data: `upsell_accept_${tipo}_${produtoNumero}`
                        }
                    ],
                    [
                        { 
                            text: '❌ NÃO, OBRIGADO', 
                            callback_data: `upsell_decline_${tipo}_${produtoNumero}`
                        }
                    ]
                ]
            };

            await this.bot.sendMessage(chatId, 
                `👁️ *PREVIEW - ${titulo}*\n\n` +
                `${produto.message}\n\n` +
                `💰 *Valor: R$ ${produto.price.toFixed(2)}*`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                }
            );

            // Volta para o editor
            if (tipo === 'carrinho') {
                await this.showEditorCarrinho(chatId, produtoNumero);
            } else {
                await this.showEditorPos(chatId, produtoNumero);
            }
        } catch (error) {
            console.error('❌ Erro no showPreview:', error);
            await this.bot.sendMessage(chatId, "❌ Erro ao gerar preview.");
        }
    }

    // 🎯 REGISTRAR HANDLERS - ATUALIZADO COM NOVOS HANDLERS DE ACESSO
    registerHandlers() {
        this.bot.on('callback_query', async (cbq) => {
            if (!cbq.data.startsWith('upsell_')) return;

            const chatId = cbq.message.chat.id;
            const data = cbq.data;

            console.log(`📲 Callback recebido: ${data}`);

            try {
                await this.bot.deleteMessage(chatId, cbq.message.message_id);
            } catch (error) {
                console.log('ℹ️ Não conseguiu apagar mensagem, continuando...');
            }

            await this.bot.answerCallbackQuery(cbq.id);

            try {
                // ✅ ROTEAMENTO CORRETO - COM NOVOS HANDLERS DE ACESSO
                switch (data) {
                    case 'upsell_main':
                        await this.showUpsellPanel(chatId);
                        break;
                    
                    case 'upsell_manage_access':
                        await this.showAccessManagementPanel(chatId);
                        break;
                    
                    // MENUS PRINCIPAIS
                    case 'upsell_menu_carrinho':
                        await this.showUpsellCarrinho(chatId);
                        break;
                    case 'upsell_menu_pos':
                        await this.showUpsellPos(chatId);
                        break;
                    case 'upsell_toggle':
                        await this.toggleUpsell(chatId);
                        break;
                    case 'upsell_resumo':
                        await this.showResumo(chatId);
                        break;
                    
                    // EDITORES - CARRINHO
                    case 'upsell_edit_carrinho_1':
                        await this.showEditorCarrinho(chatId, '1');
                        break;
                    case 'upsell_edit_carrinho_2':
                        await this.showEditorCarrinho(chatId, '2');
                        break;
                    case 'upsell_edit_carrinho_3':
                        await this.showEditorCarrinho(chatId, '3');
                        break;
                    
                    // EDITORES - PÓS-COMPRA
                    case 'upsell_edit_pos_1':
                        await this.showEditorPos(chatId, '1');
                        break;
                    case 'upsell_edit_pos_2':
                        await this.showEditorPos(chatId, '2');
                        break;
                    case 'upsell_edit_pos_3':
                        await this.showEditorPos(chatId, '3');
                        break;
                    
                    // ACESSO - CARRINHO
                    case 'upsell_access_carrinho_1':
                        await this.showAccessEditor(chatId, 'carrinho', '1');
                        break;
                    case 'upsell_access_carrinho_2':
                        await this.showAccessEditor(chatId, 'carrinho', '2');
                        break;
                    case 'upsell_access_carrinho_3':
                        await this.showAccessEditor(chatId, 'carrinho', '3');
                        break;
                    
                    // ACESSO - PÓS-COMPRA
                    case 'upsell_access_pos_1':
                        await this.showAccessEditor(chatId, 'pos', '1');
                        break;
                    case 'upsell_access_pos_2':
                        await this.showAccessEditor(chatId, 'pos', '2');
                        break;
                    case 'upsell_access_pos_3':
                        await this.showAccessEditor(chatId, 'pos', '3');
                        break;
                    
                    // TOGGLE ACESSO
                    case data.match(/upsell_toggle_access_(carrinho|pos)_\d/)?.input:
                        {
                            const parts = data.split('_');
                            const toggleTipo = parts[3];
                            const toggleProduto = parts[4];
                            await this.toggleAccess(chatId, toggleTipo, toggleProduto);
                        }
                        break;
                    
                    // DEFINIR TIPO DE ACESSO
                    case data.match(/upsell_set_accesstype_(carrinho|pos)_\d_(group|channel)/)?.input:
                        {
                            const parts = data.split('_');
                            const typeTipo = parts[3];
                            const typeProduto = parts[4];
                            const accessType = parts[5];
                            await this.setAccessType(chatId, typeTipo, typeProduto, accessType);
                        }
                        break;
                    
                    // CONFIGURAR LINK DE ACESSO
                    case data.match(/upsell_set_accesslink_(carrinho|pos)_\d/)?.input:
                        {
                            const parts = data.split('_');
                            const linkTipo = parts[3];
                            const linkProduto = parts[4];
                            await this.startAccessLinkEdit(chatId, linkTipo, linkProduto);
                        }
                        break;
                    
                    // CONFIGURAR NOME DE ACESSO
                    case data.match(/upsell_set_accessname_(carrinho|pos)_\d/)?.input:
                        {
                            const parts = data.split('_');
                            const nameTipo = parts[3];
                            const nameProduto = parts[4];
                            await this.startAccessNameEdit(chatId, nameTipo, nameProduto);
                        }
                        break;
                    
                    // VISUALIZAR USUÁRIOS COM ACESSO
                    case data.match(/upsell_view_access_(carrinho|pos)_\d/)?.input:
                        {
                            const parts = data.split('_');
                            const viewTipo = parts[3];
                            const viewProduto = parts[4];
                            await this.showProductAccessUsers(chatId, viewTipo, viewProduto);
                        }
                        break;
                    
                    // REVOGAR ACESSO INDIVIDUAL
                    case data.match(/upsell_revoke_user_(carrinho|pos)_\d_\d+/)?.input:
                        {
                            const parts = data.split('_');
                            const revokeTipo = parts[3];
                            const revokeProduto = parts[4];
                            const userId = parts[5];
                            await this.revokeUserAccess(chatId, revokeTipo, revokeProduto, userId);
                        }
                        break;
                    
                    // REVOGAR TODOS OS ACESSOS
                    case data.match(/upsell_revoke_all_(carrinho|pos)_\d/)?.input:
                        {
                            const parts = data.split('_');
                            const revokeAllTipo = parts[3];
                            const revokeAllProduto = parts[4];
                            await this.revokeAllAccess(chatId, revokeAllTipo, revokeAllProduto);
                        }
                        break;
                    
                    // AÇÕES DE TEXTO (mantidas)
                    case data.match(/upsell_text_carrinho_\d/)?.input:
                        {
                            const produtoCarrinho = data.split('_')[3];
                            await this.startTextEdit(chatId, 'carrinho', produtoCarrinho);
                        }
                        break;
                    case data.match(/upsell_text_pos_\d/)?.input:
                        {
                            const produtoPos = data.split('_')[3];
                            await this.startTextEdit(chatId, 'pos', produtoPos);
                        }
                        break;
                    
                    // AÇÕES DE PREÇO (mantidas)
                    case data.match(/upsell_price_carrinho_\d/)?.input:
                        {
                            const priceCarrinho = data.split('_')[3];
                            await this.startPriceEdit(chatId, 'carrinho', priceCarrinho);
                        }
                        break;
                    case data.match(/upsell_price_pos_\d/)?.input:
                        {
                            const pricePos = data.split('_')[3];
                            await this.startPriceEdit(chatId, 'pos', pricePos);
                        }
                        break;
                    
                    // TOGGLES (mantidas)
                    case data.match(/upsell_toggle_carrinho_\d/)?.input:
                        {
                            const toggleCarrinho = data.split('_')[3];
                            await this.toggleProduto(chatId, 'carrinho', toggleCarrinho);
                        }
                        break;
                    case data.match(/upsell_toggle_pos_\d/)?.input:
                        {
                            const togglePos = data.split('_')[3];
                            await this.toggleProduto(chatId, 'pos', togglePos);
                        }
                        break;
                    
                    // PREVIEWS (mantidas)
                    case data.match(/upsell_preview_carrinho_\d/)?.input:
                        {
                            const previewCarrinho = data.split('_')[3];
                            await this.showPreview(chatId, 'carrinho', previewCarrinho);
                        }
                        break;
                    case data.match(/upsell_preview_pos_\d/)?.input:
                        {
                            const previewPos = data.split('_')[3];
                            await this.showPreview(chatId, 'pos', previewPos);
                        }
                        break;
                    
                    default:
                        console.log('❌ Callback não reconhecido:', data);
                        await this.bot.sendMessage(chatId, "❌ Comando não reconhecido.");
                }
                
            } catch (error) {
                console.error('❌ Erro no handler do upsell:', error);
                await this.bot.sendMessage(chatId, "❌ Erro ao processar comando.");
            }
        });

        // Handler para mensagens de edição (mantido)
        this.bot.on('message', async (msg) => {
            if (this.editingState && this.editingState.chatId === msg.chat.id && msg.text) {
                try {
                    await this.saveEdit(msg.chat.id, msg.text);
                } catch (error) {
                    console.error('❌ Erro ao salvar edição:', error);
                    await this.bot.sendMessage(msg.chat.id, "❌ Erro ao salvar alterações.");
                }
            }
        });
    }

    // ... (outras helpers já implementadas acima)
}

module.exports = AdminUpsellHandlers;