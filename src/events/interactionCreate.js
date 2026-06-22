const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../db/schema');
const { generateAdminPanel } = require('../utils/adminPanel');
const { generateTranscript } = require('../utils/transcript');
const { CATEGORY_PANEL_MAP, CATEGORY_CONFIG } = require('../utils/panelSender');

// Helper function to send logs to the configured log channel
async function sendLog(client, guildId, embed) {
    const config = await db.prepare('SELECT log_channel_id FROM guild_configs WHERE guild_id = ?').get(guildId);
    if (!config?.log_channel_id) return;
    const logChannel = client.channels.cache.get(config.log_channel_id);
    if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => { });
}

// Map category to display name
function getCategoryName(category) {
    const config = CATEGORY_CONFIG[category];
    return config ? config.categoryName : category;
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            console.log(`[📜 أمر] ${interaction.user.tag} استخدم /${interaction.commandName} في #${interaction.channel?.name || 'DM'}`);
            try { await command.execute(interaction); } catch (error) { console.error(`[❌ خطأ في الأمر] ${interaction.commandName}:`, error); }
            return;
        }

        // --- HELP CATEGORY SELECT MENU ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'help_category') {
            const category = interaction.values[0];
            let embed = new EmbedBuilder().setColor('#26344d').setTimestamp();

            if (category === 'tickets') {
                embed.setTitle('🎫 أوامر نظام التذاكر')
                    .setDescription('أوامر إدارة وإعداد نظام التذاكر')
                    .addFields(
                        { name: '/setup_ticket', value: '```إعداد نظام التذاكر الكامل\nالمعاملات: support_role, log_channel, embed_color```', inline: false }
                    );
            } else if (category === 'welcome') {
                embed.setTitle('👋 أوامر نظام الترحيب')
                    .setDescription('أوامر إدارة الترحيب التلقائي للأعضاء الجدد')
                    .addFields(
                        { name: '/welcome setup', value: '```إعداد رسالة الترحيب والقناة\nالمعاملات: channel```', inline: false },
                        { name: '/welcome toggle', value: '```تفعيل/تعطيل نظام الترحيب```', inline: false },
                        { name: '/welcome test', value: '```اختبار رسالة الترحيب```', inline: false },
                        { name: '/welcome view', value: '```عرض الإعدادات الحالية```', inline: false }
                    );
            } else if (category === 'points') {
                embed.setTitle('🏆 أوامر نظام النقاط')
                    .setDescription('أوامر إدارة النقاط والإحصائيات')
                    .addFields(
                        { name: '/points view', value: '```عرض نقاط عضو معين\nالمعاملات: user (اختياري)```', inline: false },
                        { name: '/points reset', value: '```تصفير نقاط عضو (يحتاج صلاحية Admin)\nالمعاملات: user```', inline: false },
                        { name: '/stats', value: '```عرض إحصائيات التذاكر ولوحة الصدارة```', inline: false }
                    );
            } else if (category === 'settings') {
                embed.setTitle('⚙️ أوامر الإعدادات')
                    .setDescription('أوامر تخصيص رسائل الترحيب والتنبيهات')
                    .addFields(
                        { name: '/customize', value: '```تخصيص رسائل الترحيب ووقت التنبيهات\nالخيارات: tech_welcome, admin_welcome, general_welcome, alert_hours, view```', inline: false }
                    );
            } else if (category === 'replies') {
                embed.setTitle('💬 أوامر الردود التلقائية')
                    .setDescription('أوامر إدارة الردود الجاهزة')
                    .addFields(
                        { name: '/reply add', value: '```إضافة رد تلقائي جديد\nالمعاملات: trigger, content```', inline: false },
                        { name: '/reply list', value: '```عرض جميع الردود المحفوظة```', inline: false },
                        { name: '/reply delete', value: '```حذف رد تلقائي\nالمعاملات: trigger```', inline: false },
                        { name: '/reply use', value: '```استخدام رد محفوظ يدوياً\nالمعاملات: trigger```', inline: false }
                    );
            } else if (category === 'general') {
                embed.setTitle('ℹ️ أوامر عامة')
                    .setDescription('أوامر متنوعة ومساعدة')
                    .addFields(
                        { name: '/help', value: '```عرض قائمة المساعدة هذه```', inline: false },
                        { name: '/come', value: '```استدعاء عضو إلى قناتك الصوتية```', inline: false }
                    );
            }

            await interaction.update({ embeds: [embed] });
            return;
        }

        if (interaction.isButton()) {
            const { customId, user, guild } = interaction;
            const config = guild ? await db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guild.id) : null;

            // --- OPEN MODAL TRIGGER ---
            if (customId.startsWith('open_modal_')) {
                const category = customId.replace('open_modal_', '');

                // Check rate limiting
                const guildConfig = await db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(interaction.guild.id);
                if (guildConfig && guildConfig.rate_limit_enabled) {
                    // Count tickets created today by this user
                    const today = new Date().toISOString().split('T')[0];
                    const ticketsToday = await db.prepare(`
                        SELECT COUNT(*) as count 
                        FROM tickets 
                        WHERE user_id = ? AND DATE(created_at) = ?
                    `).get(interaction.user.id, today);

                    if (ticketsToday.count >= guildConfig.max_tickets_per_day) {
                        const limitEmbed = new EmbedBuilder()
                            .setTitle('⚠️ تجاوز الحد المسموح')
                            .setDescription(`لقد وصلت إلى الحد الأقصى لإنشاء التذاكر اليوم.\n\n**الحد الأقصى:** ${guildConfig.max_tickets_per_day} تذاكر/يوم\n**تذاكرك اليوم:** ${ticketsToday.count}\n\nيرجى المحاولة غداً أو التواصل  مع الإدارة.`)
                            .setColor('#da3633')
                            .setTimestamp();

                        return interaction.reply({ embeds: [limitEmbed], ephemeral: true });
                    }
                }

                console.log(`[🎫 نموذج] ${user.tag} يفتح نموذج تذكرة (${category})`);

                // Get category-specific config
                const catConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['tech'];

                const modal = new ModalBuilder()
                    .setCustomId(`ticket_modal_${category}`)
                    .setTitle(catConfig.modalTitle);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_topic').setLabel(catConfig.topicLabel).setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_desc').setLabel(catConfig.descLabel).setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                try {
                    await interaction.showModal(modal);
                } catch (err) {
                    console.error('[Error] Failed to show modal:', err.message);
                }
                return;
            }

            // --- CLAIM TICKET ---
            if (customId.startsWith('claim_')) {
                const ticketId = customId.split('_')[1];
                const ticket = await db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketId);
                if (ticket.claimed_by) return interaction.reply({ content: `هذه التذكرة مستلمة بالفعل بواسطة <@${ticket.claimed_by}>`, ephemeral: true });

                await db.prepare('UPDATE tickets SET claimed_by = ? WHERE ticket_id = ?').run(user.id, ticketId);
                console.log(`[🙋 استلام] ${user.tag} استلم التذكرة #${ticketId}`);
                const channel = guild.channels.cache.get(ticket.channel_id);
                if (channel) await channel.setName(`claimed-${user.username}`);

                const newPanel = await generateAdminPanel(ticket.user_id, ticketId);
                await interaction.update(newPanel);
                await interaction.followUp({ content: `✅ تم استلام التذكرة بواسطة <@${user.id}>` });

                // Send to log channel
                const claimLog = new EmbedBuilder()
                    .setTitle('🙋‍♂️ تم استلام تذكرة')
                    .addFields(
                        { name: 'رقم التذكرة', value: `#${ticketId}`, inline: true },
                        { name: 'المستلم', value: `<@${user.id}>`, inline: true },
                        { name: 'صاحب التذكرة', value: `<@${ticket.user_id}>`, inline: true }
                    )
                    .setColor('#2ECC71')
                    .setTimestamp();
                await sendLog(interaction.client, guild.id, claimLog);

                // Award 1 point for claiming ticket
                await db.prepare(`
                    INSERT INTO support_points (user_id, guild_id, total_points, tickets_closed)
                    VALUES (?, ?, 1, 0)
                    ON CONFLICT(user_id, guild_id) DO UPDATE SET
                        total_points = total_points + 1
                `).run(user.id, guild.id);
                console.log(`[🏆 نقطة] ${user.id} حصل على نقطة لاستلام التذكرة #${ticketId}`);

                // Notify ticket owner via DM
                const ticketOwner = await interaction.client.users.fetch(ticket.user_id).catch(() => null);
                if (ticketOwner) {
                    const notifyEmbed = new EmbedBuilder()
                        .setTitle('✅ تم استلام تذكرتك')
                        .setDescription(`تذكرتك #${ticketId} تم استلامها بواسطة <@${user.id}>. سيتم الرد عليك قريباً!`)
                        .setColor('#2ECC71')
                        .setTimestamp();
                    await ticketOwner.send({ embeds: [notifyEmbed] }).catch(() => { });
                    console.log(`[🔔 إشعار] تم إرسال إشعار الاستلام للمستخدم ${ticket.user_id}`);
                }
            }

            // --- CLOSE TICKET ---
            if (customId.startsWith('close_')) {
                const ticketId = customId.split('_')[1];
                const ticket = await db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketId);

                if (!ticket) {
                    return interaction.reply({ content: '❌ هذه التذكرة لم تعد موجودة في قاعدة البيانات.', ephemeral: true });
                }

                await db.prepare('UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE ticket_id = ?').run('closed', ticketId);
                console.log(`[🔒 إغلاق] ${user.tag} أغلق التذكرة #${ticketId}`);

                // Update support member tickets closed count
                if (ticket.claimed_by) {
                    await db.prepare('UPDATE support_points SET tickets_closed = tickets_closed + 1 WHERE user_id = ? AND guild_id = ?').run(ticket.claimed_by, guild.id);
                }

                await interaction.reply({ content: '🔒 تم إغلاق التذكرة. سيتم حذف القناة خلال 5 ثوانٍ... جاري إرسال التقييم للمستخدم.' });

                const targetUser = await interaction.client.users.fetch(ticket.user_id).catch(() => null);
                if (targetUser) {
                    const rateEmbed = new EmbedBuilder().setTitle('⭐ تقييم الدعم الفني').setDescription(`كيف كانت تجربتك في التذكرة رقم #${ticketId}؟`).setColor('#F1C40F');
                    const rateRow = new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(v => new ButtonBuilder().setCustomId(`rate_${ticketId}_${v}`).setLabel(`${v}`).setStyle(ButtonStyle.Secondary)));
                    await targetUser.send({ embeds: [rateEmbed], components: [rateRow] }).catch(() => { });
                }

                // Send to log channel
                const closeLog = new EmbedBuilder()
                    .setTitle('🔒 تم إغلاق تذكرة')
                    .addFields(
                        { name: 'رقم التذكرة', value: `#${ticketId}`, inline: true },
                        { name: 'أغلقها', value: `<@${user.id}>`, inline: true },
                        { name: 'صاحب التذكرة', value: `<@${ticket.user_id}>`, inline: true },
                        { name: 'المستلم', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'لم يُستلم', inline: true }
                    )
                    .setColor('#E74C3C')
                    .setTimestamp();
                await sendLog(interaction.client, guild.id, closeLog);

                setTimeout(() => { interaction.channel.delete().catch(() => { }); }, 5000);
            }

            // --- RATING ---
            if (customId.startsWith('rate_')) {
                const [, ticketId, value] = customId.split('_');
                const ticket = await db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketId);
                await db.prepare('UPDATE tickets SET rating = ? WHERE ticket_id = ?').run(value, ticketId);
                console.log(`[⭐ تقييم] المستخدم ${user.tag} قيّم التذكرة #${ticketId} بـ ${value} نجوم`);
                await interaction.update({ content: `شكراً لك على تقييمك بـ ${value}⭐!`, embeds: [], components: [] });

                // Send rating to log channel (fetch guild from ticket data)
                if (ticket) {
                    const ticketChannel = interaction.client.channels.cache.find(c => c.id === ticket.channel_id);
                    const guild = interaction.client.guilds.cache.find(g => g.members.cache.has(ticket.user_id)) || interaction.client.guilds.cache.first();
                    const guildId = ticketChannel?.guild?.id || guild?.id;
                    if (guildId) {
                        const rateLog = new EmbedBuilder()
                            .setTitle('⭐ تقييم جديد')
                            .addFields(
                                { name: 'رقم التذكرة', value: `#${ticketId}`, inline: true },
                                { name: 'التقييم', value: `${'⭐'.repeat(parseInt(value))} (${value}/5)`, inline: true },
                                { name: 'من المستخدم', value: `<@${user.id}>`, inline: true }
                            )
                            .setColor('#F1C40F')
                            .setTimestamp();
                        await sendLog(interaction.client, guildId, rateLog);

                        // Update support member's average rating in support_points
                        if (ticket.claimed_by) {
                            await db.prepare('UPDATE support_points SET average_rating = ? WHERE user_id = ? AND guild_id = ?').run(ticket.claimed_by, guildId);
                        }
                    }
                }
            }

            // --- VARIOUS ACTIONS ---
            if (customId.startsWith('history_')) {
                const tid = customId.split('_')[1];
                const recent = await db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(tid);
                if (!recent.length) return interaction.reply({ content: 'لا يوجد سجل.', ephemeral: true });
                const emb = new EmbedBuilder().setTitle('📜 سجل التذاكر').setColor('#26344d');
                recent.forEach(t => emb.addFields({ name: `تذكرة #${t.ticket_id}`, value: `الحالة: ${t.status}\nالتقييم: ${t.rating || 'لا يوجد'}` }));
                await interaction.reply({ embeds: [emb], ephemeral: true });
            }

            if (customId.startsWith('note_')) {
                const tid = customId.split('_')[1];
                const modal = new ModalBuilder().setCustomId(`modal_note_${tid}`).setTitle('إضافة ملاحظة إدارية');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('note_content').setLabel('الملاحظة').setStyle(TextInputStyle.Paragraph)));
                await interaction.showModal(modal);
            }

            if (customId.startsWith('transcript_')) {
                const tid = customId.split('_')[1];
                const html = await generateTranscript(tid);
                const file = new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-${tid}.html` });
                await interaction.reply({ content: `نسخة المحادثة:`, files: [file], ephemeral: true });
            }

            // --- SUMMON USER ---
            if (customId.startsWith('summon_')) {
                const ticketId = customId.split('_')[1];
                const ticket = await db.prepare('SELECT user_id FROM tickets WHERE ticket_id = ?').get(ticketId);
                const targetUser = await interaction.client.users.fetch(ticket.user_id).catch(() => null);

                if (!targetUser) return interaction.reply({ content: '❌ تعذر العثور على المستخدم.', ephemeral: true });

                const summonEmbed = new EmbedBuilder()
                    .setTitle('🔔 تنبيه استدعاء')
                    .setDescription(`مرحباً <@${targetUser.id}>، يرجى الحضور إلى قناتك المخصصة للدعم الفني في سيرفر **${interaction.guild.name}**.\n\n**القناة:** <#${interaction.channel.id}>`)
                    .setColor('#E74C3C')
                    .setTimestamp()
                    .setFooter({ text: `بواسطة: ${interaction.user.username}` });

                try {
                    await targetUser.send({ embeds: [summonEmbed] });
                    await interaction.reply({ content: `✅ تم إرسال تنبيه الاستدعاء إلى <@${targetUser.id}>.` });
                } catch (error) {
                    await interaction.reply({ content: '❌ تعذر إرسال رسالة خاصة للمستخدم (قد تكون الرسائل الخاصة مغلقة).', ephemeral: true });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('ticket_modal_')) {
                const category = interaction.customId.replace('ticket_modal_', '');
                const topic = interaction.fields.getTextInputValue('ticket_topic');
                const desc = interaction.fields.getTextInputValue('ticket_desc');
                const { user, guild } = interaction;
                if (!guild) return interaction.reply({ content: '❌ هذا الأمر يعمل فقط داخل السيرفرات.', ephemeral: true });
                const config = await db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guild.id);

                if (!config) return interaction.reply({ content: '❌ لم يتم إعداد النظام بعد. السيرفر يحتاج لتشغيل `/setup_ticket`.', ephemeral: true });

                // Get parent category from the panel channel
                const panelChannelId = CATEGORY_PANEL_MAP[category];
                let parentId;

                if (panelChannelId) {
                    const panelChannel = guild.channels.cache.get(panelChannelId);
                    if (panelChannel && panelChannel.parentId) {
                        parentId = panelChannel.parentId;
                    } else {
                        // Fallback: fetch the channel if not in cache
                        try {
                            const fetchedChannel = await guild.channels.fetch(panelChannelId);
                            if (fetchedChannel && fetchedChannel.parentId) {
                                parentId = fetchedChannel.parentId;
                            }
                        } catch (e) {
                            console.log(`[Panel] Could not fetch panel channel ${panelChannelId}: ${e.message}`);
                        }
                    }
                }

                // Fallback to DB config if panel channel not found
                if (!parentId) {
                    parentId = category === 'tech' || category === 'inquiry' || category === 'general'
                        ? config.tech_category_id || config.general_category_id
                        : category === 'admin' || category === 'admin_submit'
                            ? config.admin_category_id
                            : config.general_category_id;
                }

                if (!parentId) {
                    return interaction.reply({ content: '❌ تعذر تحديد القسم. تأكد من أن البوت لديه صلاحية الوصول.', ephemeral: true });
                }

                const channel = await guild.channels.create({
                    name: `${category}-${user.username}`,
                    type: ChannelType.GuildText,
                    parent: parentId,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: config.support_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ],
                });

                await db.prepare('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)').run(user.id, user.username);
                const res = await db.prepare('INSERT INTO tickets (user_id, channel_id, category, topic, description, status) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(user.id, channel.id, category, topic, desc, 'open');

                const panel = await generateAdminPanel(user.id, res.lastInsertRowid);
                await channel.send(panel);

                // Get category-specific welcome message
                const catConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['tech'];
                const customWelcome = category === 'tech' ? (config.tech_welcome) :
                    category === 'admin' || category === 'admin_submit' ? (config.admin_welcome) :
                        category === 'inquiry' || category === 'general' ? (config.general_welcome) : null;

                const welcomeMessage = customWelcome || catConfig.welcomeMessage;

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle(welcomeMessage)
                        .setDescription(`**الموضوع:** ${topic}\n**الوصف:** ${desc}\n\n<@${user.id}>، سيتم الرد عليك قريباً من قبل فريق <@&${config.support_role_id}>.`)
                        .setColor('#26344d')]
                });
                console.log(`[🎫 تذكرة جديدة] ${user.tag} فتح تذكرة #${res.lastInsertRowid} (${getCategoryName(category)}) - ${topic}`);

                // Send to log channel with support role mention
                const newTicketLog = new EmbedBuilder()
                    .setTitle('🎫 تذكرة جديدة')
                    .addFields(
                        { name: 'رقم التذكرة', value: `#${res.lastInsertRowid}`, inline: true },
                        { name: 'القسم', value: getCategoryName(category), inline: true },
                        { name: 'صاحب التذكرة', value: `<@${user.id}>`, inline: true },
                        { name: 'الموضوع', value: topic, inline: false },
                        { name: 'القناة', value: `${channel}`, inline: false }
                    )
                    .setColor('#26344d')
                    .setTimestamp();

                const logConfig = await db.prepare('SELECT log_channel_id FROM guild_configs WHERE guild_id = ?').get(guild.id);
                if (logConfig?.log_channel_id) {
                    const logChannel = interaction.client.channels.cache.get(logConfig.log_channel_id);
                    if (logChannel) {
                        await logChannel.send({
                            content: `<@&${config.support_role_id}> تذكرة جديدة تحتاج انتباهكم!`,
                            embeds: [newTicketLog]
                        }).catch(() => { });
                    }
                }

                await interaction.reply({ content: `✅ تم فتح التذكرة بنجاح: ${channel}`, ephemeral: true });
            }

            if (interaction.customId.startsWith('modal_note_')) {
                const tid = interaction.customId.split('_')[2];
                const content = interaction.fields.getTextInputValue('note_content');
                await db.prepare('INSERT INTO notes (ticket_id, admin_id, note_content) VALUES (?, ?, ?)').run(tid, interaction.user.id, content);
                await interaction.reply({ content: '✅ تمت إضافة الملاحظة!', ephemeral: true });
                const ticket = await db.prepare('SELECT user_id FROM tickets WHERE ticket_id = ?').get(tid);
                const panel = await generateAdminPanel(ticket.user_id, tid);
                await interaction.channel.send({ content: '📝 تم تحديث لوحة التحكم بعد إضافة الملاحظة:', ...panel });
            }
        }

        // --- WELCOME SETUP MODAL ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('welcome_setup_')) {
            const channelId = interaction.customId.split('_')[2];
            const message = interaction.fields.getTextInputValue('welcome_message');
            const guildId = interaction.guild.id;

            // Save to database
            await db.prepare(`
                INSERT INTO welcome_config (guild_id, channel_id, message, enabled)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(guild_id) DO UPDATE SET
                    channel_id = ?,
                    message = ?,
                    enabled = 1
            `).run(guildId, channelId, message, channelId, message);

            const embed = new EmbedBuilder()
                .setTitle('✅ تم إعداد نظام الترحيب')
                .addFields(
                    { name: '📍 القناة', value: `<#${channelId}>`, inline: true },
                    { name: '📝 الرسالة', value: message, inline: false }
                )
                .setColor('#2ECC71')
                .setFooter({ text: 'استخدم /welcome test لاختبار الرسالة' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            console.log(`[👋 ترحيب] ${interaction.user.tag} أعد نظام الترحيب`);
        }
    },
};