const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { Redis } = require("@upstash/redis");
const config = require('../config');

/* ================= REDIS CONNECTION ================= */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});


/*
We store panel message per guild.

Key format:
panel_<guildId>

This prevents cross-server conflicts if you add the bot to multiple servers.
*/


async function getStoredPanelId(guildId) {
  return await redis.get(`panel_${guildId}`);
}

async function savePanelId(guildId, messageId) {
  await redis.set(`panel_${guildId}`, messageId);
}



/* =========================================================
   CREATE OR RESTORE PANEL
========================================================= */

async function getOrCreatePanel(channel) {

  const guildId = channel.guild.id;

  // 1) Try to restore old panel
  const storedId = await getStoredPanelId(guildId);

  if (storedId) {
    try {
      const existingMessage = await channel.messages.fetch(storedId);
      return existingMessage;
    } catch {
      // message was deleted manually — we recreate
      console.log("Stored panel missing. Recreating...");
    }
  }

  // 2) Create buttons
  const loginBtn = new ButtonBuilder()
    .setCustomId('open_login_modal')
    .setLabel('Sign In')
    .setStyle(ButtonStyle.Success);

  const logoutBtn = new ButtonBuilder()
    .setCustomId('logout_btn')
    .setLabel('Sign Out')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(loginBtn, logoutBtn);

  // 3) Send panel message
  const newPanel = await channel.send({
  content:
  "# GLORIOUS PURPOSE\n" +
  "Use the **Sign In** button OR type your password here.\n" +
  "To leave session anytime: `!logout`\n‎\n",
    components: [row]
  });

  // 4) Save message id to Redis
  await savePanelId(guildId, newPanel.id);

  console.log(`Panel created and saved for guild ${guildId}`);

  // CLEAN CHANNEL HISTORY (leave only panel message)
  try {
    const messages = await channel.messages.fetch({ limit: 100 });

    const toDelete = messages.filter(msg =>
      msg.id !== newPanel.id && !msg.pinned
    );

    if (toDelete.size > 0)
      await channel.bulkDelete(toDelete, true);

  } catch (err) {
    console.log("History cleanup failed:", err.message);
  }

  return newPanel;
}

module.exports = { getOrCreatePanel };
