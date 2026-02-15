const config = require('../config');
const { startActivityTimer, clearUserTimer } = require('./activityManager');
const { notifyMentionedUsers } = require('./mentionNotifier');
const { sendLog } = require('../utils/logger');
const taskCmd = require('../tasks/tasksCommands');

async function handleMessage(message) {

  if (!message.guild || message.author.bot) return;

  const guild = message.guild;
  const member = message.member;
  const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);

  const isAccessChannel = message.channel.name === config.ACCESS_CHANNEL;

  /* =====================================================
     GLOBAL LOGOUT COMMAND (PRIORITY)
  ===================================================== */

  if (message.content.trim().toLowerCase() === "!logout") {

    // Delete the command message instantly for cleanliness
    await message.delete().catch(() => { });

    if (memberRole && member.roles.cache.has(memberRole.id)) {

      await member.roles.set([]);
      clearUserTimer(member.id);

      // Send a temporary confirmation
      const reply = await message.channel.send("🔒 You have been logged out.");
      setTimeout(() => reply.delete().catch(() => { }), 5000);

      await sendLog(guild, `🔒 **${member.user.tag}** logged out (command)`);
    }
    return;
  }

  // COMMAND CHANNEL ONLY
  if (message.content.startsWith("!")) {
    await taskCmd.handleTaskCommand(message);
    return;
  }


  /* =====================================================
     ACCESS CHANNEL LOCKDOWN + PASSWORD LOGIN
  ===================================================== */

  if (isAccessChannel) {

    // ignore the bot's own panel message
    if (message.author.username !== config.BOT_NAME) {

      const entered = message.content.trim();

      // delete the message instantly
      await message.delete().catch(() => { });

      // process as password
      if (memberRole && entered === config.PASSWORD) {

        await member.roles.set([memberRole]);
        startActivityTimer(member);

        const confirm = await message.channel.send(`🟢 ${member.user.username} logged in.`);
        setTimeout(() => confirm.delete().catch(() => { }), 5000);

        await sendLog(guild, `🟢 **${member.user.tag}** logged in (text password)`);
      }

      return;
    }
  }


  /* =====================================================
     MENTION NOTIFICATIONS
  ===================================================== */

  await notifyMentionedUsers(message);

  /* =====================================================
     ACTIVITY TRACKING
  ===================================================== */

  if (!memberRole) return;
  if (!member.roles.cache.has(memberRole.id)) return;

  startActivityTimer(member);
}

module.exports = { handleMessage };
