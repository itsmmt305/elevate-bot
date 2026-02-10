const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require('discord.js');

const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

const PASSWORD = process.env.PASSWORD;
const TIMEOUT = 15 * 60 * 1000; // 15 minutes

const PANEL_FILE = './panel.json';
const activityTimers = new Map();



/* =========================================================
   LOGGING SYSTEM
========================================================= */

async function sendLog(guild, message) {
  try {
    const logChannel = guild.channels.cache.find(
      ch => ch.name === "logs" && ch.isTextBased()
    );

    if (!logChannel) return;

    const timestamp = new Date().toLocaleString();
    await logChannel.send(`[${timestamp}] ${message}`);
  } catch (err) {
    console.error("Logging failed:", err);
  }
}



/* =========================================================
   MENTION NOTIFICATION SYSTEM
========================================================= */

async function notifyMentionedUsers(message) {
  const guild = message.guild;
  if (!guild) return;

  const memberRole = guild.roles.cache.find(r => r.name === "member");
  if (!memberRole) return;

  // Prepare message content
  let content = message.content?.trim();

  // If message is empty but has attachment
  if (!content && message.attachments.size > 0) {
    content = "[Attachment sent]";
  }

  // Replace user mention tokens with usernames
if (content) {

  // Replace <@123> and <@!123>
  content = content.replace(/<@!?(\d+)>/g, (match, id) => {
    const user = message.client.users.cache.get(id);
    if (user) return `@${user.username}`;
    return "@unknown-user";
  });

  // Escape backticks to keep formatting safe
  content = content.replace(/`/g, "'");

} else {
  content = "[No text content]";
}

  for (const [, user] of message.mentions.users) {

    if (user.bot) continue;
    if (user.id === message.author.id) continue;

    try {
      const mentionedMember = await guild.members.fetch(user.id);

      // Skip if user is logged in
      if (mentionedMember.roles.cache.has(memberRole.id)) continue;

      await user.send(
`📣 ${message.author.username} calls upon you in #${message.channel.name}

\`${content}\``
      );

    } catch {
      // DMs disabled — ignore
    }
  }
}



/* =========================================================
   PERMANENT PANEL MESSAGE
========================================================= */

async function getOrCreatePanel(channel) {

  let panelData = {};
  try {
    panelData = JSON.parse(fs.readFileSync(PANEL_FILE));
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

  fs.writeFileSync(PANEL_FILE, JSON.stringify({ messageId: msg.id }));
  return msg;
}



/* =========================================================
   READY
========================================================= */

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  try {
    const guilds = await client.guilds.fetch();

    guilds.forEach(async (g) => {
      const guild = await g.fetch();

      const channel = guild.channels.cache.find(
        ch => ch.name === "🔐-access" && ch.isTextBased()
      );

      if (!channel) return;

      await getOrCreatePanel(channel);
    });

  } catch (err) {
    console.error("Failed to initialize panel:", err);
  }
});



/* =========================================================
   INTERACTIONS
========================================================= */

client.on(Events.InteractionCreate, async interaction => {

  // Sign-in button
  if (interaction.isButton() && interaction.customId === 'open_login_modal') {

    const modal = new ModalBuilder()
      .setCustomId('login_modal')
      .setTitle('Server Login');

    const passwordInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel("Enter Server Password")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(passwordInput));
    await interaction.showModal(modal);
    return;
  }

  // Sign-out button
  if (interaction.isButton() && interaction.customId === 'logout_btn') {
    await manualLogout(interaction);
    return;
  }

  // Password submission
  if (interaction.isModalSubmit() && interaction.customId === 'login_modal') {

    const entered = interaction.fields.getTextInputValue('password');
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const memberRole = guild.roles.cache.find(r => r.name === "member");

    if (!memberRole)
      return interaction.reply({ content: "Server configuration error.", ephemeral: true });

    if (entered !== PASSWORD)
      return interaction.reply({ content: "❌ Incorrect password.", ephemeral: true });

    try {
      await member.roles.add(memberRole);
      startActivityTimer(member);

      await interaction.reply({
        content: `🟢 ${interaction.user.username} is logged in`,
        ephemeral: true
      });

      await sendLog(guild, `🟢 **${interaction.user.tag}** logged in`);

    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "Login failed.", ephemeral: true });
    }
  }
});



/* =========================================================
   MESSAGE EVENTS (activity + mention notification)
========================================================= */

client.on(Events.MessageCreate, async (message) => {

  if (!message.guild || message.author.bot) return;

  // NEW FEATURE
  await notifyMentionedUsers(message);

  const memberRole = message.guild.roles.cache.find(r => r.name === "member");
  if (!memberRole) return;

  const member = message.member;
  if (!member.roles.cache.has(memberRole.id)) return;

  startActivityTimer(member);
});



/* =========================================================
   MANUAL LOGOUT
========================================================= */

async function manualLogout(interaction) {

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const memberRole = guild.roles.cache.find(r => r.name === "member");

  if (memberRole && member.roles.cache.has(memberRole.id))
    await member.roles.remove(memberRole);

  if (activityTimers.has(member.id)) {
    clearTimeout(activityTimers.get(member.id));
    activityTimers.delete(member.id);
  }

  await interaction.reply({ content: "🔒 You have been logged out.", ephemeral: true });

  await sendLog(guild, `🔒 **${interaction.user.tag}** logged out (manual)`);
}



/* =========================================================
   AUTO LOGOUT
========================================================= */

function startActivityTimer(member) {

  if (activityTimers.has(member.id))
    clearTimeout(activityTimers.get(member.id));

  const timer = setTimeout(async () => {

    const guild = member.guild;
    const memberRole = guild.roles.cache.find(r => r.name === "member");

    if (memberRole && member.roles.cache.has(memberRole.id))
      await member.roles.remove(memberRole);

    try { await member.send("🔒 Logged out due to inactivity."); } catch {}

    await sendLog(guild, `⏰ **${member.user.tag}** logged out (inactivity)`);

    activityTimers.delete(member.id);

  }, TIMEOUT);

  activityTimers.set(member.id, timer);
}

client.login(process.env.TOKEN);
