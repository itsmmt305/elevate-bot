const { addTask, getTasks, removeTask, completeTask } = require('../utils/taskStorage');
const { getScore, getStreak, resetUser } = require('../utils/scoreStorage');

async function handleTaskCommand(message) {

  if (!message.content.startsWith("!")) return;

  const [command, ...args] = message.content.slice(1).split(" ");
  const userId = message.author.id;

  /* COMMIT */
  if (command === "commit") {
    const text = args.join(" ");
    if (!text) return message.reply("Provide a task.");

    await addTask(userId, text);
    return message.reply(`Task added: ${text}`);
  }

  /* PUSH */
  if (command === "push") {

    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) return message.reply("Provide a valid task number.");

    const success = await completeTask(userId, index);
    if (!success) return message.reply("Task not found.");

    return message.reply("✅ Task marked complete.");
  }

  /* REMOVE */
  if (command === "rm") {

    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) return message.reply("Provide a valid task number.");

    const success = await removeTask(userId, index);
    if (!success) return message.reply("Task not found.");

    return message.reply("Task removed.");
  }

  /* PULL */
  if (command === "pull") {

    let target = message.mentions.users.first() || message.author;
    const targetId = target.id;

    const tasks = await getTasks(targetId);
    const score = await getScore(targetId);
    const streak = await getStreak(targetId);

    let list = `📋 **${target.username}'s Tasks**\n`;
    list += `⭐ Score: **${score}**\n`;
    list += `🔥 Streak: **${streak} days**\n\n`;

    if (tasks.length === 0) {
      list += "_No tasks recorded today._";
    } else {
      tasks.forEach((t, i) => {
        const mark = t.done ? "✅ " : "";
        list += `${i + 1}. ${mark}${t.text}\n`;
      });
    }

    await message.reply(list);
    return;
  }

  /* RESET */
  if (command === "reset") {

    if (!message.member.permissions.has("Administrator"))
      return message.reply("You are not authorized.");

    const target = message.mentions.users.first();
    if (!target)
      return message.reply("Mention a user to reset.");

    await resetUser(target.id);
    return message.reply(`Stats reset for ${target.username}.`);
  }
}

module.exports = { handleTaskCommand };
