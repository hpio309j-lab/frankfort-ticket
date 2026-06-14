const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('إدارة نظام الترحيب التلقائي')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('الإجراء المطلوب')
                .setRequired(true)
                .addChoices(
                    { name: '⚙️ إعداد النظام', value: 'setup' },
                    { name: '🔄 تفعيل/تعطيل', value: 'toggle' },
                    { name: '🧪 اختبار الرسالة', value: 'test' },
                    { name: '👁️ عرض الإعدادات', value: 'view' }
                ))
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('قناة الترحيب (للإعداد فقط)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)),

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const guildId = interaction.guild.id;

        if (action === 'setup') {
            const channel = interaction.options.getChannel('channel');

            if (!channel) {
                return interaction.reply({
                    content: '❌ يجب تحديد قناة الترحيب عند استخدام الإعداد!',
                    ephemeral: true
                });
            }

            // Create modal for message input
            const modal = new ModalBuilder()
                .setCustomId(`welcome_setup_${channel.id}`)
                .setTitle('إعداد رسالة الترحيب');

            const messageInput = new TextInputBuilder()
                .setCustomId('welcome_message')
                .setLabel('رسالة الترحيب')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('مرحباً {user} في {server}! 🎉\nأنت العضو رقم {count}')
                .setRequired(true)
                .setMaxLength(2000);

            const variablesInput = new TextInputBuilder()
                .setCustomId('variables_info')
                .setLabel('المتغيرات المتاحة (للقراءة فقط)')
                .setStyle(TextInputStyle.Short)
                .setValue('{user}, {username}, {server}, {count}')
                .setRequired(false);

            const row1 = new ActionRowBuilder().addComponents(messageInput);
            const row2 = new ActionRowBuilder().addComponents(variablesInput);

            modal.addComponents(row1, row2);

            await interaction.showModal(modal);
        }

        if (action === 'toggle') {
            const config = await db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);

            if (!config) {
                return interaction.reply({
                    content: '❌ يجب إعداد نظام الترحيب أولاً باستخدام `/welcome action:إعداد`',
                    ephemeral: true
                });
            }

            const newState = config.enabled ? 0 : 1;
            await db.prepare('UPDATE welcome_config SET enabled = ? WHERE guild_id = ?').run(newState, guildId);

            await interaction.reply({
                content: `${newState ? '✅ تم تفعيل' : '❌ تم تعطيل'} نظام الترحيب`,
                ephemeral: true
            });
        }

        if (action === 'test') {
            const config = await db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);

            if (!config || !config.channel_id) {
                return interaction.reply({
                    content: '❌ يجب إعداد نظام الترحيب أولاً باستخدام `/welcome action:إعداد`',
                    ephemeral: true
                });
            }

            const channel = interaction.guild.channels.cache.get(config.channel_id);
            if (!channel) {
                return interaction.reply({
                    content: '❌ قناة الترحيب غير موجودة!',
                    ephemeral: true
                });
            }

            // Replace variables
            let testMessage = config.message
                .replace(/{user}/g, `<@${interaction.user.id}>`)
                .replace(/{username}/g, interaction.user.username)
                .replace(/{server}/g, interaction.guild.name)
                .replace(/{count}/g, interaction.guild.memberCount.toString());

            await channel.send(testMessage);
            await interaction.reply({
                content: `✅ تم إرسال رسالة اختبار إلى <#${channel.id}>`,
                ephemeral: true
            });
        }

        if (action === 'view') {
            const config = await db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);

            if (!config) {
                return interaction.reply({
                    content: '❌ لم يتم إعداد نظام الترحيب بعد. استخدم `/welcome action:إعداد`',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('⚙️ إعدادات الترحيب الحالية')
                .addFields(
                    { name: '📍 القناة', value: config.channel_id ? `<#${config.channel_id}>` : 'غير محددة', inline: true },
                    { name: '🔄 الحالة', value: config.enabled ? '✅ مفعّل' : '❌ معطّل', inline: true },
                    { name: '📝 الرسالة', value: config.message || 'غير محددة', inline: false }
                )
                .setColor('#26344d')
                .setFooter({ text: 'المتغيرات المتاحة: {user}, {username}, {server}, {count}' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
