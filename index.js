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

/* ================= CHANGE TIMEOUT HERE =================
   Example:
   5 min  -> 5 * 60 * 1000
   30 sec -> 30 * 1000
   2 hrs  -> 2 * 60 * 60 * 1000
*/
const TIMEOUT = 60 * 60 * 1000; // 1 hour


const PANEL_FILE = './panel.json';
const activityTimers = new Map();



/* =========================================================
   PERMANENT PANEL MESSAGE
========================================================= */

async function getOrCreatePanel(channel) {

  let panelData = {};
  try {
    panelData = JSON.parse(fs.readFileSync(PANEL_FILE));
  } catch {}

  // try existing panel
  if (panelData.messageId) {
    try {
      const msg = await channel.messages.fetch(panelData.messageId);
      return msg;
    } catch {}
  }

  // create buttons
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
    content: "🔐 **Sign in to continue**\n‎ \n",
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
        ch => ch.name === "🔐-sign-in" && ch.isTextBased()
      );

      if (!channel) return;

      await getOrCreatePanel(channel);
    });

  } catch (err) {
    console.error("Failed to initialize panel:", err);
  }
});



/* =========================================================
   BUTTON + MODAL HANDLER
========================================================= */

client.on(Events.InteractionCreate, async interaction => {

  /* ---------- SIGN IN BUTTON ---------- */
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

  /* ---------- SIGN OUT BUTTON ---------- */
  if (interaction.isButton() && interaction.customId === 'logout_btn') {
    await manualLogout(interaction);
    return;
  }


  /* ---------- PASSWORD SUBMIT ---------- */
  if (interaction.isModalSubmit() && interaction.customId === 'login_modal') {

    const entered = interaction.fields.getTextInputValue('password');
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const memberRole = guild.roles.cache.find(r => r.name === "member");

    if (!memberRole) {
      return interaction.reply({
        content: "Server configuration error: 'member' role missing.",
        ephemeral: true
      });
    }

    if (entered !== PASSWORD) {
      return interaction.reply({
        content: "❌ Incorrect password.",
        ephemeral: true
      });
    }

    try {
      await member.roles.add(memberRole);
      startActivityTimer(member);

      await interaction.reply({
        content: `🟢 ${interaction.user.username} is logged in`,
        ephemeral: true
      });

    } catch (err) {
      console.error("Role assignment failed:", err);
      await interaction.reply({
        content: "Login failed. Bot lacks permissions.",
        ephemeral: true
      });
    }
  }
});



/* =========================================================
   ACTIVITY TRACKING
========================================================= */

client.on(Events.MessageCreate, async (message) => {

  if (!message.guild || message.author.bot) return;

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

  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const memberRole = guild.roles.cache.find(r => r.name === "member");

    if (memberRole && member.roles.cache.has(memberRole.id)) {
      await member.roles.remove(memberRole);
    }

    if (activityTimers.has(member.id)) {
      clearTimeout(activityTimers.get(member.id));
      activityTimers.delete(member.id);
    }

    await interaction.reply({
      content: "🔒 You have been logged out.",
      ephemeral: true
    });

  } catch (err) {
    console.error("Manual logout failed:", err);
    await interaction.reply({
      content: "Logout failed.",
      ephemeral: true
    });
  }
}



/* =========================================================
   AUTO LOGOUT
========================================================= */

function startActivityTimer(member) {

  if (activityTimers.has(member.id)) {
    clearTimeout(activityTimers.get(member.id));
  }

  const timer = setTimeout(async () => {

    try {
      const guild = member.guild;
      const memberRole = guild.roles.cache.find(r => r.name === "member");

      if (memberRole && member.roles.cache.has(memberRole.id)) {
        await member.roles.remove(memberRole);
      }

      try {
        await member.send("🔒 Logged out due to inactivity.");
      } catch {}

    } catch (err) {
      console.error("Auto logout error:", err);
    }

    activityTimers.delete(member.id);

  }, TIMEOUT);

  activityTimers.set(member.id, timer);
}


client.login(process.env.TOKEN);
