const config = require('../config');
const { sendLog } = require('../utils/logger');

const activityTimers = new Map();

function startActivityTimer(member) {

  if (activityTimers.has(member.id))
    clearTimeout(activityTimers.get(member.id));

  const timer = setTimeout(async () => {

    const guild = member.guild;
    const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);

    if (memberRole && member.roles.cache.has(memberRole.id))
      await member.roles.remove(memberRole);

    try { await member.send("🔒 Logged out due to inactivity."); } catch {}

    await sendLog(guild, `⏰ **${member.user.tag}** logged out (inactivity)`);

    activityTimers.delete(member.id);

  }, config.TIMEOUT);

  activityTimers.set(member.id, timer);
}

function clearUserTimer(userId) {
  if (activityTimers.has(userId)) {
    clearTimeout(activityTimers.get(userId));
    activityTimers.delete(userId);
  }
}

module.exports = { startActivityTimer, clearUserTimer };
