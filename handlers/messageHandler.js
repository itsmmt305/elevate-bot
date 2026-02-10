const config = require('../config');
const { startActivityTimer } = require('./activityManager');
const { notifyMentionedUsers } = require('./mentionNotifier');

async function handleMessage(message) {

  if (!message.guild || message.author.bot) return;

  await notifyMentionedUsers(message);

  const memberRole = message.guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);
  if (!memberRole) return;

  const member = message.member;
  if (!member.roles.cache.has(memberRole.id)) return;

  startActivityTimer(member);
}

module.exports = { handleMessage };