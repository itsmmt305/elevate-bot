const cron = require('node-cron');
const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require('../utils/dateHelper');
const { incrementStreak, resetStreak } = require('../utils/scoreStorage');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/*
Runs every day at 5:00 AM IST
*/
cron.schedule('0 5 * * *', async () => {

  console.log("DAILY RESET RUNNING");

  const today = getISTDateKey();

  // find all users who had task keys
  const keys = await redis.keys(`tasks:*:${today}`);

  for (const key of keys) {

    const parts = key.split(":");
    const userId = parts[1];

    const tasks = await redis.get(key) || [];

    if (tasks.length === 0) {
      await resetStreak(userId);
      console.log(`Streak broken for ${userId}`);
    } else {
      await incrementStreak(userId);
      console.log(`Streak increased for ${userId}`);
    }

    // clear tasks for next day
    await redis.del(key);
  }

  console.log("DAILY RESET COMPLETE");

}, {
  timezone: "Asia/Kolkata"
});
