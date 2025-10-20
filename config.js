require('dotenv').config();

module.exports = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    adminUserId: parseInt(process.env.ADMIN_USER_ID, 10),
    mainChannelId: process.env.MAIN_CHANNEL_ID
};