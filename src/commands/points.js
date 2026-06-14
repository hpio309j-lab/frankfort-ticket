const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('points')
        .setDescription('إدارة نقاط أعضاء الدعم الفني')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('الإجراء المطلوب')
                .setRequired(true)
                .addChoices(
                    { name: '📊 عرض النقاط', value: 'view' },
                    { name: '🔄 تصفير النقاط', value: 'reset' }
                ))
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('العضو المستهدف')
                .setRequired(false)),

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // Get user points
        const userPoints = await db.prepare('SELECT * FROM support_points WHERE user_id = ? AND guild_id = ?')
            .get(targetUser.id, guildId);

        if (action === 'view') {
            if (!userPoints || userPoints.total_points === 0) {
                return interaction.reply({
                    content: `❌ ${targetUser.username} ليس لديه نقاط بعد.`,
                    ephemeral: true
                });
            }

            // Get user rank
            const allUsers = await db.prepare('SELECT user_id, total_points FROM support_points WHERE guild_id = ? ORDER BY total_points DESC')
                .all(guildId);
            const rank = allUsers.findIndex(u => u.user_id === targetUser.id) + 1;

            const embed = new EmbedBuilder()
                .setTitle(`🏆 نقاط ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '💎 إجمالي النقاط', value: `${userPoints.total_points} نقطة`, inline: true },
                    { name: '🎫 التذاكر المستلمة', value: `${userPoints.total_points} تذكرة`, inline: true },
                    { name: '📊 الترتيب', value: `#${rank} من ${allUsers.length}`, inline: true }
                )
                .setColor('#26344d')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (action === 'reset') {
            // Check admin permission for reset
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ تحتاج صلاحية Administrator لتصفير النقاط.',
                    ephemeral: true
                });
            }

            if (!userPoints) {
                return interaction.reply({
                    content: `❌ ${targetUser.username} ليس لديه نقاط أصلاً.`,
                    ephemeral: true
                });
            }

            // Reset all point-related data
            await db.prepare('UPDATE support_points SET total_points = 0, tickets_closed = 0, average_rating = 0 WHERE user_id = ? AND guild_id = ?')
                .run(targetUser.id, guildId);

            await interaction.reply({
                content: `✅ تم تصفير بيانات ${targetUser.username} بنجاح!\n**النقاط السابقة:** ${userPoints.total_points} نقطة\n**التذاكر المغلقة:** ${userPoints.tickets_closed}\n**التقييم:** ${userPoints.average_rating ? userPoints.average_rating.toFixed(1) : 'لا يوجد'}`,
                ephemeral: true
            });

            console.log(`[🔄 تصفير] ${interaction.user.tag} صفّر بيانات ${targetUser.tag} (${userPoints.total_points} نقطة، ${userPoints.tickets_closed} تذكرة)`);
        }
    },
};
