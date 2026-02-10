require('dotenv').config();

module.exports = {
  PASSWORD: process.env.PASSWORD,
  TIMEOUT: 15 * 60 * 1000, // 15 minutes
  ACCESS_CHANNEL: "🔐-access",
  LOG_CHANNEL: "🗒️-logs",
  MEMBER_ROLE: "member",
  PANEL_FILE: "./panel.json"
};
