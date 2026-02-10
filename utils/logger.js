const config = require('../config');

async function sendLog(guild, message) {
  try {
    const logChannel = guild.channels.cache.find(
      ch => ch.name === config.LOG_CHANNEL && ch.isTextBased()
    );

    if (!logChannel) return;

    await logChannel.send(message);

  } catch (err) {
    console.error("Logging failed:", err);
  }
}

module.exports = { sendLog };