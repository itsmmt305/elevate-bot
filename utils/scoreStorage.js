const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require("./dateHelper");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/* ---------------- SCORE ---------------- */

function scoreKey(userId) {
  return `score:${userId}:${getISTDateKey()}`;
}

async function getScore(userId) {
  const s = await redis.get(scoreKey(userId));
  return s ?? 0;
}

async function setScore(userId, value) {
  await redis.set(scoreKey(userId), value);
}

/* ---------------- STREAK ---------------- */

function streakKey(userId) {
  return `streak:${userId}`;
}

async function getStreak(userId) {
  const s = await redis.get(streakKey(userId));
  return s ?? 0;
}

async function setStreak(userId, value) {
  await redis.set(streakKey(userId), value);
}

async function incrementStreak(userId) {
  const current = await getStreak(userId);
  await setStreak(userId, current + 1);
}

async function resetStreak(userId) {
  await setStreak(userId, 0);
}

/* ---------------- RESET USER ---------------- */

async function resetUser(userId) {
  const date = getISTDateKey();

  await redis.del(`tasks:${userId}:${date}`);
  await redis.del(`score:${userId}:${date}`);
  await redis.del(`stash:${userId}`);
  await redis.del(`checkout:${userId}:${date}`);
  await redis.del(`streak:${userId}`);
}

module.exports = {
  getScore,
  setScore,
  getStreak,
  setStreak,
  incrementStreak,
  resetStreak,
  resetUser
};
