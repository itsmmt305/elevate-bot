const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require("./dateHelper");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function taskKey(userId) {
  return `tasks:${userId}:${getISTDateKey()}`;
}

/* ---------------- LOAD ---------------- */
async function getTasks(userId) {
  const data = await redis.get(taskKey(userId));
  if (!data) return [];
  return data;
}

/* ---------------- SAVE ---------------- */
async function saveTasks(userId, tasks) {
  await redis.set(taskKey(userId), tasks);
}

/* ---------------- ADD ---------------- */
async function addTask(userId, text) {
  const tasks = await getTasks(userId);

  tasks.push({
    text: text,
    done: false
  });

  await saveTasks(userId, tasks);
}

/* ---------------- REMOVE ---------------- */
async function removeTask(userId, index) {
  const tasks = await getTasks(userId);

  if (index < 0 || index >= tasks.length) return false;

  tasks.splice(index, 1);

  await saveTasks(userId, tasks);
  return true;
}

/* ---------------- COMPLETE ---------------- */
async function completeTask(userId, index) {
  const tasks = await getTasks(userId);

  if (index < 0 || index >= tasks.length) return false;

  tasks[index].done = true;

  await saveTasks(userId, tasks);
  return true;
}

module.exports = {
  addTask,
  getTasks,
  removeTask,
  completeTask
};
