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
async function addTask(userId, text, fromStash = false) {
  const tasks = await getTasks(userId);

  tasks.push({
    text: text,
    done: false,
    stashed: fromStash
  });

  await saveTasks(userId, tasks);
}

/* ---------------- STASH ---------------- */
function stashKey(userId) {
  return `stash:${userId}`;
}

async function getStashedTasks(userId) {
  const data = await redis.get(stashKey(userId));
  return data || [];
}

async function startStashTask(userId, index) {
  const tasks = await getTasks(userId);
  if (index < 0 || index >= tasks.length) return false;

  const taskToStash = tasks[index];

  // Remove from current list
  tasks.splice(index, 1);
  await saveTasks(userId, tasks);

  // Add to stash list
  const stash = await getStashedTasks(userId);
  stash.push(taskToStash);
  await redis.set(stashKey(userId), stash);

  return true;
}

async function popStashedTasks(userId) {
  const stash = await getStashedTasks(userId);
  await redis.del(stashKey(userId));
  return stash;
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

/* ---------------- REVERT ---------------- */
async function revertTask(userId, index) {
  const tasks = await getTasks(userId);

  if (index < 0 || index >= tasks.length) return false;

  tasks[index].done = false;

  await saveTasks(userId, tasks);
  return true;
}

/* ---------------- DROP STASH ---------------- */
async function dropStash(userId) {
  const stash = await getStashedTasks(userId);
  if (stash.length === 0) return 0;

  const tasks = await getTasks(userId);

  for (const t of stash) {
    tasks.push(t);
  }

  await saveTasks(userId, tasks);

  // Clear stash
  await redis.del(stashKey(userId));

  return stash.length;
}

module.exports = {
  addTask,
  getTasks,
  removeTask,
  completeTask,
  getStashedTasks,
  startStashTask,
  popStashedTasks,
  revertTask,
  dropStash
};
