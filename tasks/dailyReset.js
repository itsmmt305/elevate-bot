const cron = require('node-cron');
const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require('../utils/dateHelper');
const { processDailyStats } = require('../utils/statsProcessor');

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
          // Just clear the data
          await redis.del(key);
          await redis.del(checkoutKey);
        } else {
          console.log(`User ${userId} did NOT check out. Auto-processing.`);

          // Fetch necessary data
          const tasks = await redis.get(key) || [];

          // Try to find user and guild to report
          // We'll iterate guilds to find where the user is present and where the channel exists
          let user = null;
          try {
            user = await client.users.fetch(userId);
          } catch (e) {
            console.error(`Could not fetch user ${userId}:`, e.message);
            continue;
          }

          // We assume the bot might be in multiple guilds, but we only need to post in one?
          // Or all common guilds? Let's try to post in any guild that has the stats channel.
          for (const guild of client.guilds.cache.values()) {
            try {
              const member = await guild.members.fetch(userId).catch(() => null);
              if (member) {
                await processDailyStats(guild, user, tasks, yesterday);
                // If we assume one main server, we could break here.
                // But to be safe, we can continue or break. 
                // Let's break to avoid duplicate spam if they are in multiple servers with the bot.
                break;
              }
            } catch (err) {
              console.error(`Error processing guild ${guild.id} for user ${userId}`, err);
            }
          }

          // Clear tasks
          await redis.del(key);
        }

      } catch (err) {
        console.error(`Error processing reset for ${userId}:`, err);
      }
    }

    console.log("DAILY RESET COMPLETE");

  }, {
    timezone: "Asia/Kolkata"
  });
}

module.exports = { startDailyReset };
