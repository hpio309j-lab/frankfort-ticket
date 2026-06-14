const cron = require('node-cron');
const { db } = require('../db/schema');

function startTicketAlerts(client) {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('[⏰ Cron] Checking for delayed tickets...');

        try {
            // Get all guilds with configs
            const guilds = await db.prepare('SELECT * FROM guild_configs').all();

            for (const config of guilds) {
                const alertHours = config.alert_hours || 24;

                // Find tickets without first response that are older than alert_hours
                const delayedTickets = await db.prepare(`
                    SELECT * FROM tickets 
                    WHERE status = 'open' 
                    AND first_response_at IS NULL
                    AND (julianday('now') - julianday(created_at)) * 24 > ?
                `).all(alertHours);

                if (delayedTickets.length === 0) continue;

                // Send notification to log channel
                if (!config.log_channel_id) continue;

                const logChannel = client.channels.cache.get(config.log_channel_id) || await client.channels.fetch(config.log_channel_id).catch(() => null);
                if (!logChannel) continue;

                for (const ticket of delayedTickets) {
                    const hoursSinceCreation = Math.floor(
                        (new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60)
                    );

                    const { EmbedBuilder } = require('discord.js');
                    const alertEmbed = new EmbedBuilder()
                        .setTitle('⚠️ تذكرة متأخرة - تحتاج انتباه!')
                        .setDescription(`التذكرة #${ticket.ticket_id} لم يتم الرد عليها منذ **${hoursSinceCreation} ساعة**`)
                        .addFields(
                            { name: 'القسم', value: ticket.category, inline: true },
                            { name: 'الموضوع', value: ticket.topic, inline: true },
                            { name: 'صاحب التذكرة', value: `<@${ticket.user_id}>`, inline: true },
                            { name: 'القناة', value: `<#${ticket.channel_id}>`, inline: false }
                        )
                        .setColor('#E74C3C')
                        .setTimestamp();

                    await logChannel.send({
                        content: `<@&${config.support_role_id}> تذكرة متأخرة!`,
                        embeds: [alertEmbed]
                    }).catch(err => console.error('[Error] Failed to send delayed ticket alert:', err.message));

                    console.log(`[⚠️ تنبيه] تذكرة متأخرة #${ticket.ticket_id} - ${hoursSinceCreation}h`);
                }
            }
        } catch (error) {
            console.error('[Error] Ticket alerts cron job failed:', error.message);
        }
    });

    console.log('[✅ Cron] Delayed ticket alerts scheduled (runs every hour)');
}

module.exports = { startTicketAlerts };
