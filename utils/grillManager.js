const { Redis } = require("@upstash/redis");
require('dotenv').config();
const config = require('../config');
const fs = require('fs');
const path = require('path');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

let grills = {};

try {
    const grillsPath = path.join(__dirname, '../grill/grills.json');
    if (fs.existsSync(grillsPath)) {
        const raw = fs.readFileSync(grillsPath);
        grills = JSON.parse(raw);
    } else {
        console.error("grills.json not found at " + grillsPath);
    }
} catch (e) {
    console.error("Failed to load grills.json:", e.message);
}

// Flags
const FLAGS = {
    OPEN_APP_NO_ACTION: "opened_app_no_action",
    INCOMPLETE_TASKS: "incomplete_tasks",
    TOMORROW_NOT_DONE: "tomorrow_not_done",
    STREAK_MISSED: "streak_missed",
    NO_LOGIN: "no_login",
    FREQUENT_TASK_REMOVAL: "frequent_task_removal"
};

function getGrillKey(userId, flag) {
    return `grill_flag:${userId}:${flag}`;
}

async function setGrillFlag(userId, flag, value = "true") {
    await redis.set(getGrillKey(userId, flag), value);
}

async function getGrillFlag(userId, flag) {
    return await redis.get(getGrillKey(userId, flag));
}

async function clearGrillFlag(userId, flag) {
    await redis.del(getGrillKey(userId, flag));
}

/**
 * Sends a grill message to the grill channel.
 * @param {object} guild 
 * @param {string} userId 
 * @param {string} category 
 */
async function sendGrillMessage(guild, userId, category) {
    const messages = grills[category];
    if (!messages || messages.length === 0) return;

    const randomMsg = messages[Math.floor(Math.random() * messages.length)];

    // Find channel
    const channel = guild.channels.cache.find(c => c.name === config.GRILL_CHANNEL);
    if (!channel) {
        console.log(`Grill channel ${config.GRILL_CHANNEL} not found.`);
        return;
    }

    try {
        await channel.send(`<@${userId}>\n**${category}**\n${randomMsg}`);
    } catch (e) {
        console.error("Failed to send grill message:", e.message);
    }
}

/**
 * Checks if a flag is set, sends a message if so, and clears the flag (optional).
 * @param {object} guild 
 * @param {string} userId 
 * @param {string} category 
 * @param {boolean} clearAfter 
 */
async function checkAndGrill(guild, userId, category, clearAfter = true) {
    const isSet = await getGrillFlag(userId, category);
    if (isSet) {
        await sendGrillMessage(guild, userId, category);
        if (clearAfter) {
            await clearGrillFlag(userId, category);
        }
    }
}

// Session Activity Tracking
const SESSION_ACTIVITY_KEY = (userId) => `session_activity:${userId}`;

async function setSessionActivity(userId) {
    await redis.set(SESSION_ACTIVITY_KEY(userId), "true");
}

async function clearSessionActivity(userId) {
    await redis.del(SESSION_ACTIVITY_KEY(userId));
}

async function getSessionActivity(userId) {
    return await redis.get(SESSION_ACTIVITY_KEY(userId));
}

// Task Removal Tracking
async function trackTaskRemoval(guild, userId) {
    const key = `rm_count:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
        await redis.expire(key, 86400);
    }

    if (count > 3) {
        await sendGrillMessage(guild, userId, FLAGS.FREQUENT_TASK_REMOVAL);
        await redis.del(key); // Reset after insult
        return true;
    }
    return false;
}

module.exports = {
    FLAGS,
    setGrillFlag,
    getGrillFlag,
    clearGrillFlag,
    sendGrillMessage,
    checkAndGrill,
    setSessionActivity,
    clearSessionActivity,
    getSessionActivity,
    trackTaskRemoval
};
