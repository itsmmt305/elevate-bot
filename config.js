require('dotenv').config();

module.exports = {
  PASSWORD: process.env.PASSWORD,
  ACCESS_CHANNEL: "🔐-access",
  LOG_CHANNEL: "🗒️-logs",
  MEMBER_ROLE: "member",
  PANEL_FILE: "./panel.json",
  TIMEOUT: 15 * 60 * 1000, // 15 minutes -> in milliseconds
  BOT_NAME: "elevate#5504",
  COMMAND_CHANNEL: "🤖-bot-commands",
  GRILL_CHANNEL: "🚨-grilling-area",
  SESSION_PROGRESS_CHANNEL: "✅-session-progress"
};
