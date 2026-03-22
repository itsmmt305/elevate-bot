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

  // Handle cross-user task accept/decline
  if (interaction.isButton() && interaction.customId.startsWith('accept_task_')) {
    const authorId = interaction.customId.replace('accept_task_', '');
    const messageContent = interaction.message.content;
    const taskText = messageContent.split('\n').slice(1).join('\n');

    const { addTask } = require('../utils/taskStorage');
    await addTask(interaction.user.id, taskText);

    await interaction.update({
      content: `${messageContent}\n\n**(Accepted)**`,
      components: []
    });
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('decline_task_')) {
    const authorId = interaction.customId.replace('decline_task_', '');
    const messageContent = interaction.message.content;
    const taskText = messageContent.split('\n').slice(1).join('\n');

    try {
      const author = await interaction.client.users.fetch(authorId);
      if (author) {
        await author.send(`your challenge ${taskText} was rejected by ${interaction.user.username}`);
      }
    } catch (e) {
      console.error("Could not send decline DM to author:", e);
    }

    await interaction.update({
      content: `${messageContent}\n\n**(Declined)**`,
      components: []
    });
    return;
  }
}

module.exports = { handleInteraction };
