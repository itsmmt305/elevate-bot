const cron = require('node-cron');
const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require('../utils/dateHelper');
const { processDailyCheckout } = require('../utils/statsProcessor');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/*
Runs every day at 7:00 AM IST
*/
function startDailyReset(client) {
  cron.schedule('0 7 * * *', async () => {

    console.log("DAILY RESET RUNNING");

    // We need to process the *previous* logical day.
    // Since getISTDateKey() now cuts off at 7am, calling it at 7:00:01 AM returns "Today".
    // We want the key for "Yesterday".

    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    ist.setDate(ist.getDate() - 1); // Go back 24h (roughly) or just 1 day
    const yesterday = ist.toISOString().split("T")[0];

    console.log(`Processing reset for date key: ${yesterday}`);

    // find all users who had task keys for yesterday
    const keys = await redis.keys(`tasks:*:${yesterday}`);

    for (const key of keys) {

      const parts = key.split(":");
      const userId = parts[1];

      try {
        // Check if user already checked out
        const checkoutKey = `checkout:${userId}:${yesterday}`;
        const isCheckedOut = await redis.get(checkoutKey);

        if (isCheckedOut) {
          console.log(`User ${userId} already checked out. Clearing data.`);
          // Just clear the date-specific data to save space
          // Persistent scores/streaks are already safe.
          await redis.del(key);
          await redis.del(checkoutKey);
          await redis.del(`daily_score_delta:${userId}:${yesterday}`); // Also clear delta
        } else {
          console.log(`User ${userId} did NOT check out. Auto-processing.`);

          // Fetch necessary data
          const tasks = await redis.get(key) || [];

          // Try to find user and guild to report
          let user = null;
          try {
            user = await client.users.fetch(userId);
          } catch (e) {
            console.error(`Could not fetch user ${userId}:`, e.message);
            continue;
          }

          // Process in the first guild where user is found
          for (const guild of client.guilds.cache.values()) {
            try {
              const member = await guild.members.fetch(userId).catch(() => null);
              if (member) {
                // This will: update stats, move stash to Today, send report, clear Yesterday's tasks
                await processDailyCheckout(guild, user, tasks, yesterday);
                break;
              }
            } catch (err) {
              console.error(`Error processing guild ${guild.id} for user ${userId}`, err);
            }
          }
        }

      } catch (err) {
        console.error(`Error processing reset for ${userId}:`, err);
      }
    }

    // PART 2: STASH SWEEP
    // processDailyCheckout (if called above) moved stash to Today.
    // However, if users checked out early (e.g. 8pm) and then stashed more items after checkout,
    // those items are still in `stash:{userId}`. We need to move them to Today.

    const today = getISTDateKey(); // This is now 7am+ -> Today
    const stashKeys = await redis.keys("stash:*");

    for (const sKey of stashKeys) {
      const userId = sKey.split(":")[1];
      const stash = await redis.get(sKey);

      if (stash && stash.length > 0) {
        console.log(`Unstashing ${stash.length} tasks for ${userId} (Sweep)`);

        const currentTasksKey = `tasks:${userId}:${today}`;
        const currentTasks = await redis.get(currentTasksKey) || [];

        stash.forEach(t => {
          t.stashed = true;
          t.done = false;
          currentTasks.push(t);
        });

        await redis.set(currentTasksKey, currentTasks);
        await redis.del(sKey);
      }
    }

    console.log("DAILY RESET COMPLETE");

  }, {
    timezone: "Asia/Kolkata"
  });
}

module.exports = { startDailyReset };
