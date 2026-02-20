const { addTask, getTasks, removeTask, completeTask, startStashTask, getStashedTasks, revertTask, dropStash } = require('../utils/taskStorage');
const { resetPanel } = require('../utils/panel');
const { Redis } = require("@upstash/redis");
const { getScore, getStreak, resetUser, setStreak, setScore } = require('../utils/scoreStorage'); // Ensure setScore/setStreak exported if needed for hard reset (resetUser handles generic, but let's see)
const { processDailyCheckout, isCheckedOut } = require('../utils/statsProcessor');
const { getISTDateKey } = require('../utils/dateHelper');
const config = require('../config');
const {
  setSessionActivity,
  trackTaskRemoval,
  clearGrillFlag,
  FLAGS
} = require('../utils/grillManager');

async function handleTaskCommand(message) {

  if (!message.content.startsWith("!")) return;

  const [command, ...args] = message.content.slice(1).split(" ");
  const userId = message.author.id;
  const guild = message.guild;

  // 1. Identify Command
  // "checkout", "commit", etc. are already parsed into `command`

  // 2. Exception: !pull works everywhere
  const isPull = command === "pull";

  // 3. Channel Check
  const commandChannelName = config.COMMAND_CHANNEL;
  const isCommandChannel = message.channel.name === commandChannelName;

  if (!isPull && !isCommandChannel) {
    // If channel exists, mention it. Only reply if we can find it or just use name.
    const cmdChannel = guild.channels.cache.find(c => c.name === commandChannelName);
    const mention = cmdChannel ? cmdChannel.toString() : `#${commandChannelName}`;

    // Send warning logic
    message.reply(`Please use ${mention}.`)
      .then(replyMsg => {
        // Delete both messages after 10 seconds
        setTimeout(() => {
          replyMsg.delete().catch(() => { });
          message.delete().catch(() => { });
        }, 10000);
      });

    return;
  }

  /* CHECKOUT */
  if (command === "checkout") {
    const dateKey = getISTDateKey();

    // Check if already checked out
    if (await isCheckedOut(userId, dateKey)) {
      return message.reply("⚠️ You have already checked out for today.");
    }

    const tasks = await getTasks(userId);

    // Process stats (updates streak, sends summary, clears tasks, moves stash)
    // Now using processDailyCheckout instead of processDailyStats
    const stats = await processDailyCheckout(guild, message.author, tasks, dateKey);

    return message.reply(`✅ Checkout complete! Streak: **${stats.currentStreak}**. See summary in ${config.SESSION_PROGRESS_CHANNEL}.`);
  }


  /* COMMIT */
  if (command === "commit") {
    await setSessionActivity(userId); // Activity Hook

    const dateKey = getISTDateKey();

    if (await isCheckedOut(userId, dateKey)) {
      return message.reply("Take some rest, come back tomorrow.");
    }

    // --signoff CHECK
    if (args.includes("--signoff")) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      const signoffKey = `signoff:${userId}:${dateKey}`;
      const hasSignedOff = await redis.get(signoffKey);

      if (hasSignedOff) {
        return message.reply(`Changes shall show at checkout, in the ${config.SESSION_PROGRESS_CHANNEL} channel`);
      }

      // Mark as signed off
      await redis.set(signoffKey, "true", { ex: 24 * 60 * 60 }); // 24h expiry

      // Generate list (reuse pull logic)
      const tasks = await getTasks(userId);
      const stashed = await getStashedTasks(userId);
      const score = await getScore(userId);
      const streak = await getStreak(userId);

      let list = `📋 **${message.author.username}'s Tasks**\n`;
      list += `⭐ Score: **${score}**\n`;
      list += `🔥 Streak: **${streak} days**\n\n`;

      if (tasks.length === 0) {
        list += "_No tasks recorded today._\n";
      } else {
        tasks.forEach((t, i) => {
          const mark = t.done ? " ✅" : " ⬜";
          const origin = t.stashed ? " ↩️" : "";
          list += `${mark} ${i + 1}. ${t.text}${origin}\n`;
        });
      }

      if (stashed.length > 0) {
        list += `\n📦 **Stashed (Up Next):**\n`;
        stashed.forEach((t, i) => {
          list += `• ${t.text}\n`;
        });
      }

      // Send to PLANNING_CHANNEL
      const planningChannelName = config.PLANNING_CHANNEL;
      const planningChannel = guild.channels.cache.find(c => c.name === planningChannelName);

      if (planningChannel) {
        await planningChannel.send(list);
        return message.reply(`✅ Signed off for the day! List posted in ${planningChannel}.`);
      } else {
        return message.reply("⚠️ Planning channel not found in config or server.");
      }
    }

    const text = args.join(" ");
    if (!text) return message.reply("Provide a task.");

    await addTask(userId, text);
    // !commit defines activity
    return message.reply(`Task added: ${text}`);
  }

  /* PUSH */
  if (command === "push") {
    await setSessionActivity(userId); // Activity Hook

    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) return message.reply("Provide a valid task number.");

    const success = await completeTask(userId, index);
    if (!success) return message.reply("Task not found.");

    // Streak Repair Hook
    await clearGrillFlag(userId, FLAGS.STREAK_MISSED);

    return message.reply("✅ Task marked complete.");
  }

  /* REVERT */
  if (command === "revert") {
    await setSessionActivity(userId);

    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) return message.reply("Provide a valid task number.");

    const success = await revertTask(userId, index);
    if (!success) return message.reply("Task not found.");

    return message.reply("Task marked as incomplete.");
  }

  /* STASH */
  if (command === "stash") {
    await setSessionActivity(userId); // Activity Hook

    if (args.includes("--drop")) {
      const droppedCount = await dropStash(userId);
      if (droppedCount === 0) return message.reply("Stash is empty.");
      return message.reply(`📦 Moved ${droppedCount} items from stash to your main list.`);
    }

    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) return message.reply("Provide a valid task number.");

    const success = await startStashTask(userId, index);
    if (!success) return message.reply("Task not found.");

    return message.reply("📦 Task stashed for tomorrow.");
  }

  /* REMOVE */
  if (command === "rm") {
    await setSessionActivity(userId); // Activity Hook

    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) return message.reply("Provide a valid task number.");

    const success = await removeTask(userId, index);
    if (!success) return message.reply("Task not found.");

    // Grill Hook
    await trackTaskRemoval(guild, userId);

    return message.reply("Task removed.");
  }

  /* PULL */
  if (command === "pull") {

    let target = message.mentions.users.first() || message.author;
    const targetId = target.id;

    // ACCOUNTABILITY CHECK
    // If pulling someone else's list
    if (targetId !== userId) {
      try {
        const member = await guild.members.fetch(targetId);
        const memberRole = guild.roles.cache.find(r => r.name === config.MEMBER_ROLE);

        // If role exists and user doesn't have it -> Logged Out
        if (memberRole && !member.roles.cache.has(memberRole.id)) {
          await target.send("🚨 ACCOUNTABILITY CHECK").catch(() => {
            message.channel.send(`(Could not DM ${target.username} for accountability check)`);
          });
        }
      } catch (e) {
        console.error("Accountability check failed:", e);
      }
    }

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
        const mark = t.done ? " ✅" : " ⬜";
        const origin = t.stashed ? " ↩️" : ""; // Symbol indicating carried over
        list += `${mark} ${i + 1}. ${t.text}${origin}\n`;
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
      // Also clear signoff flag for today
      await redis.del(`signoff:${target.id}:${dateKey}`);
      // Also clear score delta
      await redis.del(`daily_score_delta:${target.id}:${dateKey}`);

      return message.reply(`☢️ HARD reset complete for ${target.username}.`);
    } else if (isSoft) {
      // Daily reset (tasks + checkout) + Score Reversion
      const dateKey = getISTDateKey();
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      // CHECK IF ALREADY CHECKED OUT
      if (await isCheckedOut(target.id, dateKey)) {
        const deltaKey = `daily_score_delta:${target.id}:${dateKey}`;
        const delta = await redis.get(deltaKey);

        if (delta) {
          const currentScore = await getScore(target.id);
          const newScore = currentScore - parseInt(delta);
          await setScore(target.id, newScore);

          await redis.del(deltaKey);
        }

        // Decrement streak by 1 since we are reverting checkout
        const currentStreak = await getStreak(target.id);
        if (currentStreak > 0) {
          await setStreak(target.id, currentStreak - 1);
        }

        await redis.del(`checkout:${target.id}:${dateKey}`);
      }

      await redis.del(`tasks:${target.id}:${dateKey}`);
      await redis.del(`signoff:${target.id}:${dateKey}`);
      await redis.del(`stash:${target.id}`);

      return message.reply(`🧹 SOFT reset (score reverted if checked out) complete for ${target.username}.`);
    } else {
      return message.reply("Please specify `--hard` (full wipe) or `--soft` (today's tasks only).");
    }
  }

  /* PANEL RESET */
  if (command === "panel-reset") {

    if (!message.member.permissions.has("Administrator"))
      return message.reply("You are not authorized.");

    const accessChannel = guild.channels.cache.find(c => c.name === config.ACCESS_CHANNEL);
    if (!accessChannel) return message.reply("Access channel not found.");

    await resetPanel(accessChannel);
    return message.reply("✅ Panel reset and recreated.");
  }
}

module.exports = { handleTaskCommand };
