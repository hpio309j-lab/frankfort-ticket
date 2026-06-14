const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reply')
        .setDescription('إدارة الردود الجاهزة')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('الإجراء المطلوب')
                .setRequired(true)
                .addChoices(
                    { name: '➕ إضافة/تحديث رد', value: 'add' },
                    { name: '📋 عرض جميع الردود', value: 'list' },
                    { name: '🗑️ حذف رد', value: 'delete' },
                    { name: '📤 استخدام رد', value: 'use' }
                ))
        .addStringOption(opt =>
            opt.setName('trigger')
                .setDescription('الكلمة المفتاحية')
                .setRequired(false))
        .addStringOption(opt =>
            opt.setName('content')
                .setDescription('محتوى الرد (للإضافة فقط)')
                .setRequired(false)),

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const trigger = interaction.options.getString('trigger');
        const content = interaction.options.getString('content');
        const guildId = interaction.guild.id;

        // Add/Update reply
        if (action === 'add') {
            if (!trigger || !content) {
                return interaction.reply({ content: '❌ يجب تحديد الكلمة المفتاحية والمحتوى.', ephemeral: true });
            }

            const existing = await db.prepare('SELECT * FROM saved_replies WHERE guild_id = ? AND trigger = ?').get(guildId, trigger);

            if (existing) {
                await db.prepare('UPDATE saved_replies SET content = ?, created_by = ? WHERE guild_id = ? AND trigger = ?')
                    .run(content, interaction.user.id, guildId, trigger);
                await interaction.reply({ content: `✅ تم تحديث الرد الجاهز!\n**الكلمة:** \`${trigger}\`\n**المحتوى الجديد:** ${content}`, ephemeral: true });
            } else {
                await db.prepare('INSERT INTO saved_replies (guild_id, trigger, content, created_by) VALUES (?, ?, ?, ?)')
                    .run(guildId, trigger, content, interaction.user.id);
                await interaction.reply({ content: `✅ تم حفظ الرد الجاهز!\n**الكلمة:** \`${trigger}\`\n**المحتوى:** ${content}`, ephemeral: true });
            }
        }

        // List all replies
        if (action === 'list') {
            const replies = await db.prepare('SELECT * FROM saved_replies WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);

            if (!replies.length) {
                return interaction.reply({ content: '❌ لا توجد ردود جاهزة محفوظة.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('📝 الردود الجاهزة')
                .setColor('#2ECC71')
                .setDescription(replies.map(r => `**\`${r.trigger}\`** - ${r.content.substring(0, 50)}${r.content.length > 50 ? '...' : ''}`).join('\n'))
                .setFooter({ text: `إجمالي: ${replies.length} رد` });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Delete reply
        if (action === 'delete') {
            if (!trigger) {
                return interaction.reply({ content: '❌ يجب تحديد الكلمة المفتاحية.', ephemeral: true });
            }

            const result = await db.prepare('DELETE FROM saved_replies WHERE guild_id = ? AND trigger = ?').run(guildId, trigger);

            if (result.changes === 0) {
                return interaction.reply({ content: '❌ الكلمة المفتاحية غير موجودة.', ephemeral: true });
            }

            await interaction.reply({ content: `✅ تم حذف الرد الجاهز \`${trigger}\` بنجاح.`, ephemeral: true });
        }

        // Use reply
        if (action === 'use') {
            if (!trigger) {
                return interaction.reply({ content: '❌ يجب تحديد الكلمة المفتاحية.', ephemeral: true });
            }

            const reply = await db.prepare('SELECT * FROM saved_replies WHERE guild_id = ? AND trigger = ?').get(guildId, trigger);

            if (!reply) {
                return interaction.reply({ content: '❌ الكلمة المفتاحية غير موجودة.', ephemeral: true });
            }

            await interaction.channel.send({ content: reply.content });
            await interaction.reply({ content: `✅ تم إرسال الرد الجاهز \`${trigger}\`.`, ephemeral: true });
        }
    },
};
