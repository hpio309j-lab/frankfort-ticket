const { Events } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;
        if (!message.guild) return; // Ignore DMs

        // Check for saved reply triggers
        const messageContent = message.content.toLowerCase().trim();
        const savedReply = await db.prepare('SELECT * FROM saved_replies WHERE guild_id = ? AND LOWER(trigger) = ?')
            .get(message.guild.id, messageContent);

        if (savedReply) {
            await message.reply(savedReply.content);
            console.log(`[💬 رد تلقائي] تم الرد على "${savedReply.trigger}" في #${message.channel.name}`);
            return; // Don't log this as a ticket message
        }

        // Check if channel is a ticket channel (in DB)
        const ticketInfo = await db.prepare('SELECT ticket_id FROM tickets WHERE channel_id = ? AND status = ?').get(message.channel.id, 'open');

        if (!ticketInfo) return;

        // Log Message in ticket
        await db.prepare('INSERT INTO messages (ticket_id, author_id, content) VALUES (?, ?, ?)')
            .run(ticketInfo.ticket_id, message.author.id, message.content);

        // Track support first response time
        const ticket = await db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketInfo.ticket_id);
        if (ticket && message.author.id !== ticket.user_id && !ticket.first_response_at) {
            await db.prepare('UPDATE tickets SET first_response_at = CURRENT_TIMESTAMP WHERE ticket_id = ?').run(ticket.ticket_id);
            console.log(`[⏱️ أول استجابة] تم تسجيل أول استجابة من ${message.author.tag} للتذكرة #${ticket.ticket_id}`);
        }
    },
};
