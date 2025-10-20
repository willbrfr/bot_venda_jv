const db = require('../utils/database');
const config = require('../config');
const backupManager = require('../utils/backupManager');
const rateLimiter = require('../utils/rateLimiter');
const UpsellManager = require('../services/upsellManager');
const AdminUpsellHandlers = require('./adminUpsellHandlers');

const conversationState = {};

// ✅ CORREÇÃO: Função para garantir estrutura completa do funil (SIMPLIFICADA)
function ensureFunnelMessageStructure(settings) {
    if (!settings.salesFunnel || !settings.salesFunnel.messages) return;
    
    Object.values(settings.salesFunnel.messages).forEach(messageConfig => {
        if (!messageConfig.useIndividualDiscount) {
            messageConfig.useIndividualDiscount = false;
        }
        if (!messageConfig.individualDiscountPercentage) {
            messageConfig.individualDiscountPercentage = 10;
        }
        if (!messageConfig.individualDiscountValue) {
            messageConfig.individualDiscountValue = 0;
        }
        if (!messageConfig.individualUsePercentage) {
            messageConfig.individualUsePercentage = true;
        }
        // garantir objetos media/audio para evitar accesos indefinidos
        if (!messageConfig.media) messageConfig.media = { fileId: null, type: null };
        if (!messageConfig.audio) messageConfig.audio = { fileId: null, isActive: false };
        if (typeof messageConfig.isActive === 'undefined') messageConfig.isActive = false;
    });
}

async function sendAdminPanel(bot, chatId) {
    const imageUrl = 'https://ibb.co/kgXbY0G8';
    const keyboard = {
        inline_keyboard: [
            [{ text: "📦 Gerenciar Planos", callback_data: "admin_manage_plans" }],
            [{ text: "👥 Gerenciar Assinantes", callback_data: "admin_manage_subs" }],
            [{ text: "🎯 Funil de Vendas", callback_data: "admin_sales_funnel" }],
            [{ text: "🚀 Upsell Automático", callback_data: "admin_upsell" }],
            [{ text: "📢 Enviar Transmissão", callback_data: "admin_broadcast" }],
            [{ text: "⚙️ Configurações", callback_data: "admin_settings" }],
            [{ text: "📊 Estatísticas", callback_data: "admin_stats" }],
            [{ text: "🛡️ Segurança", callback_data: "admin_security" }],
            [{ text: "❤️ Quero um bot personalizado", url: "https://t.me/Sex_model_adm" }]
        ]
    };
    
    try {
        await bot.sendPhoto(chatId, imageUrl, {
            reply_markup: keyboard
        });
    } catch (error) {
        await bot.sendMessage(chatId, "👑 *Painel de Administração*\n\nSelecione uma opção:", {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
}

// ✅ NOVO PAINEL DE SEGURANÇA
async function sendSecurityPanel(bot, chatId) {
    const stats = {
        totalTracked: Array.from(rateLimiter.users.keys()).length,
        recentBlocks: 0
    };

    const message = `🛡️ *Painel de Segurança e Rate Limiting*\n\n` +
                   `📊 *Estatísticas:*\n` +
                   `• Usuários monitorados: ${stats.totalTracked}\n` +
                   `• Bloqueios recentes: ${stats.recentBlocks}\n\n` +
                   `⚙️ *Configurações ativas:*\n` +
                   `• Comandos: 5/min por usuário\n` +
                   `• Pagamentos: 3/5min por usuário\n` +
                   `• Callbacks: 15/min por usuário`;

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔄 Resetar Todos os Limites", callback_data: "admin_reset_all_limits" }],
                [{ text: "📊 Ver Estatísticas Detalhadas", callback_data: "admin_rate_limit_stats" }],
                [{ text: "🔙 Voltar", callback_data: "admin_panel" }]
            ]
        }
    });
}

async function sendSettingsPanel(bot, chatId) {
    await bot.sendMessage(chatId, "⚙️ *Configurações Gerais*\n\nSelecione o que deseja alterar.", {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "💳 Configurar Pagamentos", callback_data: "admin_config_payment" }],
                [{ text: "💬 Alterar Mensagem de Boas-vindas", callback_data: "admin_set_welcome" }],
                [{ text: "🖼️ Gerenciar Mídia de Boas-vindas", callback_data: "admin_config_welcome_media" }],
                [{ text: "🎵 Gerenciar Áudio de Boas-vindas", callback_data: "admin_config_welcome_audio" }],
                [{ text: "📞 Alterar Link de Suporte", callback_data: "admin_set_support" }],
                [{ text: "📢 Gerenciar Canal de Prévias", callback_data: "admin_config_previews" }],
                [{ text: "💾 Gerenciar Backups", callback_data: "admin_manage_backups" }],
                [{ text: "🛡️ Painel de Segurança", callback_data: "admin_security" }],
                [{ text: "🔙 Voltar ao Painel", callback_data: "admin_panel" }]
            ]
        }
    });
}

async function sendBackupsPanel(bot, chatId) {
    const backupInfo = backupManager.getBackupsForAdmin();
    
    await bot.sendMessage(chatId, backupInfo.message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: backupInfo.keyboard
        }
    });
}

async function sendSalesFunnelPanel(bot, chatId) {
    const settings = db.getSettings();
    const funnelSettings = settings.salesFunnel;
    
    const status = funnelSettings.isActive ? "✅ Ativado" : "❌ Desativado";
    const activeMessagesCount = Object.values(funnelSettings.messages).filter(msg => msg.isActive).length;
    
    const message = `🎯 *Funil de Vendas Automático*\n\n` +
                   `*Status do Funil:* ${status}\n` +
                   `*Mensagens Ativas:* ${activeMessagesCount}/5\n\n` +
                   `Configure cada mensagem individualmente abaixo:`;

    const keyboard = {
        inline_keyboard: [
            [{ text: funnelSettings.isActive ? "❌ Desativar Funil" : "✅ Ativar Funil", callback_data: "admin_toggle_funnel" }],
            [{ text: "📝 Gerenciar Mensagens Individuais", callback_data: "admin_manage_funnel_messages" }],
            [{ text: "📊 Estatísticas do Funil", callback_data: "admin_funnel_stats" }],
            [{ text: "🔙 Voltar ao Painel", callback_data: "admin_panel" }]
        ]
    };

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function sendFunnelMessagesPanel(bot, chatId) {
    const settings = db.getSettings();
    const messages = settings.salesFunnel.messages;

    let message = `📝 *Gerenciar Mensagens do Funil*\n\n` +
                 `Configure cada mensagem do seu funil de vendas:\n\n`;

    Object.entries(messages).forEach(([key, msg]) => {
        const times = ["5 minutos", "30 minutos", "1 hora", "3 horas", "12 horas"];
        const index = parseInt(key.replace('message', '')) - 1;
        const status = msg.isActive ? "✅" : "❌";
        const discountStatus = msg.useIndividualDiscount ? "💰" : "🔘";
        message += `${status}${discountStatus} *Mensagem ${index + 1}* (${times[index]})\n`;
    });

    const keyboard = {
        inline_keyboard: [
            ...Object.keys(messages).map((key) => {
                const index = parseInt(key.replace('message', '')) - 1;
                return [
                    { text: `✏️ Mensagem ${index + 1}`, callback_data: `admin_edit_funnel_msg_${key}` }
                ];
            }),
            [{ text: "🔙 Voltar ao Funil", callback_data: "admin_sales_funnel" }]
        ]
    };

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function sendFunnelMessageEditor(bot, chatId, messageKey) {
    const settings = db.getSettings();
    const messageConfig = settings.salesFunnel.messages[messageKey];
    const times = { message1: "5 min", message2: "30 min", message3: "1h", message4: "3h", message5: "12h" };

    const status = messageConfig.isActive ? "✅ Ativada" : "❌ Desativada";
    const hasMedia = messageConfig.media.fileId ? "✅" : "❌";
    const hasAudio = messageConfig.audio.fileId ? "✅" : "❌";
    const individualDiscountStatus = messageConfig.useIndividualDiscount ? "✅" : "❌";

    const message = `✏️ *Editando Mensagem do Funil (${times[messageKey]})*\n\n` +
                   `*Status:* ${status}\n` +
                   `*Mídia:* ${hasMedia} Configurada\n` +
                   `*Áudio:* ${hasAudio} Configurado\n` +
                   `*Desconto Individual:* ${individualDiscountStatus} Configurado\n\n` +
                   `*Texto Atual:*\n${messageConfig.text || "Nenhum texto definido"}`;

    const keyboard = {
        inline_keyboard: [
            [{ text: messageConfig.isActive ? "❌ Desativar" : "✅ Ativar", callback_data: `admin_toggle_funnel_msg_${messageKey}` }],
            [{ text: "📝 Editar Texto", callback_data: `admin_edit_funnel_text_${messageKey}` }],
            [{ text: "💰 Desconto Individual", callback_data: `admin_individual_discount_${messageKey}` }],
            [{ text: "🖼️ Configurar Mídia", callback_data: `admin_set_funnel_media_${messageKey}` }],
            [{ text: "🎵 Configurar Áudio", callback_data: `admin_set_funnel_audio_${messageKey}` }],
            [{ text: "🗑️ Remover Mídia/Áudio", callback_data: `admin_remove_funnel_media_${messageKey}` }],
            [{ text: "🔙 Voltar às Mensagens", callback_data: "admin_manage_funnel_messages" }]
        ]
    };

    if (messageConfig.media.fileId && messageConfig.media.type) {
        try {
            const options = {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            };

            switch (messageConfig.media.type) {
                case 'photo':
                    await bot.sendPhoto(chatId, messageConfig.media.fileId, options);
                    break;
                case 'animation':
                    await bot.sendAnimation(chatId, messageConfig.media.fileId, options);
                    break;
                case 'video':
                    await bot.sendVideo(chatId, messageConfig.media.fileId, options);
                    break;
                default:
                    await bot.sendMessage(chatId, message, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
            }
        } catch (error) {
            console.error("Erro ao enviar preview da mídia do funil:", error.message);
        }
    }

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function sendFunnelDiscountPanel(bot, chatId, messageKey) {
    const settings = db.getSettings();
    const messageConfig = settings.salesFunnel.messages[messageKey];
    const times = { message1: "5 min", message2: "30 min", message3: "1h", message4: "3h", message5: "12h" };

    if (!messageConfig.useIndividualDiscount) {
        messageConfig.useIndividualDiscount = false;
    }
    if (!messageConfig.individualDiscountPercentage) {
        messageConfig.individualDiscountPercentage = 10;
    }
    if (!messageConfig.individualDiscountValue) {
        messageConfig.individualDiscountValue = 0;
    }
    if (!messageConfig.individualUsePercentage) {
        messageConfig.individualUsePercentage = true;
    }

    const status = messageConfig.useIndividualDiscount ? "✅ Ativado" : "❌ Ativado";
    const discountType = messageConfig.individualUsePercentage ? 
        `📊 ${messageConfig.individualDiscountPercentage}% de desconto` : 
        `💰 R$ ${messageConfig.individualDiscountValue.toFixed(2)} de desconto`;

    const message = `💰 *Configurar Desconto Individual - ${times[messageKey]}*\n\n` +
                   `*Status do Desconto Individual:* ${status}\n` +
                   `*Tipo de Desconto:* ${discountType}\n\n` +
                   `Aqui você pode definir um desconto específico para esta mensagem do funil.`;

    const keyboard = {
        inline_keyboard: [
            [{ text: messageConfig.useIndividualDiscount ? "❌ Desativar Desconto Individual" : "✅ Ativar Desconto Individual", callback_data: `admin_toggle_individual_discount_${messageKey}` }],
            [{ text: "📊 Configurar Porcentagem", callback_data: `admin_set_individual_percentage_${messageKey}` }],
            [{ text: "💰 Configurar Valor Fixo", callback_data: `admin_set_individual_value_${messageKey}` }],
            [{ text: "🔄 Alternar Tipo", callback_data: `admin_toggle_individual_type_${messageKey}` }],
            [{ text: "🔙 Voltar à Mensagem", callback_data: `admin_edit_funnel_msg_${messageKey}` }]
        ]
    };

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function sendPreviewsChannelPanel(bot, chatId) {
    const settings = db.getSettings();
    const previews = settings.previewsChannel || { isActive: false, link: null, buttonText: "Ver Prévias" };
    
    const status = previews.isActive ? "✅ Ativado" : "❌ Desativado";
    const toggleText = previews.isActive ? "❌ Desativar Canal" : "✅ Ativar Canal";
    const link = previews.link || "Não definido";
    const buttonText = previews.buttonText;

    const message = `📢 *Gerenciar Canal de Prévias*\n\n` +
                      `*Status:* ${status}\n` +
                      `*Link do Canal:* \`${link}\`\n` +
                      `*Texto do Botão:* "${buttonText}"\n\n` +
                      `Configure o canal onde os usuários podem ver prévias do seu conteúdo.`;

    const keyboard = {
        inline_keyboard: [
            [{ text: toggleText, callback_data: "admin_toggle_previews" }],
            [{ text: "✏️ Alterar Link do Canal", callback_data: "admin_set_previews_link" }],
            [{ text: "📝 Alterar Texto do Botão", callback_data: "admin_set_previews_text" }],
            [{ text: "🔙 Voltar às Configurações", callback_data: "admin_settings" }]
        ]
    };

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true
    });
}

async function sendWelcomeMediaPanel(bot, chatId) {
    const settings = db.getSettings();
    const mediaSettings = settings.welcomeMedia || { isActive: false, fileId: null, type: null };
    
    const status = mediaSettings.isActive ? "✅ Ativada" : "❌ Desativada";
    const toggleText = mediaSettings.isActive ? "❌ Desativar Mídia" : "✅ Ativar Mídia";
    const mediaType = mediaSettings.type === 'animation' ? 'GIF' : (mediaSettings.type || 'Nenhuma');

    let message = `🖼️ *Gerenciar Mídia de Boas-vindas*\n\n*Status Atual:* ${status}\n*Tipo de Mídia:* ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}\n\nUse os botões abaixo para definir uma mídia (imagem, GIF ou vídeo), ativá-la ou desativá-la.`;

    const keyboard = {
        inline_keyboard: [
            [{ text: toggleText, callback_data: "admin_toggle_welcome_media" }],
            [{ text: "✏️ Definir/Alterar Mídia", callback_data: "admin_set_welcome_media" }],
            [{ text: "🗑️ Remover Mídia", callback_data: "admin_remove_welcome_media" }],
            [{ text: "🔙 Voltar às Configurações", callback_data: "admin_settings" }]
        ]
    };
    
    if (mediaSettings.fileId && mediaSettings.type) {
        try {
            const options = { 
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            };
            switch (mediaSettings.type) {
                case 'photo':
                    await bot.sendPhoto(chatId, mediaSettings.fileId, options);
                    break;
                case 'animation':
                    await bot.sendAnimation(chatId, mediaSettings.fileId, options);
                    break;
                case 'video':
                    await bot.sendVideo(chatId, mediaSettings.fileId, options);
                    break;
                default:
                    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
            }
        } catch (error) {
            console.error("Erro ao enviar preview da mídia: ", error.message);
            await bot.sendMessage(chatId, message + "\n\n⚠️ *A mídia salva não pôde ser exibida. Envie uma nova.*", {
                parse_mode: 'Markdown', reply_markup: keyboard
            });
        }
    } else {
        await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown', reply_markup: keyboard 
        });
    }
}

async function sendWelcomeAudioPanel(bot, chatId) {
    const settings = db.getSettings();
    const audioSettings = settings.welcomeMedia?.audio || { isActive: false, fileId: null };
    
    const status = audioSettings.isActive ? "✅ Ativado" : "❌ Desativado";
    const toggleText = audioSettings.isActive ? "❌ Desativar Áudio" : "✅ Ativar Áudio";
    const hasAudio = audioSettings.fileId ? "✅ Configurado" : "❌ Não configurado";

    const message = `🎵 *Gerenciar Áudio de Boas-Vindas*\n\n*Status:* ${status}\n*Áudio:* ${hasAudio}\n\n🎤 *Como configurar:*\n• Grave um áudio usando o microfone do Telegram\n• Ou envie um arquivo de áudio (MP3, OGG, etc)\n\nO áudio será reproduzido antes da mensagem de boas-vindas.`;

    const keyboard = {
        inline_keyboard: [
            [{ text: toggleText, callback_data: "admin_toggle_welcome_audio" }],
            [{ text: "🎤 Definir/Alterar Áudio", callback_data: "admin_set_welcome_audio" }],
            [{ text: "🗑️ Remover Áudio", callback_data: "admin_remove_welcome_audio" }],
            [{ text: "🔙 Voltar às Configurações", callback_data: "admin_settings" }]
        ]
    };

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function sendPaymentGatewaySelectionPanel(bot, chatId) {
    const settings = db.getSettings();
    const mpStatus = settings.payment.mercadoPago?.isActive ? "🟢 Ativo" : "🔴 Inativo";
    const ppStatus = settings.payment.pushinpay?.isActive ? "🟢 Ativo" : "🔴 Inativo";
    const tpStatus = settings.payment.triboPay?.isActive ? "🟢 Ativo" : "🔴 Inativo";
    const pepperStatus = settings.payment.pepper?.isActive ? "🟢 Ativo" : "🔴 Inativo";

    await bot.sendMessage(chatId, "💳 *Gateways de Pagamento*\n\nSelecione qual gateway de pagamento você deseja configurar.", {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: `Mercado Pago (${mpStatus})`, callback_data: "admin_config_mp" }],
                [{ text: `Pushinpay (${ppStatus})`, callback_data: "admin_config_pp" }],
                [{ text: `TriboPay (${tpStatus})`, callback_data: "admin_config_tp" }],
                [{ text: `🌶️ Pepper (${pepperStatus})`, callback_data: "admin_config_pepper" }],
                [{ text: "🔙 Voltar para Configurações", callback_data: "admin_settings" }]
            ]
        }
    });
}

async function sendMercadoPagoSettingsPanel(bot, chatId) {
    const settings = db.getSettings();
    const mpSettings = settings.payment.mercadoPago;
    const tokenStatus = mpSettings?.accessToken ? "✅ Configurado" : "❌ Não Configurado";
    const status = mpSettings?.isActive ? "🟢 Ativo" : "🔴 Inativo";
    const toggleButtonText = mpSettings?.isActive ? "🔴 Desativar Pagamentos" : "🟢 Ativar Pagamentos";

    const text = `💳 *Configurações de Pagamento (Mercado Pago)*\n\n*Access Token:* ${tokenStatus}\n*Status dos pagamentos:* ${status}`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "🔑 Alterar Access Token", callback_data: "admin_set_mp_token" }],
            [{ text: toggleButtonText, callback_data: "admin_toggle_mp_status" }],
            [{ text: "🔙 Voltar", callback_data: "admin_config_payment" }]
        ]
    };
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function sendPushinpaySettingsPanel(bot, chatId) {
    const settings = db.getSettings();
    const ppSettings = settings.payment.pushinpay;
    const tokenStatus = ppSettings?.apiToken ? "✅ Configurado" : "❌ Não Configurado";
    const status = ppSettings?.isActive ? "🟢 Ativo" : "🔴 Inativo";
    const toggleButtonText = ppSettings?.isActive ? "🔴 Desativar Pagamentos" : "🟢 Ativar Pagamentos";

    const text = `💳 *Configurações de Pagamento (Pushinpay)*\n\n*API Token:* ${tokenStatus}\n*Status dos pagamentos:* ${status}`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "🔑 Alterar API Token", callback_data: "admin_set_pp_token" }],
            [{ text: toggleButtonText, callback_data: "admin_toggle_pp_status" }],
            [{ text: "🔙 Voltar", callback_data: "admin_config_payment" }]
        ]
    };
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function sendTriboPaySettingsPanel(bot, chatId) {
    const settings = db.getSettings();
    const tpSettings = settings.payment.triboPay || { apiToken: null, isActive: false };
    const tokenStatus = tpSettings?.apiToken ? "✅ Configurado" : "❌ Não Configurado";
    const status = tpSettings?.isActive ? "🟢 Ativo" : "🔴 Inativo";
    const toggleButtonText = tpSettings?.isActive ? "🔴 Desativar Pagamentos" : "🟢 Ativar Pagamentos";

    const text = `💳 *Configurações de Pagamento (TriboPay)*\n\n*Token de Integração API:* ${tokenStatus}\n*Status dos pagamentos:* ${status}`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "🔑 Alterar Token de Integração", callback_data: "admin_set_tp_token" }],
            [{ text: toggleButtonText, callback_data: "admin_toggle_tp_status" }],
            [{ text: "🔙 Voltar", callback_data: "admin_config_payment" }]
        ]
    };
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function sendPepperSettingsPanel(bot, chatId) {
    const settings = db.getSettings();
    const pepperSettings = settings.payment.pepper || { accessToken: null, isActive: false };
    const tokenStatus = pepperSettings?.accessToken ? "✅ Configurado" : "❌ Não Configurado";
    const status = pepperSettings?.isActive ? "🟢 Ativo" : "🔴 Inativo";
    const toggleButtonText = pepperSettings?.isActive ? "🔴 Desativar Pagamentos" : "🟢 Ativar Pagamentos";

    const text = `🌶️ *Configurações de Pagamento (Pepper)*\n\n*Access Token:* ${tokenStatus}\n*Status dos pagamentos:* ${status}`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "🔑 Alterar Access Token", callback_data: "admin_set_pepper_token" }],
            [{ text: toggleButtonText, callback_data: "admin_toggle_pepper_status" }],
            [{ text: "🔙 Voltar para Configurações", callback_data: "admin_config_payment" }]
        ]
    };
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function registerAdminHandlers(bot) {
    const adminId = config.adminUserId;
    
    // Garantir estrutura do funil
    const settings = db.getSettings();
    ensureFunnelMessageStructure(settings);
    db.updateSettings(settings);

    // INTEGRAÇÃO DO UPSELL: criar instância e registrar handlers
    const upsellManager = new UpsellManager(bot);
    const adminUpsellHandlers = new AdminUpsellHandlers(bot, upsellManager);
    adminUpsellHandlers.registerHandlers();

    // ------------- NOVO: Captura de callbacks de UPSell para usuários (aceitar/recusar) -------------
    // Esses callbacks geralmente são disparados por usuários (não admins). Tratamos antes do handler admin-only.
    bot.on('callback_query', async (cbq) => {
        const data = cbq.data || '';
        if (!data.startsWith('upsell_accept') && !data.startsWith('upsell_decline')) return;

        try {
            await bot.answerCallbackQuery(cbq.id, { text: 'Ação processada!' });

            // Tentar informar o upsellManager se ele implementar um handler para escolhas dos usuários
            // Possíveis formatos de callback: "upsell_accept_<tipo>_<produtoNumero>" ou "upsell_decline_<tipo>_<produtoNumero>"
            const parts = data.split('_');
            const userAction = parts[1]; // 'accept' ou 'decline'
            const upsellId = parts[2];

            if (upsellManager && typeof upsellManager.handleUserResponse === 'function') {
                try {
                    await upsellManager.handleUserResponse(cbq.from.id, userAction, upsellId);
                } catch (e) {
                    console.error("Erro ao processar resposta do usuário no upsellManager:", e.message);
                }
            } else if (upsellManager && typeof upsellManager.processUserChoice === 'function') {
                // nome alternativo de método (compatibilidade)
                try {
                    await upsellManager.processUserChoice(cbq.from.id, userAction, upsellId);
                } catch (e) {
                    console.error("Erro ao processar resposta do usuário (processUserChoice):", e.message);
                }
            }
        } catch (error) {
            console.error("Erro ao responder callback de upsell:", error.message);
        }
    });
    // ------------- FIM: Handler de callbacks de upsell para usuários -------------

    bot.onText(/\/admin/, async (msg) => {
        if (msg.from.id !== adminId) return;
        await sendAdminPanel(bot, adminId);
    });

    bot.on('callback_query', async (cbq) => {
        const msg = cbq.message;
        if (!msg || msg.chat.id !== adminId) return;

        const data = cbq.data || '';
        const [context, action, ...params] = data.split('_');
        if (context !== 'admin') return;

        try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error) {}

        await bot.answerCallbackQuery(cbq.id);

        // handlers/adminHandlers.js - ADICIONE ESTA SEÇÃO
        // Dentro do bot.on('callback_query', async (cbq) =>:
        // Procure a seção onde estão os callbacks do admin_upsell e ADICIONE:
        if (data.startsWith('admin_upsell_select_product_')) {
            const productId = data.split('_')[4];
            await adminUpsellHandlers.selectProductForUpsell(adminId, productId);
            return;
        } else if (data.startsWith('admin_upsell_post_days_')) {
            const upsellId = data.split('_')[4];
            conversationState[adminId] = { 
                type: 'set_post_upsell_days', 
                upsellId: upsellId,
                returnTo: `admin_upsell_post_edit_${upsellId}`
            };
            await bot.sendMessage(adminId, 
                "📅 Digite o novo número de dias após a compra:\n\n" +
                "💡 Exemplo: 0 (mesmo dia), 3, 7, 30..."
            );
            return;
        } else if (data.startsWith('admin_upsell_post_type_')) {
            const upsellId = data.split('_')[4];
            await adminUpsellHandlers.toggleUpsellType(adminId, upsellId);
            return;
        } else if (data === 'admin_upsell_pre_preview') {
            await adminUpsellHandlers.showPrePurchasePreview(adminId);
            return;
        }
        // FIM DA SEÇÃO ADICIONADA

        // ================== ADICIONADOS HANDLERS DE BACKUP (por índice/criação) ==================
        // Substitui os antigos handlers por timestamp: agora suportamos restaurar por índice e criar backup via callback
        if (data.startsWith('backup_restore_')) {
            const backupIndex = parseInt(data.split('_')[2], 10);
            const restoreResult = backupManager.restoreBackupByIndex(backupIndex);
            
            if (restoreResult.success) {
                await bot.sendMessage(adminId, 
                    "✅ *Backup restaurado com sucesso!*\n\n" +
                    "O sistema foi restaurado. Reinicie o bot com /start para aplicar as mudanças.",
                    { parse_mode: 'Markdown' }
                );
            } else {
                await bot.sendMessage(adminId, `❌ Erro ao restaurar backup: ${restoreResult.error}`);
            }
            return;
        } else if (data === 'backup_create') {
            const result = backupManager.createBackup('manual_admin');
            if (result.success) {
                await bot.sendMessage(adminId, "✅ Backup manual criado com sucesso!");
            } else {
                await bot.sendMessage(adminId, `❌ Erro ao criar backup: ${result.error}`);
            }
            await sendBackupsPanel(bot, adminId);
            return;
        }
        // ================================================================================

        switch (action) {
            case 'panel':
                await sendAdminPanel(bot, adminId);
                break;

            case 'security':
                await sendSecurityPanel(bot, adminId);
                break;

            case 'reset':
                if (params[0] === 'all' && params[1] === 'limits') {
                    for (const key of rateLimiter.users.keys()) {
                        rateLimiter.users.delete(key);
                    }
                    await bot.sendMessage(adminId, "✅ Todos os limites de rate limiting foram resetados.");
                    await sendSecurityPanel(bot, adminId);
                }
                break;

            case 'rate':
                if (params[0] === 'limit' && params[1] === 'stats') {
                    const allUsers = Array.from(rateLimiter.users.keys());
                    let statsMessage = "📊 *Estatísticas de Rate Limiting*\n\n";
                    
                    if (allUsers.length === 0) {
                        statsMessage += "Nenhum usuário está sendo limitado no momento.";
                    } else {
                        statsMessage += `Usuários sendo monitorados: ${allUsers.length}\n\n`;
                        allUsers.slice(0, 10).forEach(key => {
                            const [userId, action] = key.split(':');
                            const data = rateLimiter.users.get(key);
                            statsMessage += `👤 ${userId}: ${action} (${data.attempts} tentativas)\n`;
                        });
                        if (allUsers.length > 10) {
                            statsMessage += `\n... e mais ${allUsers.length - 10} usuários`;
                        }
                    }
                    
                    await bot.sendMessage(adminId, statsMessage, { parse_mode: 'Markdown' });
                }
                break;

            case 'sales':
                if (params[0] === 'funnel') {
                    await sendSalesFunnelPanel(bot, adminId);
                }
                break;

            case 'manage':
                if (params[0] === 'plans') {
                    const settings = db.getSettings();
                    const planButtons = Object.entries(settings.plans).map(([key, plan]) => {
                        const status = plan.isActive ? '🟢' : '🔴';
                        return [{
                            text: `${status} ${plan.name}: R$ ${plan.price.toFixed(2)}`,
                            callback_data: `admin_config_plan_${key}`
                        }];
                    });
                    await bot.sendMessage(adminId, "📦 *Gerenciar Planos*\n\nClique em um plano para alterar.", {
                        reply_markup: { inline_keyboard: [...planButtons, [{ text: '🔙 Voltar', callback_data: 'admin_panel' }]] },
                        parse_mode: 'Markdown'
                    });
                } else if (params[0] === 'subs') {
                    await bot.sendMessage(adminId, "👥 *Gerenciar Assinantes*", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "➕ Adicionar Assinatura", callback_data: "admin_sub_add_id" }],
                                [{ text: "🗑️ Remover Assinatura", callback_data: "admin_sub_remove_id" }],
                                [{ text: "🔙 Voltar", callback_data: "admin_panel" }]
                            ]
                        },
                        parse_mode: 'Markdown'
                    });
                } else if (params[0] === 'funnel' && params[1] === 'messages') {
                    await sendFunnelMessagesPanel(bot, adminId);
                } else if (params[0] === 'backups') {
                    await sendBackupsPanel(bot, adminId);
                }
                break;

            case 'config':
                if (params[0] === 'plan') {
                    const planKey = params[1];
                    const plan = db.getSettings().plans[planKey];
                    const toggleText = plan.isActive ? '🔴 Desativar' : '🟢 Ativar';
                    await bot.sendMessage(adminId,
                        `Configurando o *Plano ${plan.name}*\n\n` +
                        `*TriboPay Product Hash:* \`${plan.product_hash || 'Não definido'}\`\n` +
                        `*TriboPay Offer Hash:* \`${plan.offer_hash || 'Não definido'}\`\n\n` +
                        `*Pepper Product Hash:* \`${plan.pepper_product_hash || 'Não definido'}\`\n` +
                        `*Pepper Offer Hash:* \`${plan.pepper_offer_hash || 'Não definido'}\``, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💰 Alterar Preço', callback_data: `admin_setprice_${planKey}` }],
                                [{ text: '✏️ Alterar TriboPay Hashes', callback_data: `admin_settribohash_${planKey}` }],
                                [{ text: '🌶️ Alterar Pepper Hashes', callback_data: `admin_setpepperhash_${planKey}` }],
                                [{ text: toggleText, callback_data: `admin_toggleplan_${planKey}` }],
                                [{ text: '🔙 Voltar', callback_data: 'admin_manage_plans' }]
                            ]
                        },
                        parse_mode: 'Markdown'
                    });
                } else if (params[0] === 'payment') {
                    await sendPaymentGatewaySelectionPanel(bot, adminId);
                } else if (params[0] === 'mp') {
                    await sendMercadoPagoSettingsPanel(bot, adminId);
                } else if (params[0] === 'pp') {
                    await sendPushinpaySettingsPanel(bot, adminId);
                } else if (params[0] === 'tp') {
                    await sendTriboPaySettingsPanel(bot, adminId);
                } else if (params[0] === 'pepper') {
                    await sendPepperSettingsPanel(bot, adminId);
                } else if (params.join('_') === 'welcome_media') {
                    await sendWelcomeMediaPanel(bot, adminId);
                } else if (params.join('_') === 'welcome_audio') {
                    await sendWelcomeAudioPanel(bot, adminId);
                } else if (params[0] === 'previews') {
                    await sendPreviewsChannelPanel(bot, adminId);
                }
                break;

            case 'settribohash': {
                const planKey = params[0];
                conversationState[adminId] = { type: 'set_product_hash', planKey };
                await bot.sendMessage(adminId, `Envie o *Product Hash* da TriboPay para o plano *${db.getSettings().plans[planKey].name}*.`, { parse_mode: 'Markdown' });
                break;
            }

            case 'setpepperhash': {
                const planKey = params[0];
                conversationState[adminId] = { type: 'set_pepper_product_hash', planKey };
                await bot.sendMessage(adminId, `🌶️ Envie o *Product Hash* da Pepper para o plano *${db.getSettings().plans[planKey].name}*.`, { parse_mode: 'Markdown' });
                break;
            }

            case 'toggleplan': {
                const planKey = params[0];
                const settings = db.getSettings();
                settings.plans[planKey].isActive = !settings.plans[planKey].isActive;
                db.updateSettings(settings);
                await bot.sendMessage(adminId, `✅ Plano *${settings.plans[planKey].name}* foi ${settings.plans[planKey].isActive ? 'ATIVADO' : 'DESATIVADO'}.`);
                await sendAdminPanel(bot, adminId);
                break;
            }

            case 'individual':
                if (params[0] === 'discount') {
                    const messageKey = params[1];
                    await sendFunnelDiscountPanel(bot, adminId, messageKey);
                }
                break;

            case 'toggle':
                if (params[0] === 'funnel') {
                    if (params.length === 1) {
                        const settings = db.getSettings();
                        settings.salesFunnel.isActive = !settings.salesFunnel.isActive;
                        db.updateSettings(settings);
                        await bot.sendMessage(adminId, 
                            `✅ Funil de vendas ${settings.salesFunnel.isActive ? 'ATIVADO' : 'DESATIVADO'}!`);
                        await sendSalesFunnelPanel(bot, adminId);
                    }
                    else if (params[1] === 'msg' && params[2]) {
                        const messageKey = params[2];
                        const settings = db.getSettings();
                        
                        if (settings.salesFunnel && 
                            settings.salesFunnel.messages && 
                            settings.salesFunnel.messages[messageKey]) {
                            
                            const novoStatus = !settings.salesFunnel.messages[messageKey].isActive;
                            settings.salesFunnel.messages[messageKey].isActive = novoStatus;
                            db.updateSettings(settings);
                            
                            await bot.sendMessage(adminId, 
                                `✅ Mensagem do funil foi ${novoStatus ? 'ATIVADA' : 'DESATIVADA'}!`
                            );
                            
                            await sendFunnelMessageEditor(bot, adminId, messageKey);
                        } else {
                            await bot.sendMessage(adminId, "❌ Erro: Estrutura da mensagem não encontrada.");
                        }
                    }
                }
                else if (params[0] === 'individual' && params[1] === 'discount') {
                    const messageKey = params[2];
                    const settings = db.getSettings();
                    settings.salesFunnel.messages[messageKey].useIndividualDiscount = 
                        !settings.salesFunnel.messages[messageKey].useIndividualDiscount;
                    db.updateSettings(settings);
                    await sendFunnelDiscountPanel(bot, adminId, messageKey);
                }
                else if (params[0] === 'individual' && params[1] === 'type') {
                    const messageKey = params[2];
                    const settings = db.getSettings();
                    settings.salesFunnel.messages[messageKey].individualUsePercentage = 
                        !settings.salesFunnel.messages[messageKey].individualUsePercentage;
                    db.updateSettings(settings);
                    await sendFunnelDiscountPanel(bot, adminId, messageKey);
                }
                else if (params[0] === 'mp' && params[1] === 'status') {
                    const settings = db.getSettings();
                    settings.payment.mercadoPago.isActive = !settings.payment.mercadoPago.isActive;
                    db.updateSettings(settings);
                    await bot.sendMessage(adminId, `✅ Status do Mercado Pago alterado para *${settings.payment.mercadoPago.isActive ? 'ATIVO' : 'INATIVO'}*.`);
                    await sendMercadoPagoSettingsPanel(bot, adminId);
                } else if (params[0] === 'pp' && params[1] === 'status') {
                    const settings = db.getSettings();
                    settings.payment.pushinpay.isActive = !settings.payment.pushinpay.isActive;
                    db.updateSettings(settings);
                    await bot.sendMessage(adminId, `✅ Status da Pushinpay alterado para *${settings.payment.pushinpay.isActive ? 'ATIVO' : 'INATIVO'}*.`);
                    await sendPushinpaySettingsPanel(bot, adminId);
                } else if (params[0] === 'tp' && params[1] === 'status') {
                    const settings = db.getSettings();
                    if (!settings.payment.triboPay) settings.payment.triboPay = { isActive: false, apiToken: null };
                    settings.payment.triboPay.isActive = !settings.payment.triboPay.isActive;
                    db.updateSettings(settings);
                    await bot.sendMessage(adminId, `✅ Status da TriboPay alterado para *${settings.payment.triboPay.isActive ? 'ATIVO' : 'INATIVO'}*.`);
                    await sendTriboPaySettingsPanel(bot, adminId);
                } else if (params[0] === 'pepper' && params[1] === 'status') {
                    const settings = db.getSettings();
                    if (!settings.payment.pepper) settings.payment.pepper = { isActive: false, accessToken: null };
                    settings.payment.pepper.isActive = !settings.payment.pepper.isActive;
                    db.updateSettings(settings);
                    await bot.sendMessage(adminId, `✅ Status da Pepper alterado para *${settings.payment.pepper.isActive ? 'ATIVO' : 'INATIVO'}*.`);
                    await sendPepperSettingsPanel(bot, adminId);
                } else if (params.join('_') === 'welcome_media') {
                    const settings = db.getSettings();
                    if (!settings.welcomeMedia || !settings.welcomeMedia.fileId) {
                        await bot.sendMessage(adminId, "⚠️ Você precisa definir uma mídia antes de poder ativá-la!");
                    } else {
                        settings.welcomeMedia.isActive = !settings.welcomeMedia.isActive;
                        db.updateSettings(settings);
                        await bot.sendMessage(adminId, `✅ Mídia de boas-vindas foi *${settings.welcomeMedia.isActive ? 'ATIVADA' : 'DESATIVADA'}*.`);
                    }
                    await sendWelcomeMediaPanel(bot, adminId);
                } else if (params.join('_') === 'welcome_audio') {
                    const settings = db.getSettings();
                    if (!settings.welcomeMedia?.audio || !settings.welcomeMedia.audio.fileId) {
                        await bot.sendMessage(adminId, "⚠️ Você precisa definir um áudio antes de poder ativá-lo!");
                    } else {
                        settings.welcomeMedia.audio.isActive = !settings.welcomeMedia.audio.isActive;
                        db.updateSettings(settings);
                        await bot.sendMessage(adminId, `✅ Áudio de boas-vindas foi *${settings.welcomeMedia.audio.isActive ? 'ATIVADO' : 'DESATIVADO'}*.`);
                    }
                    await sendWelcomeAudioPanel(bot, adminId);
                } else if (params[0] === 'previews') {
                    const settings = db.getSettings();
                    if (!settings.previewsChannel.link) {
                        await bot.sendMessage(adminId, "⚠️ Você precisa definir um link para o canal antes de poder ativá-lo!");
                    } else {
                        settings.previewsChannel.isActive = !settings.previewsChannel.isActive;
                        db.updateSettings(settings);
                        await bot.sendMessage(adminId, `✅ O botão do Canal de Prévias foi *${settings.previewsChannel.isActive ? 'ATIVADO' : 'DESATIVADO'}*.`);
                    }
                    await sendPreviewsChannelPanel(bot, adminId);
                }
                break;

            case 'setprice': {
                const planKey = params[0];
                conversationState[adminId] = { type: 'set_price', planKey };
                await bot.sendMessage(adminId, `Digite o novo preço para o plano *${db.getSettings().plans[planKey].name}*.\nUse ponto para centavos (ex: 29.90).`, { parse_mode: 'Markdown' });
                break;
            }

            case 'set':
                if (params[0] === 'individual' && params[1] === 'percentage') {
                    const messageKey = params[2];
                    conversationState[adminId] = { 
                        type: 'set_individual_percentage', 
                        messageKey: messageKey 
                    };
                    await bot.sendMessage(adminId, 
                        `📊 *Configurar Porcentagem Individual*\n\n` +
                        `Digite a porcentagem de desconto para esta mensagem (ex: 15 para 15%):`);
                }
                else if (params[0] === 'individual' && params[1] === 'value') {
                    const messageKey = params[2];
                    conversationState[adminId] = { 
                        type: 'set_individual_value', 
                        messageKey: messageKey 
                    };
                    await bot.sendMessage(adminId, 
                        `💰 *Configurar Valor Fixo Individual*\n\n` +
                        `Digite o valor de desconto fixo (ex: 5.00 para R$ 5,00):`);
                }
                else if (params[0] === 'mp' && params[1] === 'token') {
                    conversationState[adminId] = { type: 'set_mp_token' };
                    await bot.sendMessage(adminId, "🔑 Envie o seu *Access Token de PRODUÇÃO* do Mercado Pago.\n\n_Sua mensagem será apagada por segurança após o envio._", { parse_mode: 'Markdown' });
                } else if (params[0] === 'pp' && params[1] === 'token') {
                    conversationState[adminId] = { type: 'set_pp_token' };
                    await bot.sendMessage(adminId, "🔑 Envie o seu *API Token* da Pushinpay.\n\n_Sua mensagem será apagada por segurança após o envio._", { parse_mode: 'Markdown' });
                } else if (params[0] === 'tp' && params[1] === 'token') {
                    conversationState[adminId] = { type: 'set_tp_token' };
                    await bot.sendMessage(adminId, "🔑 Envie o seu *Token de Integração API* da TriboPay.\n\n_Sua mensagem será apagada por segurança após o envio._", { parse_mode: 'Markdown' });
                } else if (params[0] === 'pepper' && params[1] === 'token') {
                    conversationState[adminId] = { type: 'set_pepper_token' };
                    await bot.sendMessage(adminId, "🔑 Envie o seu *Access Token* da Pepper.\n\n_Sua mensagem será apagada por segurança após o envio._", { parse_mode: 'Markdown' });
                } else if (params[0] === 'welcome') {
                    if (params[1] === 'media') {
                        conversationState[adminId] = { type: 'set_welcome_media' };
                        await bot.sendMessage(adminId, "📷 Envie a foto, GIF ou vídeo que você deseja usar na mensagem de boas-vindas.");
                    } else if (params[1] === 'audio') {
                        conversationState[adminId] = { type: 'set_welcome_audio' };
                        await bot.sendMessage(adminId, "🎤 *Envie um áudio para as boas-vindas:*\n\n• Grave um áudio usando o microfone do Telegram\n• Ou envie um arquivo de áudio (MP3, OGG, etc)\n\nO áudio será reproduzido antes da mensagem de boas-vindas.", {
                            parse_mode: 'Markdown'
                        });
                    } else {
                        conversationState[adminId] = { type: 'set_welcome_message' };
                        await bot.sendMessage(adminId, '💬 Envie a nova mensagem de boas-vindas. Use a formatação do Markdown se desejar.');
                    }
                } else if (params[0] === 'support') {
                    conversationState[adminId] = { type: 'set_support_link' };
                    await bot.sendMessage(adminId, '📞 Envie o novo link completo para o suporte (ex: https://t.me/seu_usuario).');
                } else if (params.join('_') === 'previews_link') {
                    conversationState[adminId] = { type: 'set_previews_link' };
                    await bot.sendMessage(adminId, '🔗 Envie o link completo para o canal de prévias (ex: https://t.me/seu_canal).');
                } else if (params.join('_') === 'previews_text') {
                    conversationState[adminId] = { type: 'set_previews_text' };
                    await bot.sendMessage(adminId, '📝 Envie o novo texto para o botão do canal de prévias (ex: 👀 Ver Prévias Exclusivas).');
                } else if (params[0] === 'funnel' && params[1] === 'media') {
                    const messageKey = params[2];
                    conversationState[adminId] = { type: 'set_funnel_media', messageKey };
                    await bot.sendMessage(adminId, 
                        `🖼️ *Configurar Mídia para o Funil*\n\n` +
                        `Envie uma foto, GIF ou vídeo para esta mensagem do funil.\n\n` +
                        `A mídia será exibida junto com o texto da mensagem.`);
                } else if (params[0] === 'funnel' && params[1] === 'audio') {
                    const messageKey = params[2];
                    conversationState[adminId] = { type: 'set_funnel_audio', messageKey };
                    await bot.sendMessage(adminId,
                        `🎵 *Configurar Áudio para o Funil*\n\n` +
                        `Envie um áudio para esta mensagem:\n\n` +
                        `• Grave um áudio com o microfone\n` +
                        `• Ou envie um arquivo de áudio\n\n` +
                        `O áudio será reproduzido antes da mensagem.`);
                }
                break;

            case 'remove':
                if (params.join('_') === 'welcome_media') {
                    const settings = db.getSettings();
                    if (settings.welcomeMedia) {
                        settings.welcomeMedia.fileId = null;
                        settings.welcomeMedia.type = null;
                        settings.welcomeMedia.isActive = false;
                        db.updateSettings(settings);
                    }
                    await bot.sendMessage(adminId, "🗑️ Mídia de boas-vindas removida com sucesso.");
                    await sendWelcomeMediaPanel(bot, adminId);
                } else if (params.join('_') === 'welcome_audio') {
                    const settings = db.getSettings();
                    if (settings.welcomeMedia?.audio) {
                        settings.welcomeMedia.audio.fileId = null;
                        settings.welcomeMedia.audio.isActive = false;
                        db.updateSettings(settings);
                    }
                    await bot.sendMessage(adminId, "🗑️ Áudio de boas-vindas removido com sucesso.");
                    await sendWelcomeAudioPanel(bot, adminId);
                } else if (params[0] === 'funnel' && params[1] === 'media') {
                    const messageKey = params[2];
                    const settings = db.getSettings();
                    settings.salesFunnel.messages[messageKey].media = { fileId: null, type: null };
                    settings.salesFunnel.messages[messageKey].audio = { fileId: null, isActive: false };
                    db.updateSettings(settings);
                    await bot.sendMessage(adminId, "🗑️ Mídia e áudio removidos da mensagem do funil!");
                    await sendFunnelMessageEditor(bot, adminId, messageKey);
                }
                break;

            case 'sub':
                if (params[0] === 'add' && params[1] === 'id') {
                    conversationState[adminId] = { type: 'sub_add_id' };
                    await bot.sendMessage(adminId, "➕ Por favor, envie o *ID de usuário* do Telegram do novo assinante.");
                } else if (params[0] === 'remove' && params[1] === 'id') {
                    conversationState[adminId] = { type: 'sub_remove_id' };
                    await bot.sendMessage(adminId, "🗑️ Por favor, envie o *ID de usuário* do Telegram de quem deseja remover a assinatura.");
                }
                break;

            case 'funnel':
                if (params[0] === 'stats') {
                    const funnelUsers = db.getFunnelUsers();
                    const totalUsers = Object.keys(funnelUsers).length;
                    const activeUsers = Object.values(funnelUsers).filter(user => !user.hasPaid).length;
                    const convertedUsers = Object.values(funnelUsers).filter(user => user.hasPaid).length;
                    
                    const conversionRate = totalUsers > 0 ? ((convertedUsers / totalUsers) * 100).toFixed(1) : 0;

                    await bot.sendMessage(adminId,
                        `📊 *Estatísticas do Funil*\n\n` +
                        `👥 *Total no Funil:* ${totalUsers} usuários\n` +
                        `⏳ *Aguardando:* ${activeUsers} usuários\n` +
                        `✅ *Convertidos:* ${convertedUsers} usuários\n` +
                        `📈 *Taxa de Conversão:* ${conversionRate}%\n\n` +
                        `O funil está ${db.getSettings().salesFunnel.isActive ? '🟢 ATIVO' : '🔴 INATIVO'}`);
                    await sendSalesFunnelPanel(bot, adminId);
                }
                break;

            case 'settings':
                await sendSettingsPanel(bot, adminId);
                break;

            case 'edit':
                if (params[0] === 'funnel' && params[1] === 'msg') {
                    const messageKey = params[2];
                    await sendFunnelMessageEditor(bot, adminId, messageKey);
                }
                else if (params[0] === 'funnel' && params[1] === 'text') {
                    const messageKey = params[2];
                    conversationState[adminId] = { type: 'set_funnel_text', messageKey };
                    await bot.sendMessage(adminId,
                        `📝 *Editando Texto da Mensagem*\n\n` +
                        `Envie o novo texto para esta mensagem do funil.\n\n` +
                        `💡 *Dicas:*\n` +
                        `• Use emojis para chamar atenção\n` +
                        `• Destaque o desconto especial\n` +
                        `• Crie urgência\n` +
                        `• Use *negrito* e _itálico_ com Markdown`);
                }
                break;

            case 'broadcast': {
                conversationState[adminId] = { type: 'broadcast_message' };
                await bot.sendMessage(adminId, 
                    `📢 *Sistema de Transmissão Completo*\n\n` +
                    `Agora basta enviar a mensagem que deseja transmitir.\n\n` +
                    `✅ *Será replicado exatamente:*\n` +
                    `• Texto e formatação\n` +
                    `• Fotos, vídeos, GIFs\n` +
                    `• Áudios, documentos\n` +
                    `• 🔘 Botões inline\n` +
                    `• Emojis premium\n` +
                    `• Tudo que o Telegram suporta!\n\n` +
                    `Envie agora a mensagem completa:`,
                    { parse_mode: 'Markdown' }
                );
                break;
            }

            case 'stats': {
                const totalUsers = db.getAllUsers().length;
                const totalSubs = db.getSubscriptions().length;
                await bot.sendMessage(adminId, `📊 *Estatísticas Atuais:*\n\n- *Usuários Totals (iniciaram o bot):* ${totalUsers}\n- *Assinantes Ativos:* ${totalSubs}`, { parse_mode: 'Markdown' });
                await sendAdminPanel(bot, adminId);
                break;
            }

            case 'weekly_report':
                try {
                    const WeeklyReporter = require('../services/weeklyReporter');
                    const reporter = new WeeklyReporter(bot);
                    await reporter.generateWeeklyReport();
                    await bot.sendMessage(adminId, "📊 Relatório semanal gerado e enviado!");
                } catch (error) {
                    await bot.sendMessage(adminId, "❌ Erro ao gerar relatório: " + error.message);
                }
                break;

            case 'upsell':
                await adminUpsellHandlers.showUpsellPanel(adminId);
                break;
        }
    });

    // HANDLERS PARA MÍDIA DO FUNIL (photos, animations, videos)
    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        
        if (chatId !== adminId || !state || state.type !== 'set_funnel_media') return;

        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const settings = db.getSettings();
        settings.salesFunnel.messages[state.messageKey].media = {
            fileId: fileId,
            type: 'photo'
        };
        db.updateSettings(settings);
        
        delete conversationState[chatId];
        await bot.sendMessage(adminId, "🖼️ Foto definida para a mensagem do funil!");
        await sendFunnelMessageEditor(bot, adminId, state.messageKey);
    });

    bot.on('animation', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        
        if (chatId !== adminId || !state || state.type !== 'set_funnel_media') return;

        const fileId = msg.animation.file_id;
        const settings = db.getSettings();
        settings.salesFunnel.messages[state.messageKey].media = {
            fileId: fileId,
            type: 'animation'
        };
        db.updateSettings(settings);
        
        delete conversationState[chatId];
        await bot.sendMessage(adminId, "🎬 GIF/Animação definida para a mensagem do funil!");
        await sendFunnelMessageEditor(bot, adminId, state.messageKey);
    });

    bot.on('video', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        
        if (chatId !== adminId || !state || state.type !== 'set_funnel_media') return;

        const fileId = msg.video.file_id;
        const settings = db.getSettings();
        settings.salesFunnel.messages[state.messageKey].media = {
            fileId: fileId,
            type: 'video'
        };
        db.updateSettings(settings);
        
        delete conversationState[chatId];
        await bot.sendMessage(adminId, "🎥 Vídeo definido para a mensagem do funil!");
        await sendFunnelMessageEditor(bot, adminId, state.messageKey);
    });

    // voice & audio handlers and welcome media handlers (kept as before)
    bot.on('voice', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        
        if (chatId !== adminId || !state || (state.type !== 'set_funnel_audio' && state.type !== 'set_welcome_audio')) return;

        if (state.type === 'set_funnel_audio') {
            const fileId = msg.voice.file_id;
            const settings = db.getSettings();
            settings.salesFunnel.messages[state.messageKey].audio = {
                fileId: fileId,
                isActive: true
            };
            db.updateSettings(settings);
            
            delete conversationState[chatId];
            await bot.sendMessage(adminId, "🎤 Áudio gravado definido para o funil!");
            await sendFunnelMessageEditor(bot, adminId, state.messageKey);
        } else if (state.type === 'set_welcome_audio') {
            const fileId = msg.voice.file_id;
            const duration = msg.voice.duration || 0;
            const settings = db.getSettings();
            if (!settings.welcomeMedia) settings.welcomeMedia = {};
            if (!settings.welcomeMedia.audio) settings.welcomeMedia.audio = { isActive: false, fileId: null };
            settings.welcomeMedia.audio.fileId = fileId;
            db.updateSettings(settings);
            
            delete conversationState[chatId];
            await bot.sendMessage(adminId, `🎤 *Áudio gravado definido com sucesso!*\n\n⏱️ *Duração:* ${duration} segundos`, { parse_mode: 'Markdown' });
            await sendWelcomeAudioPanel(bot, adminId);
        }
    });

    bot.on('audio', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        if (chatId !== adminId || !state) return;

        if (state.type === 'set_funnel_audio') {
            const fileId = msg.audio.file_id;
            const settings = db.getSettings();
            settings.salesFunnel.messages[state.messageKey].audio = {
                fileId: fileId,
                isActive: true
            };
            db.updateSettings(settings);
            
            delete conversationState[chatId];
            await bot.sendMessage(adminId, "🎵 Áudio definido para o funil!");
            await sendFunnelMessageEditor(bot, adminId, state.messageKey);
        } else if (state.type === 'set_welcome_audio') {
            const fileId = msg.audio.file_id;
            const fileName = msg.audio.file_name || 'audio_file';
            const fileSize = msg.audio.file_size || 0;
            const duration = msg.audio.duration || 0;
            const settings = db.getSettings();
            if (!settings.welcomeMedia) settings.welcomeMedia = {};
            if (!settings.welcomeMedia.audio) settings.welcomeMedia.audio = { isActive: false, fileId: null };
            settings.welcomeMedia.audio.fileId = fileId;
            db.updateSettings(settings);
            
            delete conversationState[chatId];
            await bot.sendMessage(adminId, `🎵 *Áudio definido com sucesso!*\n\n📁 *Arquivo:* ${fileName}\n⏱️ *Duração:* ${duration} segundos\n💾 *Tamanho:* ${(fileSize / 1024 / 1024).toFixed(2)} MB`, { parse_mode: 'Markdown' });
            await sendWelcomeAudioPanel(bot, adminId);
        }
    });

    const handleWelcomeMediaUpload = async (msg, type) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        if (chatId !== adminId || !state || state.type !== 'set_welcome_media') return;

        let fileId;
        if (type === 'photo') fileId = msg.photo[msg.photo.length - 1].file_id;
        else if (type === 'animation') fileId = msg.animation.file_id;
        else if (type === 'video') fileId = msg.video.file_id;

        const settings = db.getSettings();
        if (!settings.welcomeMedia) settings.welcomeMedia = { isActive: false, fileId: null, type: null, audio: { isActive: false, fileId: null } };
        settings.welcomeMedia.fileId = fileId;
        settings.welcomeMedia.type = type;
        db.updateSettings(settings);

        delete conversationState[chatId];
        await bot.sendMessage(adminId, `🖼️ Mídia (${type}) de boas-vindas definida com sucesso! Agora você pode ativá-la no menu.`);
        await sendWelcomeMediaPanel(bot, adminId);
    };

    bot.on('document', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        if (chatId !== adminId || !state || state.type !== 'set_welcome_audio') return;

        const mimeType = msg.document.mime_type;
        const fileName = msg.document.file_name || 'audio_file';
        if (mimeType && mimeType.startsWith('audio/')) {
            const fileId = msg.document.file_id;
            const fileSize = msg.document.file_size || 0;
            const settings = db.getSettings();
            if (!settings.welcomeMedia) settings.welcomeMedia = {};
            if (!settings.welcomeMedia.audio) settings.welcomeMedia.audio = { isActive: false, fileId: null };
            settings.welcomeMedia.audio.fileId = fileId;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, `🎵 *Áudio definido com sucesso!*\n\n📁 *Arquivo:* ${fileName}\n🎵 *Formato:* ${mimeType}\n💾 *Tamanho:* ${(fileSize / 1024 / 1024).toFixed(2)} MB`, { parse_mode: 'Markdown' });
            await sendWelcomeAudioPanel(bot, adminId);
        }
    });

    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        if (chatId !== adminId || !state || state.type !== 'set_welcome_media') return;
        await handleWelcomeMediaUpload(msg, 'photo');
    });

    bot.on('animation', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        if (chatId !== adminId || !state || state.type !== 'set_welcome_media') return;
        await handleWelcomeMediaUpload(msg, 'animation');
    });

    bot.on('video', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        if (chatId !== adminId || !state || state.type !== 'set_welcome_media') return;
        await handleWelcomeMediaUpload(msg, 'video');
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        if (chatId !== adminId || !conversationState[chatId] || msg.text?.startsWith('/')) return;

        const state = conversationState[chatId];
        const text = msg.text;

        if (state.type === 'set_mp_token') {
            const settings = db.getSettings();
            settings.payment.mercadoPago.accessToken = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) {}
            await bot.sendMessage(adminId, "✅ Access Token do Mercado Pago atualizado com sucesso!");
            await sendMercadoPagoSettingsPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_pp_token') {
            const settings = db.getSettings();
            settings.payment.pushinpay.apiToken = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) {}
            await bot.sendMessage(adminId, "✅ API Token da Pushinpay atualizado com sucesso!");
            await sendPushinpaySettingsPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_tp_token') {
            const settings = db.getSettings();
            if (!settings.payment.triboPay) settings.payment.triboPay = { isActive: false, apiToken: null };
            settings.payment.triboPay.apiToken = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) {}
            await bot.sendMessage(adminId, "✅ Token de Integração da TriboPay atualizado com sucesso!");
            await sendTriboPaySettingsPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_pepper_token') {
            const settings = db.getSettings();
            if (!settings.payment.pepper) settings.payment.pepper = { isActive: false, accessToken: null };
            settings.payment.pepper.accessToken = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            try { await bot.deleteMessage(chatId, msg.message_id); } catch (e) {}
            await bot.sendMessage(adminId, "✅ Access Token da Pepper atualizado com sucesso!");
            await sendPepperSettingsPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_product_hash') {
            state.type = 'set_offer_hash';
            state.productHash = text.trim();
            await bot.sendMessage(adminId, `✅ Product Hash da TriboPay recebido. Agora envie o *Offer Hash* da TriboPay.`);
            return;
        }

        if (state.type === 'set_offer_hash') {
            const productHash = state.productHash;
            const offerHash = text.trim();
            const settings = db.getSettings();
            settings.plans[state.planKey].product_hash = productHash;
            settings.plans[state.planKey].offer_hash = offerHash;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, `✅ Hashes da TriboPay para o plano *${settings.plans[state.planKey].name}* foram atualizados!`);
            await sendAdminPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_pepper_product_hash') {
            state.type = 'set_pepper_offer_hash';
            state.productHash = text.trim();
            await bot.sendMessage(adminId, `🌶️ Product Hash da Pepper recebido. Agora envie o *Offer Hash* da Pepper.`);
            return;
        }

        if (state.type === 'set_pepper_offer_hash') {
            const productHash = state.productHash;
            const offerHash = text.trim();
            const settings = db.getSettings();
            settings.plans[state.planKey].pepper_product_hash = productHash;
            settings.plans[state.planKey].pepper_offer_hash = offerHash;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, `🌶️ Hashes da Pepper para o plano *${settings.plans[state.planKey].name}* foram atualizados!`);
            await sendAdminPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_price') {
            const newPrice = parseFloat(text.replace(',', '.'));
            if (isNaN(newPrice) || newPrice < 0) return await bot.sendMessage(adminId, "❌ Preço inválido. Tente novamente.");
            const settings = db.getSettings();
            settings.plans[state.planKey].price = newPrice;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, `✅ Preço do plano *${settings.plans[state.planKey].name}* atualizado para *R$${newPrice.toFixed(2)}*!`);
            await sendAdminPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_funnel_text') {
            const settings = db.getSettings();
            settings.salesFunnel.messages[state.messageKey].text = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, "✅ Texto da mensagem do funil atualizado!");
            await sendFunnelMessageEditor(bot, adminId, state.messageKey);
            return;
        }

        if (state.type === 'set_individual_percentage') {
            const percentage = parseFloat(text.replace(',', '.'));
            if (isNaN(percentage) || percentage < 0 || percentage > 100) return await bot.sendMessage(adminId, "❌ Porcentagem inválida. Use um valor entre 0 e 100.");
            const settings = db.getSettings();
            settings.salesFunnel.messages[state.messageKey].individualDiscountPercentage = percentage;
            settings.salesFunnel.messages[state.messageKey].individualUsePercentage = true;
            db.updateSettings(settings);
            delete conversationState[adminId];
            await bot.sendMessage(adminId, `✅ Porcentagem de desconto individual definida para ${percentage}%!`);
            await sendFunnelDiscountPanel(bot, adminId, state.messageKey);
            return;
        }

        if (state.type === 'set_individual_value') {
            const value = parseFloat(text.replace(',', '.'));
            if (isNaN(value) || value < 0) return await bot.sendMessage(adminId, "❌ Valor inválido. Use um número positivo (ex: 5.00).");
            const settings = db.getSettings();
            settings.salesFunnel.messages[state.messageKey].individualDiscountValue = value;
            settings.salesFunnel.messages[state.messageKey].individualUsePercentage = false;
            db.updateSettings(settings);
            delete conversationState[adminId];
            await bot.sendMessage(adminId, `✅ Valor de desconto individual definido para R$ ${value.toFixed(2)}!`);
            await sendFunnelDiscountPanel(bot, adminId, state.messageKey);
            return;
        }

        // ADICIONADO: Handler para alterar dias pós-compra do upsell
        if (state.type === 'set_post_upsell_days') {
            const days = parseInt(text, 10);
            if (isNaN(days) || days < 0) {
                await bot.sendMessage(adminId, "❌ Dias inválidos. Use um número positivo.");
                return;
            }
            
            const config = db.getSettings();
            const upsell = (config.upsell?.postPurchase || []).find(u => u.id === parseInt(state.upsellId, 10));
            if (upsell) {
                upsell.daysAfter = days;
                db.updateSettings(config);
                await bot.sendMessage(adminId, `✅ Dias alterados para: ${days} dias após a compra`);
                
                // Volta para o editor do upsell
                await adminUpsellHandlers.showPostUpsellEditor(adminId, state.upsellId);
            }
            delete conversationState[adminId];
            return;
        }
        // FIM DA SEÇÃO ADICIONADA

        if (state.type === 'broadcast_message') {
            delete conversationState[chatId];
            const allUsers = db.getAllUsers();
            await bot.sendMessage(adminId, `📤 Iniciando transmissão para ${allUsers.length} usuários...`);
            let successCount = 0;
            let errorCount = 0;
            const options = {};
            if (msg.reply_markup && msg.reply_markup.inline_keyboard) options.reply_markup = msg.reply_markup;
            if (msg.parse_mode) options.parse_mode = msg.parse_mode;

            for (const userId of allUsers) {
                try {
                    if (msg.photo) {
                        const fileId = msg.photo[msg.photo.length - 1].file_id;
                        await bot.sendPhoto(userId, fileId, { caption: msg.caption, parse_mode: options.parse_mode, reply_markup: options.reply_markup });
                    } else if (msg.video) {
                        await bot.sendVideo(userId, msg.video.file_id, { caption: msg.caption, parse_mode: options.parse_mode, reply_markup: options.reply_markup });
                    } else if (msg.animation) {
                        await bot.sendAnimation(userId, msg.animation.file_id, { caption: msg.caption, parse_mode: options.parse_mode, reply_markup: options.reply_markup });
                    } else if (msg.document) {
                        await bot.sendDocument(userId, msg.document.file_id, { caption: msg.caption, parse_mode: options.parse_mode, reply_markup: options.reply_markup });
                    } else if (msg.audio) {
                        await bot.sendAudio(userId, msg.audio.file_id, { caption: msg.caption, parse_mode: options.parse_mode, reply_markup: options.reply_markup });
                    } else if (msg.voice) {
                        await bot.sendVoice(userId, msg.voice.file_id, { caption: msg.caption, parse_mode: options.parse_mode, reply_markup: options.reply_markup });
                    } else if (msg.text) {
                        await bot.sendMessage(userId, msg.text, options);
                    } else {
                        await bot.sendMessage(userId, "📢 Nova mensagem do administrador!", options);
                    }
                    successCount++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e) {
                    errorCount++;
                    console.error(`Falha ao enviar broadcast para ${userId}: ${e.message}`);
                }
            }

            await bot.sendMessage(adminId, 
                `✅ *Transmissão concluída!*\n\n📊 *Resultado:*\n• ✅ Sucesso: ${successCount}\n• ❌ Falhas: ${errorCount}`, { parse_mode: 'Markdown' });
            await sendAdminPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_welcome_message') {
            const settings = db.getSettings();
            settings.welcomeMessage = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, "✅ Mensagem de boas-vindas atualizada com sucesso!");
            await sendSettingsPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_support_link') {
            if (!text.startsWith('http')) return await bot.sendMessage(adminId, "❌ Link inválido. Certifique-se de que ele começa com http ou https.");
            const settings = db.getSettings();
            settings.supportLink = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, "✅ Link de suporte atualizado com sucesso!");
            await sendSettingsPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_previews_link') {
            if (!text.startsWith('http')) return await bot.sendMessage(adminId, "❌ Link inválido. Certifique-se de que ele começa com http ou https e é um link de canal válido.");
            const settings = db.getSettings();
            settings.previewsChannel.link = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, "✅ Link do Canal de Prévias atualizado com sucesso!");
            await sendPreviewsChannelPanel(bot, adminId);
            return;
        }

        if (state.type === 'set_previews_text') {
            const settings = db.getSettings();
            settings.previewsChannel.buttonText = text;
            db.updateSettings(settings);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, "✅ Texto do botão atualizado com sucesso!");
            await sendPreviewsChannelPanel(bot, adminId);
            return;
        }

        if (state.type === 'sub_add_id') {
            const userId = Number(text);
            if (isNaN(userId)) return await bot.sendMessage(adminId, "❌ ID inválido. Por favor, envie apenas números.");
            state.userId = userId;
            state.type = 'sub_add_days';
            await bot.sendMessage(adminId, `✅ ID recebido: \`${userId}\`.\n\n📅 Por quantos dias a assinatura será válida? (Ex: 7, 30, 365)`);
            return;
        }

        if (state.type === 'sub_add_days') {
            const days = Number(text);
            if (isNaN(days) || days <= 0) return await bot.sendMessage(adminId, "❌ Duração inválida. Envie um número positivo de dias.");
            const now = new Date();
            const expiryDate = new Date(new Date().setDate(now.getDate() + days));
            const planName = `Plano Manual ${days} Dias`;
            const newSubscription = {
                userId: state.userId,
                userName: `Manual_${state.userId}`,
                planType: `manual_${days}d`,
                planName: planName,
                purchaseDate: now.toISOString(),
                expiryDate: expiryDate.toISOString(),
                renewalNotified: false
            };
            db.addSubscription(newSubscription);
            delete conversationState[chatId];
            await bot.sendMessage(adminId, `✅ Assinatura de *${days} dias* adicionada com sucesso para o usuário \`${state.userId}\`!`);

            try {
                const inviteLink = await bot.createChatInviteLink(config.mainChannelId, { member_limit: 1 });
                await bot.sendMessage(adminId, `👇 Link de acesso único para o usuário:\n\n\`${inviteLink.invite_link}\``, { parse_mode: 'Markdown' });
                try {
                    await bot.sendMessage(state.userId, `🎉 *Você recebeu um acesso VIP!* 🎉\n\nSua nova assinatura do *${planName}* foi ativada manualmente por um administrador. Clique no botão abaixo para entrar. *O link é de uso único!*`, {
                        reply_markup: { inline_keyboard: [[{ text: "Entrar no Grupo VIP", url: inviteLink.invite_link }]] },
                        parse_mode: 'Markdown'
                    });
                } catch (userError) {
                    console.error(`Falha ao notificar usuário ${state.userId} sobre assinatura manual. Ele pode ter bloqueado o bot.`);
                    await bot.sendMessage(adminId, `⚠️ Não foi possível notificar o usuário \`${state.userId}\` no privado (provavelmente o bot foi bloqueado por ele). Por favor, envie o link manualmente.`);
                }
            } catch (linkError) {
                console.error("Erro ao criar link de convite para assinatura manual:", linkError.message);
                await bot.sendMessage(adminId, "❌ Ocorreu um erro ao gerar o link de convite. Verifique se o bot tem permissão para criar links no canal.");
            }

            await sendAdminPanel(bot, adminId);
            return;
        }

        if (state.type === 'sub_remove_id') {
            const userId = Number(text);
            if (isNaN(userId)) return await bot.sendMessage(adminId, "❌ ID inválido. Por favor, envie apenas números.");
            const subscriptions = db.getSubscriptions();
            const updatedSubscriptions = subscriptions.filter(sub => sub.userId !== userId);
            if (subscriptions.length === updatedSubscriptions.length) {
                await bot.sendMessage(adminId, `⚠️ Nenhum assinante encontrado com o ID \`${userId}\`.`);
            } else {
                db.updateAllSubscriptions(updatedSubscriptions);
                await bot.sendMessage(adminId, `✅ Assinatura do usuário \`${userId}\` removida com sucesso.`);
            }
            delete conversationState[chatId];
            await sendAdminPanel(bot, adminId);
            return;
        }
    });
}

module.exports = { registerAdminHandlers };
