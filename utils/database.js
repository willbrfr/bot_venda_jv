// utils/database.js - VERSÃO CORRIGIDA E COMPLETA
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'subscriptions.json');

function init() {
    ensureDBExists();
    console.log('✅ Database inicializado');
    
    // ✅ INICIALIZA LIMPEZA AUTOMÁTICA DE ESTADO
    startStateCleanup();
}

function ensureDBExists() {
    const defaultData = {
        settings: {
            welcomeMessage: "👋 *Bem-vindo(a)!* \n\nVocê acaba de entrar em um espaço reservado para poucos. 🔒✨ Explore nossos planos abaixo e desbloqueie agora o acesso completo a conteúdos e benefícios exclusivos que *vão transformar sua experiência*. Assim que o pagamento for confirmado, seu acesso é liberado instantaneamente. 🚀",
            welcomeMedia: {
                isActive: false,
                fileId: null,
                type: null,
                audio: {
                    isActive: false,
                    fileId: null
                }
            },
            supportLink: "https://t.me/SEU_USUARIO_DE_SUPORTE",
            previewsChannel: {
                link: "https://t.me/seu_canal_de_previas",
                buttonText: "👀 espiar Prévias Exclusivas",
                isActive: false
            },
            payment: {
                mercadoPago: {
                    accessToken: null,
                    isActive: false
                },
                pushinpay: {
                    apiToken: null,
                    isActive: false
                },
                triboPay: {
                    apiToken: null,
                    isActive: false
                },
                pepper: {
                    accessToken: null,
                    isActive: false
                }
            },
            plans: {
                weekly: {
                    name: "Semanal",
                    price: 18.99,
                    days: 7,
                    isActive: true,
                    offer_hash: null,
                    product_hash: null,
                    pepper_offer_hash: null,
                    pepper_product_hash: null
                },
                biweekly: {
                    name: "Quinzenal",
                    price: 14.99,
                    days: 15,
                    isActive: true,
                    offer_hash: null,
                    product_hash: null,
                    pepper_offer_hash: null,
                    pepper_product_hash: null
                },
                monthly: {
                    name: "Mensal",
                    price: 24.99,
                    days: 30,
                    isActive: true,
                    offer_hash: null,
                    product_hash: null,
                    pepper_offer_hash: null,
                    pepper_product_hash: null
                },
                annual: {
                    name: "Anual",
                    price: 249.99,
                    days: 365,
                    isActive: false,
                    offer_hash: null,
                    product_hash: null,
                    pepper_offer_hash: null,
                    pepper_product_hash: null
                },
                lifetime: {
                    name: "Vitalício",
                    price: 499.99,
                    days: 9999,
                    isActive: false,
                    offer_hash: null,
                    product_hash: null,
                    pepper_offer_hash: null,
                    pepper_product_hash: null
                }
            },
            salesFunnel: {
                isActive: true,
                messages: {
                    message1: {
                        delay: 5,
                        isActive: true,
                        text: "Vi que você ficou interessado em nossos produtos, você acabou de ganhar 10%off 🚀🚀",
                        media: { fileId: null, type: null },
                        audio: { fileId: null, isActive: false },
                        useIndividualDiscount: false,
                        individualDiscountPercentage: 10,
                        individualDiscountValue: 0,
                        individualUsePercentage: true
                    },
                    message2: {
                        delay: 30,
                        isActive: true,
                        text: "Segunda mensagem do funil",
                        media: { fileId: null, type: null },
                        audio: { fileId: null, isActive: false },
                        useIndividualDiscount: false,
                        individualDiscountPercentage: 10,
                        individualDiscountValue: 0,
                        individualUsePercentage: true
                    },
                    message3: {
                        delay: 60,
                        isActive: true,
                        text: "Terceira mensagem do funil",
                        media: { fileId: null, type: null },
                        audio: { fileId: null, isActive: false },
                        useIndividualDiscount: false,
                        individualDiscountPercentage: 10,
                        individualDiscountValue: 0,
                        individualUsePercentage: true
                    },
                    message4: {
                        delay: 180,
                        isActive: true,
                        text: "Quarta mensagem do funil",
                        media: { fileId: null, type: null },
                        audio: { fileId: null, isActive: false },
                        useIndividualDiscount: false,
                        individualDiscountPercentage: 10,
                        individualDiscountValue: 0,
                        individualUsePercentage: true
                    },
                    message5: {
                        delay: 720,
                        isActive: true,
                        text: "Quinta mensagem do funil",
                        media: { fileId: null, type: null },
                        audio: { fileId: null, isActive: false },
                        useIndividualDiscount: false,
                        individualDiscountPercentage: 10,
                        individualDiscountValue: 0,
                        individualUsePercentage: true
                    }
                }
            },
            admins: []
        },
        activeSubscriptions: [],
        allUsers: [],
        pendingPayments: {},
        funnelUsers: {}
    };

    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
        console.log('📁 Arquivo database criado com estrutura padrão');
    }
}

function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            ensureDBExists();
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Erro ao ler database:', error.message);
        ensureDBExists();
        return readDB(); // Tenta novamente após recriar
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Erro ao escrever database:', error.message);
        return false;
    }
}

// ✅ NOVA FUNÇÃO: Limpeza automática de estado
function startStateCleanup() {
    // Limpa usuários do funil antigos a cada 6 horas
    setInterval(() => {
        try {
            const data = readDB();
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            let cleanedCount = 0;
            
            // Limpa usuários do funil com mais de 30 dias
            if (data.funnelUsers) {
                Object.keys(data.funnelUsers).forEach(userId => {
                    const userData = data.funnelUsers[userId];
                    if (userData.startTime) {
                        const startTime = new Date(userData.startTime);
                        if (startTime < thirtyDaysAgo) {
                            delete data.funnelUsers[userId];
                            cleanedCount++;
                        }
                    }
                });
            }
            
            // Limpa pagamentos pendentes antigos (mais de 24 horas)
            if (data.pendingPayments) {
                Object.keys(data.pendingPayments).forEach(paymentId => {
                    const paymentData = data.pendingPayments[paymentId];
                    // Se não temos timestamp, mantemos por segurança
                    if (!paymentData.timestamp) return;
                    
                    const paymentTime = new Date(paymentData.timestamp);
                    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    
                    if (paymentTime < twentyFourHoursAgo) {
                        delete data.pendingPayments[paymentId];
                        cleanedCount++;
                    }
                });
            }
            
            if (cleanedCount > 0) {
                writeDB(data);
                console.log(`🧹 Limpeza automática: ${cleanedCount} registros antigos removidos`);
            }
        } catch (error) {
            console.error('❌ Erro na limpeza automática:', error.message);
        }
    }, 6 * 60 * 60 * 1000); // 6 horas
    
    console.log('✅ Sistema de limpeza automática iniciado');
}

// Funções principais do database (mantidas do código original)
function getSettings() {
    const data = readDB();
    return data.settings;
}

function updateSettings(newSettings) {
    const data = readDB();
    data.settings = newSettings;
    return writeDB(data);
}

function getAllUsers() {
    const data = readDB();
    return data.allUsers || [];
}

function addUser(userId) {
    const data = readDB();
    if (!data.allUsers) data.allUsers = [];
    if (!data.allUsers.includes(userId)) {
        data.allUsers.push(userId);
        writeDB(data);
    }
}

function getSubscriptions() {
    const data = readDB();
    return data.activeSubscriptions || [];
}

function addSubscription(subscription) {
    const data = readDB();
    
    // Remove subscription existente se houver
    data.activeSubscriptions = data.activeSubscriptions.filter(sub => sub.userId !== subscription.userId);
    
    // Adiciona nova subscription
    data.activeSubscriptions.push(subscription);
    writeDB(data);
}

function updateAllSubscriptions(subscriptions) {
    const data = readDB();
    data.activeSubscriptions = subscriptions;
    writeDB(data);
}

function getUserActiveSubscription(userId) {
    const subscriptions = getSubscriptions();
    const now = new Date();
    
    return subscriptions.find(sub => {
        try {
            const expiryDate = new Date(sub.expiryDate);
            return sub.userId === userId && expiryDate > now;
        } catch (error) {
            return false;
        }
    });
}

function getPendingPayments() {
    const data = readDB();
    return data.pendingPayments || {};
}

function getPendingPayment(paymentId) {
    const data = readDB();
    return data.pendingPayments[paymentId];
}

function addPendingPayment(paymentId, paymentData) {
    const data = readDB();
    // ✅ ADICIONA TIMESTAMP para limpeza automática
    paymentData.timestamp = new Date().toISOString();
    data.pendingPayments[paymentId] = paymentData;
    writeDB(data);
}

function removePendingPayment(paymentId) {
    const data = readDB();
    delete data.pendingPayments[paymentId];
    writeDB(data);
}

function getFunnelUsers() {
    const data = readDB();
    return data.funnelUsers || {};
}

function addFunnelUser(userId) {
    const data = readDB();
    if (!data.funnelUsers) data.funnelUsers = {};
    if (!data.funnelUsers[userId]) {
        data.funnelUsers[userId] = {
            startTime: new Date().toISOString(),
            messagesSent: [],
            hasPaid: false
        };
        writeDB(data);
    }
}

function updateFunnelUser(userId, updates) {
    const data = readDB();
    if (data.funnelUsers[userId]) {
        data.funnelUsers[userId] = { ...data.funnelUsers[userId], ...updates };
        writeDB(data);
    }
}

function removeFunnelUser(userId) {
    const data = readDB();
    delete data.funnelUsers[userId];
    writeDB(data);
}

// ✅ NOVA FUNÇÃO: Limpeza manual (para admin)
function cleanupDatabase() {
    try {
        const data = readDB();
        const now = new Date();
        let stats = {
            funnelUsers: 0,
            pendingPayments: 0,
            total: 0
        };
        
        // Limpa funil
        if (data.funnelUsers) {
            Object.keys(data.funnelUsers).forEach(userId => {
                const userData = data.funnelUsers[userId];
                if (userData.startTime) {
                    const startTime = new Date(userData.startTime);
                    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                    if (startTime < thirtyDaysAgo) {
                        delete data.funnelUsers[userId];
                        stats.funnelUsers++;
                    }
                }
            });
        }
        
        // Limpa pagamentos pendentes
        if (data.pendingPayments) {
            Object.keys(data.pendingPayments).forEach(paymentId => {
                const paymentData = data.pendingPayments[paymentId];
                if (paymentData.timestamp) {
                    const paymentTime = new Date(paymentData.timestamp);
                    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    if (paymentTime < twentyFourHoursAgo) {
                        delete data.pendingPayments[paymentId];
                        stats.pendingPayments++;
                    }
                }
            });
        }
        
        stats.total = stats.funnelUsers + stats.pendingPayments;
        
        if (stats.total > 0) {
            writeDB(data);
        }
        
        return stats;
    } catch (error) {
        console.error('❌ Erro na limpeza manual:', error.message);
        return { error: error.message };
    }
}

module.exports = {
    init,
    getSettings,
    updateSettings,
    getAllUsers,
    addUser,
    getSubscriptions,
    addSubscription,
    updateAllSubscriptions,
    getUserActiveSubscription,
    getPendingPayments,
    getPendingPayment,
    addPendingPayment,
    removePendingPayment,
    getFunnelUsers,
    addFunnelUser,
    updateFunnelUser,
    removeFunnelUser,
    cleanupDatabase // ✅ NOVA FUNÇÃO
};