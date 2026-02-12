const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require("./dateHelper");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function scoreKey(userId) {
  return `score:${userId}:${getISTDateKey()}`;
}

async function getScore(userId) {
  const s = await redis.get(scoreKey(userId));
  return s ?? 0; // always show 0 if missing
}

async function setScore(userId, value) {
  await redis.set(scoreKey(userId), value);
}

async function resetUser(userId) {
  const date = getISTDateKey();
  await redis.del(`tasks:${userId}:${date}`);
  await redis.del(`score:${userId}:${date}`);
  await redis.del(`stash:${userId}:${date}`);
}

module.exports = {
  getScore,
  setScore,
  resetUser
};
