const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/schema');
const { sendPanels } = require('../utils/panelSender');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_ticket')
        .setDescription('إعداد نظام التذاكر')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('support_role')
                .setDescription('رتبة فريق الدعم')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('log_channel')
                .setDescription('قناة سجلات التذاكر (التقييمات، الاستلام، الإغلاق)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('embed_color')
                .setDescription('لون الـ Embed (مثال: #26344d)')
                .setRequired(false)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const supportRole = interaction.options.getRole('support_role').id;
        const logChannel = interaction.options.getChannel('log_channel').id;
        const embedColor = interaction.options.getString('embed_color') || '#26344d';

        // Save Config to DB
        await db.prepare(`
            INSERT INTO guild_configs (guild_id, support_role_id, log_channel_id)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                support_role_id = excluded.support_role_id,
                log_channel_id = excluded.log_channel_id
        `).run(guildId, supportRole, logChannel);

        await interaction.reply({ content: `✅ تم إعداد نظام التذاكر وحفظ الإعدادات بنجاح!\n📋 قناة السجلات: <#${logChannel}>\n👥 رتبة الدعم: <@&${supportRole}>\n\n🔄 جاري إرسال البانلات إلى القنوات المحددة...`, ephemeral: true });

        // Send panels to all configured channels
        await sendPanels(interaction.client);
    },
};