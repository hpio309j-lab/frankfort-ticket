const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('عرض قائمة الأوامر المتاحة'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📚 قائمة المساعدة')
            .setDescription('اختر فئة من القائمة أدناه لعرض الأوامر المتعلقة بها')
            .setColor('#26344d')
            .addFields(
                { name: '🎫 نظام التذاكر', value: 'أوامر إدارة التذاكر', inline: true },
                { name: '👋 نظام الترحيب', value: 'أوامر الترحيب التلقائي', inline: true },
                { name: '🏆 نظام النقاط', value: 'أوامر النقاط والإحصائيات', inline: true },
                { name: '⚙️ الإعدادات', value: 'أوامر التخصيص والإعدادات', inline: true },
                { name: '💬 الردود التلقائية', value: 'أوامر الردود الجاهزة', inline: true },
                { name: 'ℹ️ عام', value: 'أوامر عامة ومتنوعة', inline: true }
            )
            .setFooter({ text: 'اختر فئة من القائمة المنسدلة' })
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('اختر فئة الأوامر')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('🎫 نظام التذاكر')
                    .setDescription('أوامر إدارة التذاكر')
                    .setValue('tickets'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('👋 نظام الترحيب')
                    .setDescription('أوامر الترحيب التلقائي')
                    .setValue('welcome'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🏆 نظام النقاط')
                    .setDescription('أوامر النقاط والإحصائيات')
                    .setValue('points'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('⚙️ الإعدادات')
                    .setDescription('أوامر التخصيص والإعدادات')
                    .setValue('settings'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('💬 الردود التلقائية')
                    .setDescription('أوامر الردود الجاهزة')
                    .setValue('replies'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('ℹ️ عام')
                    .setDescription('أوامر عامة ومتنوعة')
                    .setValue('general')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};
