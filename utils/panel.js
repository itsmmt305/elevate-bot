const fs = require('fs');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const config = require('../config');

async function getOrCreatePanel(channel) {

  let panelData = {};
  try {
    panelData = JSON.parse(fs.readFileSync(config.PANEL_FILE));
  } catch {}

  if (panelData.messageId) {
    try {
      return await channel.messages.fetch(panelData.messageId);
    } catch {}
  }

  const loginBtn = new ButtonBuilder()
    .setCustomId('open_login_modal')
    .setLabel('Sign In')
    .setStyle(ButtonStyle.Success);

  const logoutBtn = new ButtonBuilder()
    .setCustomId('logout_btn')
    .setLabel('Sign Out')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(loginBtn, logoutBtn);

  const msg = await channel.send({
    content: "🔐 **Welcome to Glory**\n‎ \n",
    components: [row]
  });

  fs.writeFileSync(config.PANEL_FILE, JSON.stringify({ messageId: msg.id }));
  return msg;
}

module.exports = { getOrCreatePanel };
