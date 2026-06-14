const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customize')
        .setDescription('تخصيص إعدادات نظام التذاكر')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('setting')
                .setDescription('الإعداد المراد تعديله')
                .setRequired(true)
                .addChoices(
                    { name: '🛠️ رسالة الدعم الفني', value: 'tech_welcome' },
                    { name: '⚖️ رسالة الإدارة', value: 'admin_welcome' },
                    { name: '❓ رسالة الاستفسارات العامة', value: 'general_welcome' },
                    { name: '⏰ وقت التنبيه (بالساعات)', value: 'alert_hours' },
                    { name: '👁️ عرض الإعدادات الحالية', value: 'view' }
                ))
        .addStringOption(opt =>
            opt.setName('value')
                .setDescription('القيمة الجديدة (اتركها فارغة لعرض الإعدادات)')
                .setRequired(false)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const setting = interaction.options.getString('setting');
        const value = interaction.options.getString('value');

        // Ensure config exists
        const config = await db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
        if (!config) {
            return interaction.reply({ content: '❌ يجب تشغيل `/setup_ticket` أولاً.', ephemeral: true });
        }

        // View current settings
        if (setting === 'view' || !value) {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ الإعدادات الحالية')
                .setColor('#26344d')
                .addFields(
                    { name: '🛠️ رسالة الدعم الفني', value: config.tech_welcome || 'غير محددة', inline: false },
                    { name: '⚖️ رسالة الإدارة', value: config.admin_welcome || 'غير محددة', inline: false },
                    { name: '❓ رسالة الاستفسارات العامة', value: config.general_welcome || 'غير محددة', inline: false },
                    { name: '⏰ وقت التنبيه للتذاكر المتأخرة', value: `${config.alert_hours || 24} ساعة`, inline: false }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Update alert hours
        if (setting === 'alert_hours') {
            const hours = parseInt(value);
            if (isNaN(hours) || hours < 1 || hours > 168) {
                return interaction.reply({ content: '❌ يجب أن يكون الوقت بين 1 و 168 ساعة.', ephemeral: true });
            }

            await db.prepare('UPDATE guild_configs SET alert_hours = ? WHERE guild_id = ?').run(hours, guildId);
            return interaction.reply({
                content: `✅ تم تحديث وقت التنبيه للتذاكر المتأخرة إلى **${hours} ساعة**`,
                ephemeral: true
            });
        }

        // Update welcome messages
        await db.prepare(`UPDATE guild_configs SET ${setting} = ? WHERE guild_id = ?`).run(value, guildId);

        const settingNames = {
            'tech_welcome': 'الدعم الفني',
            'admin_welcome': 'الإدارة',
            'general_welcome': 'الاستفسارات العامة'
        };

        await interaction.reply({
            content: `✅ تم تحديث رسالة الترحيب لقسم **${settingNames[setting]}**\n\n**الرسالة الجديدة:**\n${value}`,
            ephemeral: true
        });
    },
};
