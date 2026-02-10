const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function setValue(key, value) {
  await redis.set(key, value);
}

async function getValue(key) {
  return await redis.get(key);
}

module.exports = { setValue, getValue };