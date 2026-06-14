const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../db/schema');

/**
 * Generates the Admin Panel Embed and Components for a specific ticket.
 * @param {string} userId - The ID of the user who owns the ticket.
 * @param {string} ticketId - The database ID of the ticket.
 * @returns {Promise<{embeds: Array, components: Array}>}
 */
async function generateAdminPanel(userId, ticketId) {
    const user = await db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    const historyCount = await db.prepare('SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = ?').get(userId, 'closed');
    const notes = await db.prepare('SELECT * FROM notes WHERE ticket_id = ?').all(ticketId);
    const ticket = await db.prepare('SELECT category, claimed_by FROM tickets WHERE ticket_id = ?').get(ticketId);

    const embed = new EmbedBuilder()
        .setTitle('🛡️ لوحة تحكم الإدارة')
        .setColor('#2B2D31')
        .addFields(
            { name: '👤 المستخدم', value: `<@${userId}>`, inline: true },
            { name: '🏷️ القسم', value: `${ticket?.category === 'tech' ? 'دعم فني' : ticket?.category === 'admin' ? 'إدارة' : 'عام'}`, inline: true },
            { name: '📜 تذاكر سابقة', value: `${historyCount.count} مغلقة`, inline: true },
            { name: '🆔 رقم التذكرة', value: `#${ticketId}`, inline: true },
            { name: '🕒 عضو منذ', value: `<t:${Math.floor(new Date(user?.created_at || Date.now()).getTime() / 1000)}:R>`, inline: true },
            { name: '🙋‍♂️ المستلم', value: ticket?.claimed_by ? `<@${ticket.claimed_by}>` : 'لم يتم الاستلام بعد', inline: true }
        );

    if (notes.length > 0) {
        const notesContent = notes.map(n => `• ${n.note_content} (<@${n.admin_id}>)`).join('\n');
        embed.addFields({ name: '🔒 ملاحظات إدارية', value: notesContent.substring(0, 1024) });
    } else {
        embed.addFields({ name: '🔒 ملاحظات إدارية', value: 'لا يوجد ملاحظات.' });
    }

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`claim_${ticketId}`)
            .setLabel('استلام')
            .setEmoji('🙋‍♂️')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`summon_${ticketId}`)
            .setLabel('استدعاء')
            .setEmoji('🔔')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`history_${userId}`)
            .setLabel('السجل')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`transcript_${ticketId}`)
            .setLabel('النسخة')
            .setEmoji('📄')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`note_${ticketId}`)
            .setLabel('إضافة ملاحظة')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`close_${ticketId}`)
            .setLabel('إغلاق')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1, row2] };
}

module.exports = { generateAdminPanel };
