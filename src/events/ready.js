const { ActivityType } = require('discord.js');
const { sendPanels } = require('../utils/panelSender');

module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        console.log('--------------------------------------------');
        console.log('Bot Status: Online');
        console.log(`Bot Name: ${client.user.tag}`);
        console.log(`Bot ID: ${client.user.id}`);
        console.log(`Servers: ${client.guilds.cache.size}`);
        console.log(`Users: ${client.users.cache.size}`);
        console.log(`Ping: ${client.ws.ping}ms`);
        console.log('--------------------------------------------');
        console.log('Live Log Console:');
        console.log('');
        client.user.setPresence({
            activities: [{ name: 'Frankfort Ruturn', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }],
            status: 'idle',
        });

        // Send panels to channels (delete old messages first, then resend)
        setTimeout(() => sendPanels(client), 3000);
    },
};