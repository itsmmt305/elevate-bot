const { addTask, getTasks, removeTask } = require('../utils/taskStorage');

async function handleTaskCommand(message) {

  const [command, ...args] = message.content.slice(1).split(" ");
  const userId = message.author.id;

  /* ---------------- COMMIT ---------------- */
  if (command === "commit") {

    const text = args.join(" ");
    if (!text) return message.reply("Provide a task.");

    await addTask(userId, text);
    return message.reply(`Task added: ${text}`);
  }

  /* ---------------- PULL ---------------- */
  if (command === "pull") {

    const tasks = await getTasks(userId);
    if (tasks.length === 0)
      return message.reply("No tasks today.");

    let list = `**${message.author.username}'s Tasks**\n`;
    tasks.forEach((t, i) => {
      list += `${i + 1}. ${t}\n`;
    });

    return message.reply(list);
  }

  /* ---------------- REMOVE ---------------- */
  if (command === "rm") {

    const index = parseInt(args[0]) - 1;
    if (isNaN(index))
      return message.reply("Provide a valid task number.");

    await removeTask(userId, index);
    return message.reply("Task removed.");
  }
}

module.exports = { handleTaskCommand };
