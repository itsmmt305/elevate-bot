const config = require('../config');
const { notifyMentionedUsers } = require('./mentionNotifier');
const { sendLog } = require('../utils/logger');
const taskCmd = require('../tasks/tasksCommands');
const {
  checkAndGrill,
  FLAGS,
  setGrillFlag,
  getSessionActivity,
  clearSessionActivity
} = require('../utils/grillManager');

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

      // GRILL HOOK: Check if they did anything
      const activity = await getSessionActivity(member.id);
      if (!activity) {
        // Logged in, did nothing, logged out.
        await setGrillFlag(member.id, FLAGS.OPEN_APP_NO_ACTION);
      }

      await member.roles.remove(memberRole);
      clearUserTimer(member.id); // Disabled

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
      if (entered === config.PASSWORD) {
        // Grant Role
        if (memberRole) await member.roles.add(memberRole);

        // GRILL HOOK: Check flags upon login
        await checkAndGrill(guild, member.id, FLAGS.OPEN_APP_NO_ACTION);
        await checkAndGrill(guild, member.id, FLAGS.NO_LOGIN);
        await checkAndGrill(guild, member.id, FLAGS.INCOMPLETE_TASKS);
        await checkAndGrill(guild, member.id, FLAGS.TOMORROW_NOT_DONE);
        await checkAndGrill(guild, member.id, FLAGS.STREAK_MISSED, false);
        await checkAndGrill(guild, member.id, FLAGS.FREQUENT_TASK_REMOVAL);

        // RESET Activity for this new session
        await clearSessionActivity(member.id);

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
     ACTIVITY TRACKING (Optional/Legacy protection)
  ===================================================== */

  if (!memberRole) return;
  if (!member.roles.cache.has(memberRole.id)) return;

  // startActivityTimer(member); // disabled
}

module.exports = { handleMessage };
