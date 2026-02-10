const config = require('../config');

async function notifyMentionedUsers(message) {

  const guild = message.guild;
  if (!guild) return;

  const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);
  if (!memberRole) return;

  let content = message.content?.trim();

  if (!content && message.attachments.size > 0)
    content = "[Attachment sent]";

  if (content) {

    // Replace mention tokens with usernames
    content = content.replace(/<@!?(\d+)>/g, (match, id) => {
      const user = message.client.users.cache.get(id);
      if (user) return `@${user.username}`;
      return "@unknown-user";
    });

    content = content.replace(/`/g, "'");

  } else {
    content = "[No text content]";
  }

  for (const [, user] of message.mentions.users) {

    if (user.bot) continue;
    if (user.id === message.author.id) continue;

    try {
      const mentionedMember = await guild.members.fetch(user.id);
      if (mentionedMember.roles.cache.has(memberRole.id)) continue;

      await user.send(
`📣 ${message.author.username} calls upon you in #${message.channel.name}

\`${content}\``
      );

    } catch {}
  }
}

module.exports = { notifyMentionedUsers };
