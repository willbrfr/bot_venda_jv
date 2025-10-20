// ======================================================
// 🤖 BOT DE ASSINATURAS PROFISSIONAL — FEITO POR WIL 💪
// ======================================================

// ✅ Silenciar logs verbosos da biblioteca
process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;
process.env.NTBA_FIX_1 = 1;

// ✅ Importações principais
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const db = require('./utils/database');
const backupManager = require('./utils/backupManager');
const rateLimiter = require('./utils/rateLimiter');

console.log("❤️ Bot de Assinaturas Feito por Will");
console.log("🚀 Inicializando... Aguarde.");

// ================================================
// ⚠️ Verificações iniciais
// ================================================
if (!config.telegramBotToken || !config.adminUserId || !config.mainChannelId) {
    console.error("❌ ERRO CRÍTICO: Verifique se TELEGRAM_BOT_TOKEN, ADMIN_USER_ID e MAIN_CHANNEL_ID estão definidos no arquivo .env");
    process.exit(1);
}

// ================================================
// 🤖 Configuração do bot com polling OTIMIZADO
// ================================================
const bot = new TelegramBot(config.telegramBotToken, { 
    polling: {
        interval: 3000,      // Aumentado para 3 segundos
        autoStart: true,
        params: { 
            timeout: 60,     // Aumentado para 60s
            limit: 50        // Reduzido para 50 mensagens
        },
        retryTimeout: 10000, // Aumentado para 10s
    },
    request: {
        timeout: 60000,      // Aumentado para 60 segundos
        agent: null,
        gzip: true,
        forever: true,       // ✅ NOVO: Conexões persistentes
        pool: {              // ✅ NOVO: Pool de conexões
            maxSockets: Infinity,
            maxFreeSockets: 256,
            timeout: 60000
        }
    },
    onlyFirstMatch: true
});

// ================================================
// 🔄 Variáveis de controle de reconexão MELHORADAS
// ================================================
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 15; // Aumentado
const RECONNECT_DELAY = 10000;     // Aumentado para 10s

// ================================================
// 💾 Inicializa banco de dados
// ================================================
db.init();

// ================================================
// ⚙️ Configuração de comandos
// ================================================
async function setupCommands() {
    try {
        await bot.setMyCommands([
            { command: 'start', description: '▶️ Iniciar o bot e ver os planos' },
            { command: 'status', description: '⭐ Ver o status da sua assinatura' }
        ]);

        await bot.setMyCommands([
            { command: 'start', description: '▶️ Iniciar o bot como usuário' },
            { command: 'admin', description: '👑 Acessar o painel de administrador' },
        ], { scope: { type: 'chat', chat_id: config.adminUserId } });
        
        console.log(`✅ Comandos configurados para admin (${config.adminUserId}) e usuários.`);
    } catch (error) {
        console.error("❌ Erro ao definir os comandos do bot:", error.message);
    }
}

// ================================================
// 🔄 Sistema INTELIGENTE de reconexão
// ================================================
async function reconnectBot() {
    if (isReconnecting) {
        console.log('⏳ Reconexão já em andamento...');
        return;
    }

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('🚨 Número máximo de tentativas de reconexão atingido. Reinicie o bot manualmente.');
        return;
    }

    isReconnecting = true;
    reconnectAttempts++;

    console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);

    try {
        // Para o polling atual de forma limpa
        await bot.stopPolling();
        console.log('✅ Polling parado com sucesso.');

        // Aguarda um tempo antes de reconectar
        await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

        // Reinicia o polling
        await bot.startPolling();
        
        console.log('✅ Reconexão bem-sucedida!');
        isReconnecting = false;
        reconnectAttempts = 0;

    } catch (error) {
        console.error(`❌ Falha na tentativa ${reconnectAttempts}:`, error.message);
        isReconnecting = false;
        
        // Tenta novamente após delay exponencial
        const nextDelay = Math.min(RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1), 120000); // Max 2 minutos
        console.log(`⏳ Próxima tentativa em ${nextDelay/1000} segundos...`);
        
        setTimeout(() => reconnectBot(), nextDelay);
    }
}

// ================================================
// 🔧 Função principal de inicialização ATUALIZADA
// ================================================
async function startBot() {
    try {
        // ✅ INICIALIZA BANCO DE DADOS PRIMEIRO
        db.init();
        console.log('✅ Database inicializado');
        
        // ✅ INICIALIZA SISTEMA DE BACKUP E CONECTA COM DATABASE
        backupManager.ensureBackupDir();
        backupManager.startAutoBackup();
        
        console.log('💾 Sistema de backup automático ativado');

        await setupCommands();
        
        // ✅ IMPORTAR E INICIALIZAR HANDLERS
        const adminHandlers = require('./handlers/adminHandlers');
        const userHandlers = require('./handlers/userHandlers');
        const notificationScheduler = require('./services/notificationScheduler');
        
        // ✅ INICIALIZAR UPSELL MANAGER
        const UpsellManager = require('./services/upsellManager');
        const upsellManager = new UpsellManager(bot);

        // ✅ REGISTRAR HANDLERS
        adminHandlers.registerAdminHandlers(bot);
        userHandlers.registerUserHandlers(bot);
        
        // ✅ INICIAR AGENDADORES
        notificationScheduler.startNotificationScheduler(bot);
        notificationScheduler.startWeeklyReporter(bot);
        
        console.log("🤖 Bot inicializado com sucesso!");
        console.log("🎯 Sistema de Funil de Vendas integrado!");
        console.log("🚀 Sistema de Upsell Automático integrado!");
        console.log("💾 Backup automático ativo!");
        console.log("🛡️ Rate Limiting ativo!");
        console.log("💌 Criado com amor por @Sex_model_adm 💋");

        // ============================================
        // 🧠 Monitoramento de memória e performance
        // ============================================
        setInterval(() => {
            const used = process.memoryUsage();
            const heapMB = Math.round(used.heapUsed / 1024 / 1024);
            
            if (heapMB > 200) {
                console.log(`🚨 ALERTA RAM: ${heapMB}MB - Considerar otimização`);
            }
            
            // ✅ MONITORAMENTO DE RATE LIMITING
            const rateLimitStats = {
                trackedUsers: rateLimiter.users.size,
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            };
            
            // Log de status a cada 10 minutos
            if (Date.now() % 600000 < 5000) {
                console.log(`📊 Status: RAM ${heapMB}MB, Reconexões: ${reconnectAttempts}`);
                console.log(`🛡️ Rate Limiting: ${rateLimitStats.trackedUsers} usuários monitorados`);
                
                // Verifica backups disponíveis
                const backups = backupManager.listBackups();
                console.log(`💾 Backups disponíveis: ${backups.length}`);
            }
        }, 300000);

    } catch (error) {
        console.error("❌ Erro crítico na inicialização:", error.message);
        console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}

// ================================================
// 🛡️ Tratamento ROBUSTO de erros de polling
// ================================================
bot.on('polling_error', (error) => {
    const errorCode = error.code || 'N/A';
    const errorMessage = error.message || 'Erro desconhecido';
    
    console.error(`[Polling Error]: ${errorCode} - ${errorMessage}`);

    // ✅ TRATAMENTO ESPECÍFICO PARA ECONNRESET
    const recoverableErrors = [
        'EFATAL',
        'ESOCKETTIMEDOUT', 
        'ECONNRESET',        // ✅ AGORA TRATADO
        'ETIMEDOUT',
        'ECONNREFUSED',
        'EPIPE',             // ✅ NOVO
        'ECONNABORTED'       // ✅ NOVO
    ];

    if (recoverableErrors.some(err => errorCode.includes(err) || errorMessage.includes(err))) {
        console.log('⚠️ Erro de conexão detectado. Iniciando procedimento de reconexão...');
        
        if (!isReconnecting) {
            setTimeout(() => reconnectBot(), 3000);
        }
    } else {
        console.log('⚠️ Erro não crítico, continuando operação...');
    }
});

// ================================================
// 🛡️ Tratamento de erros de webhook
// ================================================
bot.on('webhook_error', (error) => {
    console.error('❌ Erro no webhook:', error);
});

// ================================================
// 🛡️ Tratamento ROBUSTO de exceções globais
// ================================================
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não tratado:', err);
    // Não sair do processo para manter o bot rodando
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Promessa rejeitada não tratada em:', promise);
    console.error('Motivo:', reason);
    
    // ✅ TRATAMENTO ESPECÍFICO PARA REQUEST ERRORS
    if (reason.code && ['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(reason.code)) {
        console.log('🔄 Erro de conexão detectado em promise, aguardando reconexão automática...');
        return; // Ignora - o sistema de reconexão vai tratar
    }
});

// ================================================
// 🚨 Graceful shutdown MELHORADO
// ================================================
process.on('SIGINT', async () => {
    console.log('🛑 Recebido sinal de desligamento...');
    try {
        // ✅ BACKUP ANTES DE DESLIGAR
        const backupResult = backupManager.createBackup('antes_desligar');
        if (backupResult.success) {
            console.log(`✅ Backup de segurança criado: ${backupResult.filename}`);
        }
        
        await bot.stopPolling();
        console.log('✅ Bot parado com sucesso.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao parar o bot:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('🛑 Recebido SIGTERM...');
    try {
        // ✅ BACKUP ANTES DE DESLIGAR
        const backupResult = backupManager.createBackup('antes_desligar');
        if (backupResult.success) {
            console.log(`✅ Backup de segurança criado: ${backupResult.filename}`);
        }
        
        await bot.stopPolling();
        console.log('✅ Bot parado com sucesso.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao parar o bot:', error);
        process.exit(1);
    }
});

// ================================================
// ▶️ Inicia o bot
// ================================================
startBot();

console.log("🔧 Bot configurado com sistema de reconexão automática robusta");
console.log("💾 Sistema de backup automático integrado");
console.log("🎯 Funil de vendas ativo e funcionando");
console.log("🚀 Sistema de Upsell Automático integrado");
console.log("🛡️ Rate Limiting implementado e ativo");