// utils/backupManager.js - CORREÇÃO DEFINITIVA
const fs = require('fs');
const path = require('path');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const DB_PATH = path.join(__dirname, '..', 'subscriptions.json');
const MAX_BACKUPS = 10;

// Criar diretório de backups se não existir
function ensureBackupDir() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        console.log('📁 Diretório de backups criado');
    }
}

// Criar backup com timestamp
function createBackup(reason = 'automático') {
    try {
        ensureBackupDir();
        
        if (!fs.existsSync(DB_PATH)) {
            console.log('❌ Arquivo database não encontrado para backup');
            return { success: false, error: 'Arquivo database não encontrado' };
        }

        const timestamp = new Date().toISOString()
            .replace(/:/g, '-')
            .replace(/\..+/, '')
            .replace('T', '_');
        
        const backupName = `backup_${timestamp}_${reason}.json`;
        const backupPath = path.join(BACKUPS_DIR, backupName);
        
        // Copia o arquivo
        fs.copyFileSync(DB_PATH, backupPath);
        
        const stats = fs.statSync(backupPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        
        console.log(`✅ Backup criado: ${backupName} (${sizeKB} KB)`);
        
        // Limpa backups antigos
        cleanupOldBackups();
        
        return { 
            success: true, 
            filename: backupName,
            size: sizeKB,
            path: backupPath
        };
    } catch (error) {
        console.error('❌ Erro ao criar backup:', error.message);
        return { success: false, error: error.message };
    }
}

// Limpa backups antigos (mantém apenas os MAX_BACKUPS mais recentes)
function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(BACKUPS_DIR, file);
                return {
                    name: file,
                    path: filePath,
                    time: fs.statSync(filePath).mtime.getTime()
                };
            })
            .sort((a, b) => b.time - a.time); // Mais recentes primeiro

        // Remove os mais antigos que MAX_BACKUPS
        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`🗑️ Backup antigo removido: ${file.name}`);
            });
        }
    } catch (error) {
        console.error('❌ Erro ao limpar backups antigos:', error.message);
    }
}

// Lista backups disponíveis
function listBackups() {
    try {
        ensureBackupDir();
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(BACKUPS_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    shortName: file, // Nome curto para callback_data
                    path: filePath,
                    size: (stats.size / 1024).toFixed(2),
                    date: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Mais recentes primeiro

        return files;
    } catch (error) {
        console.error('❌ Erro ao listar backups:', error.message);
        return [];
    }
}

// Função "há quanto tempo"
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours} h atrás`;
    return `${diffDays} dias atrás`;
}

// ✅ FUNÇÃO ATUALIZADA: getBackupsForAdmin
function getBackupsForAdmin() {
    const backups = listBackups();
    
    if (backups.length === 0) {
        return { 
            message: "📂 *Nenhum backup encontrado.*\n\nO sistema ainda não criou backups automáticos.",
            keyboard: [] 
        };
    }
    
    let message = "📂 *Backups Disponíveis:*\n\n";
    const backupButtons = [];
    
    backups.forEach((backup, index) => {
        const timeAgo = getTimeAgo(new Date(backup.date));
        const shortName = backup.name.length > 20 ? 
            backup.name.substring(0, 17) + '...' : backup.name;
        
        message += `*${index + 1}. ${shortName}*\n`;
        message += `   ⏰ ${timeAgo} | 💾 ${backup.size} KB\n\n`;
        
        // ✅ CORREÇÃO CRÍTICA: CALLBACK_DATA CURTO
        // Usar índice em vez de timestamp para garantir < 64 bytes
        const callbackData = `backup_restore_${index}`;
        
        console.log(`✅ Callback_data seguro: ${callbackData} (${callbackData.length} bytes)`);
        
        backupButtons.push([{ 
            text: `🔄 ${index + 1}. ${shortName}`,
            callback_data: callbackData
        }]);
    });
    
    message += `💡 *Total: ${backups.length} backups*`;
    
    backupButtons.push([
        { 
            text: '🆕 Criar Backup Agora', 
            callback_data: 'backup_create' 
        }
    ]);
    
    backupButtons.push([
        { 
            text: '🔙 Voltar', 
            callback_data: 'admin_settings' 
        }
    ]);
    
    return { message, keyboard: backupButtons };
}

// ✅ NOVA FUNÇÃO: getBackupByIndex
function getBackupByIndex(index) {
    const backups = listBackups();
    if (index >= 0 && index < backups.length) {
        return backups[index];
    }
    return null;
}

// ✅ ATUALIZAR restoreBackupByIndex
function restoreBackupByIndex(index) {
    try {
        const backup = getBackupByIndex(index);
        if (!backup) {
            return { success: false, error: 'Backup não encontrado' };
        }
        return restoreBackup(backup.name);
    } catch (error) {
        console.error('❌ Erro ao restaurar backup:', error.message);
        return { success: false, error: error.message };
    }
}

// Função para mostrar backups no admin (compatibilidade antiga)
function getBackupsForAdminPanel() {
    return getBackupsForAdmin();
}

// ✅ NOVA FUNÇÃO: Encontrar backup pelo timestamp
function findBackupByTimestamp(timestamp) {
    const backups = listBackups();
    return backups.find(backup => 
        backup.name.includes(timestamp)
    );
}

// ✅ FUNÇÃO ATUALIZADA: Restaurar backup por timestamp
function restoreBackupByTimestamp(timestamp) {
    try {
        const backup = findBackupByTimestamp(timestamp);
        if (!backup) {
            return { success: false, error: 'Backup não encontrado' };
        }

        return restoreBackup(backup.name);
    } catch (error) {
        console.error('❌ Erro ao restaurar backup por timestamp:', error.message);
        return { success: false, error: error.message };
    }
}

// Restaura backup específico (função original mantida)
function restoreBackup(backupName) {
    try {
        const backupPath = path.join(BACKUPS_DIR, backupName);
        
        if (!fs.existsSync(backupPath)) {
            return { success: false, error: 'Backup não encontrado' };
        }

        // Cria backup antes de restaurar (segurança)
        createBackup('antes_da_restauracao');
        
        // Restaura o backup
        fs.copyFileSync(backupPath, DB_PATH);
        
        console.log(`🔄 Backup restaurado com sucesso: ${backupName}`);
        return { 
            success: true, 
            filename: backupName,
            message: 'Backup restaurado com sucesso' 
        };
    } catch (error) {
        console.error('❌ Erro ao restaurar backup:', error.message);
        return { success: false, error: error.message };
    }
}

// Backup automático diário
function startAutoBackup() {
    // Backup a cada 24 horas
    setInterval(() => {
        createBackup('diario_automatico');
    }, 24 * 60 * 60 * 1000); // 24 horas
    
    console.log('⏰ Backup automático diário configurado');
}

// Obter informações de um backup específico
function getBackupInfo(backupName) {
    try {
        const backupPath = path.join(BACKUPS_DIR, backupName);
        
        if (!fs.existsSync(backupPath)) {
            return null;
        }

        const stats = fs.statSync(backupPath);
        return {
            filename: backupName,
            path: backupPath,
            size: (stats.size / 1024).toFixed(2),
            date: stats.mtime
        };
    } catch (error) {
        console.error('❌ Erro ao obter info do backup:', error.message);
        return null;
    }
}

module.exports = {
    createBackup,
    listBackups,
    restoreBackup,
    restoreBackupByTimestamp, // compatibilidade
    restoreBackupByIndex, // nova
    startAutoBackup,
    ensureBackupDir,
    getBackupsForAdmin,
    getBackupInfo,
    getBackupsForAdminPanel,
    getBackupByIndex: getBackupByIndex,
    findBackupByTimestamp
};
