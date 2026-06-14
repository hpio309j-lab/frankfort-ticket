const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { db } = require('../db/schema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_ticket')
        .setDescription('إعداد لوحة التذاكر في القناة')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('tech_category')
                .setDescription('قسم الدعم الفني')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('admin_category')
                .setDescription('قسم الإدارة والبلاغات')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('general_category')
                .setDescription('قسم الاستفسارات العامة')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('support_role')
                .setDescription('رتبة فريق الدعم')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('log_channel')
                .setDescription('قناة سجلات التذاكر (التقييمات، الاستلام، الإغلاق)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('embed_color')
                .setDescription('لون الـ Embed (مثال: #26344d)')
                .setRequired(false)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const techCat = interaction.options.getChannel('tech_category').id;
        const adminCat = interaction.options.getChannel('admin_category').id;
        const generalCat = interaction.options.getChannel('general_category').id;
        const supportRole = interaction.options.getRole('support_role').id;
        const logChannel = interaction.options.getChannel('log_channel').id;
        const embedColor = interaction.options.getString('embed_color') || '#26344d';

        // Save Config to DB
        await db.prepare(`
            INSERT INTO guild_configs (guild_id, tech_category_id, admin_category_id, general_category_id, support_role_id, log_channel_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                tech_category_id = excluded.tech_category_id,
                admin_category_id = excluded.admin_category_id,
                general_category_id = excluded.general_category_id,
                support_role_id = excluded.support_role_id,
                log_channel_id = excluded.log_channel_id
        `).run(guildId, techCat, adminCat, generalCat, supportRole, logChannel);

        const embed = new EmbedBuilder()
            .setTitle('🎫 نظام التذاكر ')
            .setDescription('مرحباً بك في مركز الدعم. يرجى اختيار القسم المناسب لاحتياجك لفتح تذكرة جديدة.')
            .addFields(
                { name: '🛠️ الدعم الفني', value: 'للمشاكل التقنية، أخطاء النظام، والمساعدة البرمجية.', inline: false },
                { name: '🛡️ الإدارة والبلاغات', value: 'للتبليغ عن مستخدمين أو الاعتراض على قرارات إدارية.', inline: false },
                { name: '❔ استفسارات عامة', value: 'للأسئلة العامة حول خدماتنا.', inline: false }
            )
            .setImage('https://media.discordapp.net/attachments/1438037917124788267/1515620864140378232/Gemini_Generated_Image_1bcq0k1bcq0k1bcq-Photoroom.png?ex=6a2fab6c&is=6a2e59ec&hm=464f1f484d6460edcabcbabb94ad9c5fb115e4ef313e432a982ef127c9585943&=&format=webp&quality=lossless&width=1620&height=810')
            .setColor(embedColor);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_modal_tech')
                    .setLabel('الدعم الفني')
                    .setEmoji('🛠️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('open_modal_admin')
                    .setLabel('الإدارة')
                    .setEmoji('🛡️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('open_modal_general')
                    .setLabel('عام')
                    .setEmoji('❔')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({ content: `✅ تم إعداد لوحة التذاكر وحفظ الإعدادات بنجاح!\n📋 قناة السجلات: <#${logChannel}>`, ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    },
};
