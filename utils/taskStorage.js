const { Redis } = require("@upstash/redis");
const { getISTDateKey } = require("./dateHelper");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function tasksKey(userId) {
  return `tasks:${userId}:${getISTDateKey()}`;
}

/* ---------------- GET TASKS ---------------- */
async function getTasks(userId) {

  let tasks = await redis.get(tasksKey(userId));

  if (!tasks) return [];

  // migrate old string tasks -> object tasks
  tasks = tasks.map(t => {
    if (typeof t === "string") {
      return { text: t, done: false };
    }
    return t;
  });

  return tasks;
}

/* ---------------- SAVE TASKS ---------------- */
async function saveTasks(userId, tasks) {
  await redis.set(tasksKey(userId), tasks);
}

/* ---------------- ADD TASK ---------------- */
async function addTask(userId, text) {

  const tasks = await getTasks(userId);

  tasks.push({
    text: text,
    done: false
  });

  await saveTasks(userId, tasks);
}

/* ---------------- REMOVE TASK ---------------- */
async function removeTask(userId, index) {

  const tasks = await getTasks(userId);

  if (index < 0 || index >= tasks.length) return false;

  tasks.splice(index, 1);

  await saveTasks(userId, tasks);
  return true;
}

/* ---------------- COMPLETE TASK ---------------- */
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
  completeTask,
  saveTasks
};
