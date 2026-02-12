const { addTask, getTasks, removeTask, completeTask } = require('../utils/taskStorage');
const { getScore, resetUser } = require('../utils/scoreStorage');

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

    let target = message.mentions.users.first() || message.author;
    const userId = target.id;

    const tasks = await getTasks(userId);
    const score = await getScore(userId);

    let list = `📋 **${target.username}'s Tasks**\n`;
    list += `⭐ Score: **${score}**\n\n`;

    if (tasks.length === 0) {
        list += "_No tasks recorded today._";
    } else {
        tasks.forEach((t, i) => {

        if (typeof t === "string") {
            list += `${i + 1}. ${t}\n`;
            return;
        }

        const mark = t.done ? "✅ " : "";
        list += `${i + 1}. ${mark}${t.text}\n`;
        });

    }

    await message.reply(list);

    /* ACCOUNTABILITY CHECK */
    if (target.id !== message.author.id) {
        try {
        const member = await message.guild.members.fetch(target.id);

        const memberRole = message.guild.roles.cache.find(r => r.name === "member");

        if (!member.roles.cache.has(memberRole.id)) {
            await target.send("🚨 ACCOUNTABILITY CHECK");
        }

        } catch {}
    }

    return;
    }

      /* ---------------- PUSH (COMPLETE TASK) ---------------- */
  if (command === "push") {

    const index = parseInt(args[0]) - 1;

    if (isNaN(index))
      return message.reply("Provide a valid task number.");

    const success = await completeTask(userId, index);

    if (!success)
      return message.reply("Task not found.");

    return message.reply("✅ Task marked complete.");
  }


    /* ---------------- RESET USER ---------------- */
    if (command === "reset") {

    if (!message.member.permissions.has("Administrator"))
        return message.reply("You are not authorized.");

    const target = message.mentions.users.first();
    if (!target)
        return message.reply("Mention a user to reset.");

    await resetUser(target.id);

    return message.reply(`Stats reset for ${target.username}.`);
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
