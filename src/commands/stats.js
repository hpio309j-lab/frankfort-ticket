const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('عرض إحصائيات نظام التذاكر')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // Total tickets count
        const totalTickets = await db.prepare('SELECT COUNT(*) as count FROM tickets').get().count;
        const openTickets = await db.prepare('SELECT COUNT(*) as count FROM tickets WHERE status = ?').get('open').count;
        const closedTickets = await db.prepare('SELECT COUNT(*) as count FROM tickets WHERE status = ?').get('closed').count;

        // Average rating
        const avgRating = await db.prepare('SELECT AVG(rating) as avg FROM tickets WHERE rating IS NOT NULL').get().avg || 0;
        const ratingStars = '⭐'.repeat(Math.round(avgRating)) || 'لا يوجد تقييمات';

        // Average response time (in hours)
        const responseTimeQuery = await db.prepare(`
            SELECT AVG(
                (julianday(first_response_at) - julianday(created_at)) * 24
            ) as avg_hours
            FROM tickets
            WHERE first_response_at IS NOT NULL
        `).get();
        const avgResponseTime = responseTimeQuery.avg_hours || 0;
        const responseTimeStr = avgResponseTime > 0
            ? `${avgResponseTime.toFixed(1)} ساعة`
            : 'لا توجد بيانات كافية';

        // Category distribution
        const categories = await db.prepare(`
            SELECT category, COUNT(*) as count 
            FROM tickets 
            GROUP BY category
        `).all();

        let categoryText = '';
        categories.forEach(cat => {
            const percentage = ((cat.count / totalTickets) * 100).toFixed(1);
            const emoji = cat.category === 'tech' ? '🛠️' : cat.category === 'admin' ? '⚖️' : '❓';
            categoryText += `${emoji} ${cat.category}: ${cat.count} (${percentage}%)\n`;
        });

        // Top performers (support team)
        const topPerformers = await db.prepare(`
            SELECT 
                claimed_by,
                COUNT(*) as tickets_closed,
                AVG(rating) as avg_rating
            FROM tickets
            WHERE claimed_by IS NOT NULL AND status = 'closed'
            GROUP BY claimed_by
            ORDER BY tickets_closed DESC
            LIMIT 5
        `).all();

        let performersText = '';
        topPerformers.forEach((perf, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📌';
            const stars = perf.avg_rating ? `${perf.avg_rating.toFixed(1)}⭐` : 'لا يوجد';
            performersText += `${medal} <@${perf.claimed_by}>: **${perf.tickets_closed}** تذكرة | ${stars}\n`;
        });

        if (!performersText) performersText = 'لا توجد بيانات';

        // Leaderboard (Points System)
        const leaderboard = await db.prepare(`
            SELECT user_id, total_points, tickets_closed, average_rating
            FROM support_points
            WHERE guild_id = ?
            ORDER BY total_points DESC
            LIMIT 5
        `).all(guildId);

        let leaderboardText = '';
        leaderboard.forEach((entry, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📌';
            const avgRating = entry.average_rating ? `${entry.average_rating.toFixed(1)}⭐` : 'لا يوجد';
            leaderboardText += `${medal} <@${entry.user_id}>: **${entry.total_points}** نقطة | ${entry.tickets_closed} تذكرة | ${avgRating}\n`;
        });

        if (!leaderboardText) leaderboardText = 'لا توجد بيانات';

        // Build embed
        const statsEmbed = new EmbedBuilder()
            .setTitle('📊 إحصائيات نظام التذاكر')
            .setColor('#26344d')
            .addFields(
                { name: '📈 إجمالي التذاكر', value: `${totalTickets}`, inline: true },
                { name: '🟢 المفتوحة', value: `${openTickets}`, inline: true },
                { name: '🔴 المغلقة', value: `${closedTickets}`, inline: true },
                { name: '⭐ متوسط التقييم', value: `${avgRating.toFixed(2)}/5.00\n${ratingStars}`, inline: true },
                { name: '⏱️ متوسط وقت الاستجابة', value: responseTimeStr, inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, // Spacer
                { name: '📊 توزيع الأقسام', value: categoryText || 'لا توجد بيانات', inline: false },
                { name: '🏆 أفضل أداء (فريق الدعم)', value: performersText, inline: false },
                { name: '🎖️ لوحة الصدارة (النقاط)', value: leaderboardText, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `تم الطلب بواسطة ${interaction.user.username}` });

        await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
    },
};
