const config = require('../config');
const { startActivityTimer, clearUserTimer } = require('./activityManager');
const { notifyMentionedUsers } = require('./mentionNotifier');
const { sendLog } = require('../utils/logger');

async function handleMessage(message) {

  if (!message.guild || message.author.bot) return;

  const isAccessChannel = message.channel.name === config.ACCESS_CHANNEL;

  // HARD LOCKDOWN: delete all messages in access channel
  if (isAccessChannel) {

    // allow only the bot's own messages (panel + login confirmation)
    if (message.author.username !== config.BOT_NAME) {

      // capture content first for password handling
      const entered = message.content.trim();

      // immediately delete user message
      await message.delete().catch(() => {});

      // treat it as password attempt
      const guild = message.guild;
      const member = message.member;
      const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);

      if (memberRole && entered === config.PASSWORD) {

        await member.roles.set([memberRole]);
        startActivityTimer(member);

        const confirm = await message.channel.send(`🟢 ${member.user.username} logged in.`);
        setTimeout(() => confirm.delete().catch(()=>{}), 5000);

        await sendLog(guild, `🟢 **${member.user.tag}** logged in (text password)`);
      }

      return;
    }
  }


  const guild = message.guild;
  const member = message.member;
  const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);

  /* ================= MENTION NOTIFIER ================= */
  await notifyMentionedUsers(message);


  /* ================= LOGOUT COMMAND ================= */
  if (message.content.trim().toLowerCase() === "!logout") {

    if (memberRole && member.roles.cache.has(memberRole.id)) {

      await member.roles.set([]); // remove access role
      clearUserTimer(member.id);

      await message.reply("🔒 You have been logged out.");
      await sendLog(guild, `🔒 **${member.user.tag}** logged out (command)`);
    }
    return;
  }


  /* ================= TEXT PASSWORD LOGIN ================= */

  const isAccessChannel = message.channel.name === config.ACCESS_CHANNEL;

  if (isAccessChannel) {

    // ignore commands
    if (message.content.startsWith("!")) return;

    const entered = message.content.trim();

    // delete password immediately
    await message.delete().catch(() => {});

    if (!memberRole) return;

    if (entered === config.PASSWORD) {

      await member.roles.set([memberRole]);
      startActivityTimer(member);

      const confirm = await message.channel.send(`🟢 ${member.user.username} logged in.`);
      setTimeout(() => confirm.delete().catch(()=>{}), 5000);

      await sendLog(guild, `🟢 **${member.user.tag}** logged in (text password)`);

      return;
    }
  }


  /* ================= ACTIVITY TIMER ================= */

  if (!memberRole) return;
  if (!member.roles.cache.has(memberRole.id)) return;

  startActivityTimer(member);
}

module.exports = { handleMessage };
