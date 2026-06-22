const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PANELS = [
    {
        channelId: '1473635962276937879',
        embed: {
            title: '🛠️ نظام الدعم الفني',
            description: 'مرحباً بك في مركز الدعم. يرجى اختيار القسم المناسب لاحتياجك لفتح تذكرة جديدة.',
            fields: [
                { name: '🛠️ الدعم الفني', value: 'للمشاكل التقنية، أخطاء النظام، والمساعدة البرمجية.', inline: false },
                { name: '❔ استفسارات عامة', value: 'للأسئلة العامة حول خدماتنا.', inline: false }
            ],
            image: 'https://media.discordapp.net/attachments/1438037917124788267/1515620864140378232/Gemini_Generated_Image_1bcq0k1bcq-Photoroom.png?ex=6a2fab6c&is=6a2e59ec&hm=464f1f484d6460edcabcbabb94ad9c5fb115e4ef313e432a982ef127c9585943&=&format=webp&quality=lossless&width=1620&height=810'
        },
        buttons: [
            { customId: 'open_modal_tech', label: 'الدعم الفني', emoji: '🛠️' },
            { customId: 'open_modal_inquiry', label: 'استفسار', emoji: '❔' }
        ]
    },
    {
        channelId: '1478486348825628773',
        embed: {
            title: '⚖️ تقديم اداره',
            description: 'مرحباً بك في قسم تقديم الإدارة. يمكنك تقديم طلبك أو بلاغك هنا.',
            fields: [
                { name: '⚖️ تقديم طلب', value: 'لتقديم طلباتك أو بلاغاتك للإدارة.', inline: false }
            ],
            image: 'https://media.discordapp.net/attachments/1438037917124788267/1515620864140378232/Gemini_Generated_Image_1bcq0k1bcq-Photoroom.png?ex=6a2fab6c&is=6a2e59ec&hm=464f1f484d6460edcabcbabb94ad9c5fb115e4ef313e432a982ef127c9585943&=&format=webp&quality=lossless&width=1620&height=810'
        },
        buttons: [
            { customId: 'open_modal_admin_submit', label: 'تقديم اداره', emoji: '⚖️' }
        ]
    },
    {
        channelId: '1474901527830335662',
        embed: {
            title: '📢 تكت الاعلانات',
            description: 'مرحباً بك في قسم طلب الإعلانات. يمكنك تقديم طلب إعلانك هنا.',
            fields: [
                { name: '📢 طلب اعلان', value: 'لتقديم طلب إعلان جديد.', inline: false }
            ],
            image: 'https://media.discordapp.net/attachments/1438037917124788267/1515620864140378232/Gemini_Generated_Image_1bcq0k1bcq-Photoroom.png?ex=6a2fab6c&is=6a2e59ec&hm=464f1f484d6460edcabcbabb94ad9c5fb115e4ef313e432a982ef127c9585943&=&format=webp&quality=lossless&width=1620&height=810'
        },
        buttons: [
            { customId: 'open_modal_ads', label: 'طلب اعلان', emoji: '📢' }
        ]
    }
];

// Map category types to their panel channel IDs
const CATEGORY_PANEL_MAP = {
    'tech': '1473635962276937879',
    'inquiry': '1473635962276937879',
    'admin_submit': '1478486348825628773',
    'ads': '1474901527830335662',
    // Backward compatibility
    'admin': '1478486348825628773',
    'general': '1473635962276937879'
};

// Category-specific configuration for modals and welcome messages
const CATEGORY_CONFIG = {
    'tech': {
        modalTitle: 'إنشاء تذكرة دعم فني',
        topicLabel: 'الموضوع',
        descLabel: 'وصف المشكلة',
        welcomeMessage: 'مرحباً بك في قسم الدعم الفني',
        categoryName: 'دعم فني'
    },
    'inquiry': {
        modalTitle: 'استفسار جديد',
        topicLabel: 'الموضوع',
        descLabel: 'وصف الاستفسار',
        welcomeMessage: 'مرحباً بك في قسم الاستفسارات',
        categoryName: 'استفسار'
    },
    'admin_submit': {
        modalTitle: 'تقديم اداره',
        topicLabel: 'الموضوع',
        descLabel: 'وصف الطلب',
        welcomeMessage: 'مرحباً بك في قسم تقديم الإدارة',
        categoryName: 'تقديم اداره'
    },
    'ads': {
        modalTitle: 'طلب اعلان',
        topicLabel: 'عنوان الإعلان',
        descLabel: 'وصف الإعلان',
        welcomeMessage: 'مرحباً بك في قسم طلب الإعلانات',
        categoryName: 'اعلانات'
    },
    // Backward compatibility
    'admin': {
        modalTitle: 'إنشاء تذكرة إدارة',
        topicLabel: 'الموضوع',
        descLabel: 'وصف المشكلة',
        welcomeMessage: 'مرحباً بك في قسم الإدارة',
        categoryName: 'إدارة'
    },
    'general': {
        modalTitle: 'استفسار جديد',
        topicLabel: 'الموضوع',
        descLabel: 'وصف الاستفسار',
        welcomeMessage: 'مرحباً بك في قسم الاستفسارات العامة',
        categoryName: 'عام'
    }
};

async function sendPanels(client) {
    console.log('[Panel] Starting to send/edit panels...');
    for (const panel of PANELS) {
        try {
            let targetChannel = client.channels.cache.get(panel.channelId);
            if (!targetChannel) {
                console.log(`[Panel] Channel ${panel.channelId} not found in cache, fetching...`);
                try {
                    targetChannel = await client.channels.fetch(panel.channelId);
                    if (!targetChannel) {
                        console.log(`[Panel] Channel ${panel.channelId} not found, skipping...`);
                        continue;
                    }
                } catch (fetchErr) {
                    console.log(`[Panel] Failed to fetch channel ${panel.channelId}: ${fetchErr.message}, skipping...`);
                    continue;
                }
            }

            // Build embed
            const embed = new EmbedBuilder()
                .setTitle(panel.embed.title)
                .setDescription(panel.embed.description)
                .setColor('#26344d');

            if (panel.embed.fields) {
                embed.addFields(panel.embed.fields);
            }
            if (panel.embed.image) {
                embed.setImage(panel.embed.image);
            }

            // Build buttons
            const row = new ActionRowBuilder().addComponents(
                panel.buttons.map(btn =>
                    new ButtonBuilder()
                        .setCustomId(btn.customId)
                        .setLabel(btn.label)
                        .setEmoji(btn.emoji)
                        .setStyle(ButtonStyle.Secondary)
                )
            );

            const payload = { embeds: [embed], components: [row] };

            // Try to find existing bot message and edit it
            try {
                const messages = await targetChannel.messages.fetch({ limit: 50 });
                const botMsg = messages.find(m => m.author.id === client.user.id);
                if (botMsg) {
                    await botMsg.edit(payload);
                    console.log(`[Panel] Edited existing panel in ${targetChannel.name}`);
                } else {
                    await targetChannel.send(payload);
                    console.log(`[Panel] Sent new panel to ${targetChannel.name}`);
                }
            } catch (editErr) {
                // If edit fails (e.g. message too old), send new one
                console.log(`[Panel] Edit failed, sending new message to ${targetChannel.name}: ${editErr.message}`);
                await targetChannel.send(payload);
                console.log(`[Panel] Sent new panel to ${targetChannel.name}`);
            }
        } catch (err) {
            console.error(`[Panel] Error sending panel to ${panel.channelId}:`, err.message);
        }
    }
    console.log('[Panel] All panels sent/edited successfully!');
}

// Map category to display name
function getCategoryName(category) {
    const config = CATEGORY_CONFIG[category];
    return config ? config.categoryName : category;
}

// Category-specific role overrides (who can view ticket rooms)
const CATEGORY_ROLE_MAP = {
    'ads': '1511708504551854161',
    'admin_submit': '1485470964903841843',
};

module.exports = { sendPanels, CATEGORY_PANEL_MAP, CATEGORY_CONFIG, CATEGORY_ROLE_MAP, PANELS, getCategoryName };