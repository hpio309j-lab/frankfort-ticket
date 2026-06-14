const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('come')
        .setDescription('استدعاء المستخدم إلى التذكرة عبر الخاص (DM)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        // Defer reply to prevent "Unknown Interaction" during network/DM latency
        await interaction.deferReply({ ephemeral: true });

        // Check if we are in a ticket channel
        const ticket = await db.prepare('SELECT user_id FROM tickets WHERE channel_id = ? AND status = ?').get(interaction.channel.id, 'open');

        if (!ticket) {
            return interaction.editReply({ content: '❌ هذا الأمر يعمل فقط داخل قنوات التذاكر المفتوحة.' });
        }

        const targetUser = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

        if (!targetUser) {
            return interaction.editReply({ content: '❌ تعذر العثور على المستخدم صاحب التذكرة.' });
        }

        const summonEmbed = new EmbedBuilder()
            .setTitle('🔔 تنبيه استدعاء')
            .setDescription(`مرحباً <@${targetUser.id}>، يرجى الحضور إلى قناتك المخصصة للدعم الفني في سيرفر **${interaction.guild.name}**.\n\n**القناة:** <#${interaction.channel.id}>`)
            .setColor('#E74C3C')
            .setTimestamp()
            .setFooter({ text: `بواسطة: ${interaction.user.username}` });

        try {
            await targetUser.send({ embeds: [summonEmbed] });
            await interaction.editReply({ content: `✅ تم إرسال تنبيه الاستدعاء إلى <@${targetUser.id}> بنجاح.` });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ تعذر إرسال رسالة خاصة للمستخدم (قد تكون الرسائل الخاصة مغلقة).' });
        }
    },
};
