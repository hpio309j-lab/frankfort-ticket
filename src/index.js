require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initDb } = require('./db/schema');
const { startTicketAlerts } = require('./utils/ticketAlerts');

initDb();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commands = [];

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
} else {
    fs.mkdirSync(commandsPath, { recursive: true });
}

const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, async (...args) => {
                try { await event.execute(...args); } catch (err) { console.error('[Error]', err.message); }
            });
        } else {
            client.on(event.name, async (...args) => {
                try { await event.execute(...args); } catch (err) { console.error('[Error]', err.message); }
            });
        }
    }
} else {
    fs.mkdirSync(eventsPath, { recursive: true });
}

process.on('unhandledRejection', (error) => {
    console.error('[Error] Unhandled Rejection:', error.message || error);
});

process.on('uncaughtException', (error) => {
    console.error('[Error] Uncaught Exception:', error.message || error);
});

client.on('error', (error) => {
    console.error('[Error] Client Error:', error.message || error);
});

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
        }

        console.log(`Successfully reloaded application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();

client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
    startTicketAlerts(client);
});
