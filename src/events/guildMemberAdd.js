const { Events } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const guildId = member.guild.id;

        // Get welcome configuration
        const config = await db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);

        if (!config || !config.enabled || !config.channel_id) {
            return; // Welcome system not configured or disabled
        }

        // Get welcome channel
        const channel = member.guild.channels.cache.get(config.channel_id);
        if (!channel) {
            console.log(`[⚠️ ترحيب] قناة الترحيب غير موجودة في ${member.guild.name}`);
            return;
        }

        // Replace variables in message
        let welcomeMessage = config.message
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());

        try {
            await channel.send(welcomeMessage);
            console.log(`[👋 ترحيب] تم الترحيب بـ ${member.user.tag} في #${channel.name}`);
        } catch (error) {
            console.error(`[❌ خطأ ترحيب] فشل إرسال رسالة الترحيب:`, error);
        }
    },
};
