const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config');
const { getOrCreatePanel } = require('./utils/panel');
const { handleInteraction } = require('./handlers/interactionHandler');
const { handleMessage } = require('./handlers/messageHandler');
const { startDailyReset } = require('./tasks/dailyReset');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  const guilds = await client.guilds.fetch();

  guilds.forEach(async (g) => {
    const guild = await g.fetch();

    const channel = guild.channels.cache.find(
      ch => ch.name === config.ACCESS_CHANNEL && ch.isTextBased()
    );

    if (!channel) return;

    await getOrCreatePanel(channel);
  });

  startDailyReset(client);
});

client.on(Events.InteractionCreate, handleInteraction);
client.on(Events.MessageCreate, handleMessage);

client.login(process.env.TOKEN);
