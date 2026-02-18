const config = require('../config');
const { Redis } = require("@upstash/redis");
const { incrementStreak, resetStreak, getStreak, getScore, setScore, setStreak } = require('./scoreStorage');
const { getNextDateKey } = require('./dateHelper');

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

// Unified checkout processing logic
async function processDailyCheckout(guild, user, tasks, dateKey) {
    // 1. Calculate stats logic
    const total = tasks.length;
    let completed = 0;

    // Score Calculation
    let dailyScoreChange = 0;

    tasks.forEach(t => {
        if (t.done) {
            completed++;
            if (t.stashed) dailyScoreChange += 10;
            else dailyScoreChange += 20;
        } else {
            dailyScoreChange -= 5;
        }
    });

    // 2. Update Streak
    // Increment ONLY if at least one task is completed.
    if (completed > 0) {
        await incrementStreak(user.id);
    } else {
        // No completed tasks -> Streak reset
        await resetStreak(user.id);
    }

    // 3. Update Score (Persistent)
    let currentScore = await getScore(user.id);
    currentScore += dailyScoreChange;
    await setScore(user.id, currentScore);

    // 4. Store Score Delta (for Soft Reset reversion)
    const deltaKey = `daily_score_delta:${user.id}:${dateKey}`;
    await redis.set(deltaKey, dailyScoreChange);

    const currentStreak = await getStreak(user.id);

    // 5. Mark as checked out
    await redis.set(getCheckoutKey(user.id, dateKey), "true");

    // 6. Handle Stashed Tasks (Move current stash to NEXT DAY)
    const nextDateKey = getNextDateKey(dateKey);
    const stashKey = `stash:${user.id}`;
    const stash = await redis.get(stashKey);

    if (stash && stash.length > 0) {
        const nextTasksKey = `tasks:${user.id}:${nextDateKey}`;
        const nextTasks = await redis.get(nextTasksKey) || [];

        stash.forEach(t => {
            t.stashed = true; // Mark as carried over
            t.done = false;   // Reset status
            nextTasks.push(t);
        });

        await redis.set(nextTasksKey, nextTasks);
        await redis.del(stashKey); // Clear stash after moving
    }

    // 7. Send Summary to Channel
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
                const stashIcon = t.stashed ? " ↩️" : "";
                msg += `${icon} ${i + 1}. ${t.text}${stashIcon}\n`;
            });
        } else {
            msg += "_No tasks tracked today._";
        }

        await progressChannel.send(msg);
    } else {
        console.log(`Channel ${config.SESSION_PROGRESS_CHANNEL} not found.`);
    }

    // 8. Cleanup Current Day's Tasks (Save space)
    const currentTasksKey = `tasks:${user.id}:${dateKey}`;
    await redis.del(currentTasksKey);

    return { completed, total, currentStreak, currentScore };
}

module.exports = { processDailyCheckout, isCheckedOut };
