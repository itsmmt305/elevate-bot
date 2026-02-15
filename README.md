
<div align="center">
  <img src="https://media.discordapp.net/attachments/1063630659796840469/1151676643264626778/elevate_banner.png" alt="Elevate Bot Banner" width="100%">
  
  <h1 align="center">Elevate Bot</h1>

  <p align="center">
    <strong>A Dynamic Gated Access & Productivity Discord Bot</strong>
  </p>

  <p align="center">
    <a href="https://nodejs.org/">
      <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
    </a>
    <a href="https://discord.js.org/">
      <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js">
    </a>
    <a href="https://upstash.com/">
      <img src="https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis">
    </a>
    <a href="https://github.com/kelektiv/node-cron">
      <img src="https://img.shields.io/badge/Scheduling-Node--Cron-000000?style=for-the-badge&logo=clock&logoColor=white" alt="Node-Cron">
    </a>
  </p>
</div>

<br />

# 📖 About The Project

**Elevate Bot** is a specialized Discord bot designed to create a focused, accountable, and productive community environment. It combines strict **gated access control** with a robust **task management system**. By requiring users to actively log in to participate and tracking their daily tasks, streaks, and scores, the bot gamifies productivity and ensures accountability.

## ✨ Key Features

### 🔐 Gated Access & Security
*   **Password Authentication**: Users must sign in via a secure modal or password command to gain access to the server.
*   **Session Management**: Automatic logout after **15 minutes** of inactivity to ensure active participation.
*   **Security logging**: All login/logout events are logged to a dedicated admin channel.

### ✅ Task Management System
*   **Daily Goals**: Users commit tasks for the day and mark them as complete as they progress.
*   **Stash Functionality**: Unfinished tasks can be "stashed" to automatically reappear in the next day's list.
*   **Accountability Checks**: Pulling a user's task list (`!pull @user`) triggers a DM alert if the user is currently offline/logged out.

### 🏆 Gamification & Scoring
Encourage consistency with a built-in scoring engine:
*   **+20 Points**: Completing a fresh task committed today.
*   **+10 Points**: Completing a task carried over from the stash.
*   **-5 Points**: Penalty for any task left incomplete at the end of the day.
*   **Daily Streaks**: Only increment if at least one task is completed for the day.

### ⏰ Automated Reset
*   **7:00 AM Daily Reset**: A cron job automatically processes daily stats, updates streaks, moves stashed tasks, and clears the slate for the new day.

---

# 🛠️ Tech Stack

This project is built using modern JavaScript and cloud-native technologies:

*   **[Node.js](https://nodejs.org/)**: Runtime environment for the bot logic.
*   **[Discord.js](https://discord.js.org/)**: Powerful library for interacting with the Discord API.
*   **[Rest Redis (Upstash)](https://upstash.com/)**: Serverless Redis database for fast, persistent storage of tasks, scores, and sessions.
*   **[Node-Cron](https://www.npmjs.com/package/node-cron)**: Task scheduler for handling the 7:00 AM daily reset.

---

# 🚀 Usage & Commands

All commands are prefixed with `!`.

### 📝 Core User Commands

| Command | Usage | Description |
|:---|:---|:---|
| **Commit** | `!commit <task>` | Add a new task to your daily list.<br>_Example: `!commit Finish React component`_ |
| **Push** | `!push <number>` | Mark a task as **complete**.<br>_Example: `!push 1` (Completes task #1)_ |
| **Pull** | `!pull [user]` | View your tasks, score, and streak. Mention a user to see theirs.<br>_Example: `!pull` or `!pull @Alice`_ |
| **Stash** | `!stash <number>` | Move a task to the **Stash**. It will reappear automatically tomorrow.<br>_Example: `!stash 2`_ |
| **Remove** | `!rm <number>` | Delete a task entirely from your list.<br>_Example: `!rm 3`_ |
| **Checkout** | `!checkout` | **End your day**. Calculates final score, updates streak, and posts a summary report.<br>_Note: You cannot add new tasks after checking out._ |
| **Logout** | `!logout` | Manually sign out of the session immediately. |

### ⚙️ Admin Commands

| Command | Usage | Description |
|:---|:---|:---|
| **Reset** | `!reset --soft @user` | Clears a user's tasks and checkout status **for today only**. |
| **Full Wipe** | `!reset --hard @user` | **Irreversible**. Wipes all data (Score, Streak, Stash, Tasks) for a user. |

---

# 📂 Project Structure

```bash
elevate-bot/
├── 📂 handlers/           # core event logic
│   ├── activityManager.js   # inactivity timeout
│   ├── interactionHandler.js # buttons & modals
│   ├── mentionNotifier.js   # DM alerts
│   └── messageHandler.js    # command routing
├── 📂 tasks/              # scheduled & command logic
│   ├── dailyReset.js        # 7 AM cron job
│   └── tasksCommands.js     # !commit, !push, etc.
├── 📂 utils/              # helper modules
│   ├── scoreStorage.js      # Redis score logic
│   ├── statsProcessor.js    # Daily summaries
│   ├── taskStorage.js       # Task CRUD
│   ├── dateHelper.js        # IST time handling
│   └── panel.js             # Login UI generation
├── config.js              # configuration constants
├── index.js               # entry point
└── package.json           # dependencies
```

---

# ⚡ Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/elevate-bot.git
    cd elevate-bot
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    TOKEN=your_discord_bot_token
    PASSWORD=your_server_password
    UPSTASH_REDIS_REST_URL=your_redis_url
    UPSTASH_REDIS_REST_TOKEN=your_redis_token
    ```

4.  **Bot Setup**
    Ensure your Discord server has the following channels (names configurable in `config.js`):
    *   `🔐-access` (Login panel)
    *   `🤖-bot-commands` (Task commands)
    *   `✅-session-progress` (Daily reports)
    *   `🚨-grilling-area`

5.  **Run the Bot**
    ```bash
    npm start
    ```

---

# 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

<p align="center">
  Built with ❤️ for productivity enthusiasts.
</p>
