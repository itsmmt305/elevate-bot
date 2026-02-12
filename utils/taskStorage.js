const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require("./dateHelper");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function key(userId) {
  return `tasks:${userId}:${getISTDateKey()}`;
}

async function getTasks(userId) {
  return (await redis.get(key(userId))) || [];
}

async function saveTasks(userId, tasks) {
  await redis.set(key(userId), tasks);
}

async function addTask(userId, text) {
  const tasks = await getTasks(userId);
  tasks.push(text);
  await saveTasks(userId, tasks);
}

async function removeTask(userId, index) {
  const tasks = await getTasks(userId);
  tasks.splice(index, 1);
  await saveTasks(userId, tasks);
}

async function completeTask(userId, index) {

  const tasks = await getTasks(userId);

  if (!tasks || index < 0 || index >= tasks.length) return false;

  // convert legacy string tasks into objects if needed
  if (typeof tasks[index] === "string") {
    tasks[index] = { text: tasks[index], done: false };
  }

  tasks[index].done = true;

  await saveTasks(userId, tasks);
  return true;
}

module.exports.completeTask = completeTask;

module.exports = {
  getTasks,
  addTask,
  removeTask,
  saveTasks
};