const { addTask, getTasks, removeTask, completeTask, startStashTask, getStashedTasks } = require('../utils/taskStorage');
const { getScore, getStreak, resetUser, setStreak, setScore } = require('../utils/scoreStorage'); // Ensure setScore/setStreak exported if needed for hard reset (resetUser handles generic, but let's see)
const { processDailyStats, isCheckedOut } = require('../utils/statsProcessor');
const { getISTDateKey } = require('../utils/dateHelper');
const { Redis } = require("@upstash/redis"); // Needed for checking out reset? Or just use helper functions

async function handleTaskCommand(message) {

  if (!message.content.startsWith("!")) return;

  const [command, ...args] = message.content.slice(1).split(" ");
  const userId = message.author.id;
  const guild = message.guild;

  /* CHECKOUT */
  if (command === "checkout") {
    const dateKey = getISTDateKey();

    // Check if already checked out
    if (await isCheckedOut(userId, dateKey)) {
      return message.reply("⚠️ You have already checked out for today.");
    }

    const tasks = await getTasks(userId);

    // Process stats (updates streak, sends summary)
    const stats = await processDailyStats(guild, message.author, tasks, dateKey);

    return message.reply(`✅ Checkout complete! Streak: **${stats.currentStreak}**. See summary in session-progress.`);
  }

  /* COMMIT */
  if (command === "commit") {
    const dateKey = getISTDateKey();

    if (await isCheckedOut(userId, dateKey)) {
      return message.reply("Take some rest, come back tomorrow.");
    }

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

  /* STASH */
  if (command === "stash") {
    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) return message.reply("Provide a valid task number.");

    const success = await startStashTask(userId, index);
    if (!success) return message.reply("Task not found.");

    return message.reply("📦 Task stashed for tomorrow.");
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
    const stashed = await getStashedTasks(targetId);
    const score = await getScore(targetId);
    const streak = await getStreak(targetId);

    let list = `📋 **${target.username}'s Tasks**\n`;
    list += `⭐ Score: **${score}**\n`;
    list += `🔥 Streak: **${streak} days**\n\n`;

    if (tasks.length === 0) {
      list += "_No tasks recorded today._\n";
    } else {
      tasks.forEach((t, i) => {
        const mark = t.done ? " ✅" : "";
        const origin = t.stashed ? " ↩️" : ""; // Symbol indicating carried over
        list += `${i + 1}. ${t.text}${mark}${origin}\n`;
      });
    }

    if (stashed.length > 0) {
      list += `\n📦 **Stashed (Up Next):**\n`;
      stashed.forEach((t, i) => {
        list += `• ${t.text}\n`;
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

    const isHard = args.includes("--hard");
    const isSoft = args.includes("--soft");

    if (isHard) {
      // Full wipe
      await resetUser(target.id);
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      // Also clear any stash
      await redis.del(`stash:${target.id}`);
      // Also clear checkout flag for today
      const dateKey = getISTDateKey();
      await redis.del(`checkout:${target.id}:${dateKey}`);

      return message.reply(`☢️ HARD reset complete for ${target.username}.`);
    } else if (isSoft) {
      // Daily reset only (tasks + checkout)
      const dateKey = getISTDateKey();
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.del(`tasks:${target.id}:${dateKey}`);
      await redis.del(`checkout:${target.id}:${dateKey}`);

      return message.reply(`🧹 SOFT reset (today only) complete for ${target.username}.`);
    } else {
      return message.reply("Please specify `--hard` (full wipe) or `--soft` (today's tasks only).");
    }
  }
}

module.exports = { handleTaskCommand };
