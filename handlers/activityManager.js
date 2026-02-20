const config = require('../config');
const { sendLog } = require('../utils/logger');

const activityTimers = new Map();

function startActivityTimer(member) {

  const guildId = member.guild.id;
  const userId = member.id;

  // clear existing timer
  if (activityTimers.has(userId)) {
    clearTimeout(activityTimers.get(userId));
  }

  const timer = setTimeout(async () => {
    try {

      const guild = await member.client.guilds.fetch(guildId);
      const freshMember = await guild.members.fetch(userId).catch(() => null);

      if (!freshMember) {
        activityTimers.delete(userId);
        return;
      }

      const memberRole = guild.roles.cache.find(
        r => r.name === config.MEMBER_ROLE
      );

      if (memberRole && freshMember.roles.cache.has(memberRole.id)) {
        await freshMember.roles.remove(memberRole).catch(() => { });
      }

      try {
        await freshMember.send("🔒 Logged out due to inactivity.");
      } catch { }

      await sendLog(guild, `⏰ **${freshMember.user.tag}** logged out (inactivity)`);

    } catch (err) {
      console.error("Activity timer failed:", err);
    }

    activityTimers.delete(userId);

  }, config.TIMEOUT);

  activityTimers.set(userId, timer);
}

function clearUserTimer(userId) {
  if (activityTimers.has(userId)) {
    clearTimeout(activityTimers.get(userId));
    activityTimers.delete(userId);
  }
}

module.exports = { startActivityTimer, clearUserTimer };