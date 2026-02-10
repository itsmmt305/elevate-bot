const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const config = require('../config');
const { startActivityTimer, clearUserTimer } = require('./activityManager');
const { sendLog } = require('../utils/logger');

async function handleInteraction(interaction) {

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

  if (interaction.isButton() && interaction.customId === 'logout_btn') {

    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);

    if (memberRole && member.roles.cache.has(memberRole.id))
      await member.roles.remove(memberRole);

    clearUserTimer(member.id);

    await interaction.reply({ content: "🔒 You have been logged out.", ephemeral: true });
    await sendLog(guild, `🔒 **${interaction.user.tag}** logged out (manual)`);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'login_modal') {

    const entered = interaction.fields.getTextInputValue('password');
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);

    if (entered !== config.PASSWORD)
      return interaction.reply({ content: "❌ Incorrect password.", ephemeral: true });

    await member.roles.add(memberRole);
    startActivityTimer(member);

    await interaction.reply({ content: `🟢 ${interaction.user.username} is logged in`, ephemeral: true });
    await sendLog(guild, `🟢 **${interaction.user.tag}** logged in`);
  }
}

module.exports = { handleInteraction };
