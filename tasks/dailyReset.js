const cron = require('node-cron');
const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require('../utils/dateHelper');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 5:00 AM IST
cron.schedule('30 23 * * *', async () => {
  console.log("Daily reset running");

  // Here later we:
  // calculate scores
  // assign penalties
  // move stash
});
