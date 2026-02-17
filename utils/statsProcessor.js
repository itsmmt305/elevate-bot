const config = require('../config');
const { Redis } = require("@upstash/redis");
const { incrementStreak, resetStreak, getStreak, getScore, setScore } = require('./scoreStorage');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function getCheckoutKey(userId, dateKey) {
    return `checkout:${userId}:${dateKey}`;
}

async function isCheckedOut(userId, dateKey) {
    const meta = await redis.get(getCheckoutKey(userId, dateKey));
    return !!meta;
}

async function processDailyStats(guild, user, tasks, dateKey) {
    // 1. Calculate stats
    const total = tasks.length;
    const completed = tasks.filter(t => t.done).length;

    // 2. Update Streak & Score
    // Streak logic: Increment ONLY if at least one task is completed.

    if (completed > 0) {
        await incrementStreak(user.id);
    } else {
        // No completed tasks -> Streak reset
        await resetStreak(user.id);
    }

    // Scoring Logic
    // +20 for each completed (fresh)
    // +10 for each completed (stashed)
    // -5 for each uncompleted

    let dailyScoreChange = 0;

    tasks.forEach(t => {
        if (t.done) {
            if (t.stashed) dailyScoreChange += 10;
            else dailyScoreChange += 20;
        } else {
            dailyScoreChange -= 5;
        }
    });

    // Get current score and apply change
    let currentScore = await getScore(user.id);
    currentScore += dailyScoreChange;
    await setScore(user.id, currentScore);

    const currentStreak = await getStreak(user.id);

    // 3. Mark as checked out
    await redis.set(getCheckoutKey(user.id, dateKey), "true");

    // 4. Send Summary to Channel
    const progressChannel = guild.channels.cache.find(
        ch => ch.name === config.SESSION_PROGRESS_CHANNEL && ch.isTextBased()
    );

    if (progressChannel) {
        let msg = `📊 **Daily Session Report: ${user.username}**\n\n`;
        msg += `✅ Completed: **${completed}/${total}**\n`;
        msg += `🔥 Streak: **${currentStreak}**\n`;
        msg += `⭐ Score: **${currentScore}**\n\n`;

        if (tasks.length > 0) {
            msg += "**Tasks:**\n";
            tasks.forEach((t, i) => {
                const icon = t.done ? "✅" : "⬜";
                msg += `${icon} ${i + 1}. ${t.text}\n`;
            });
        } else {
            msg += "_No tasks tracked today._";
        }

        await progressChannel.send(msg);
    } else {
        console.log(`Channel ${config.SESSION_PROGRESS_CHANNEL} not found.`);
    }

    return { completed, total, currentStreak, currentScore };
}

module.exports = { processDailyStats, isCheckedOut };
