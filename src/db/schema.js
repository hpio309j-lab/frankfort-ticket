const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://dtekonqfsabezyqhxucz.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_igKDTgriAbBrHDeTv1y86A_PYUEgbHM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function initDb() {
    console.log('Using Supabase Cloud Database. Make sure you run the schema.sql in your Supabase SQL Editor.');
}

async function executeQuery(sql, args, type) {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    try {
        // 1. SELECT user_id FROM tickets WHERE channel_id = ? AND status = ?
        if (cleanSql.includes('SELECT user_id FROM tickets') && cleanSql.includes('channel_id = ?') && cleanSql.includes('status = ?')) {
            const { data, error } = await supabase.from('tickets').select('user_id').eq('channel_id', args[0]).eq('status', args[1]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 2. SELECT * FROM users WHERE user_id = ?
        if (cleanSql.includes('SELECT * FROM users WHERE user_id = ?')) {
            const { data, error } = await supabase.from('users').select('*').eq('user_id', args[0]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 3. SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = ?
        if (cleanSql.includes('SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = ?')) {
            const { count, error } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('user_id', args[0]).eq('status', args[1]);
            if (error) throw error;
            return { count: count || 0 };
        }

        // 4. SELECT * FROM notes WHERE ticket_id = ?
        if (cleanSql.includes('SELECT * FROM notes WHERE ticket_id = ?')) {
            const { data, error } = await supabase.from('notes').select('*').eq('ticket_id', args[0]);
            if (error) throw error;
            return data || [];
        }

        // 5. SELECT category, claimed_by FROM tickets WHERE ticket_id = ?
        if (cleanSql.includes('SELECT category, claimed_by FROM tickets WHERE ticket_id = ?')) {
            const { data, error } = await supabase.from('tickets').select('category, claimed_by').eq('ticket_id', args[0]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 6. SELECT * FROM saved_replies WHERE guild_id = ? AND LOWER(trigger) = ?
        // or trigger = ?
        if (cleanSql.includes('FROM saved_replies') && cleanSql.includes('trigger') && cleanSql.includes('guild_id')) {
            if (type === 'all') {
                // SELECT * FROM saved_replies WHERE guild_id = ? ORDER BY created_at DESC
                const { data, error } = await supabase.from('saved_replies').select('*').eq('guild_id', args[0]).order('created_at', { ascending: false });
                if (error) throw error;
                return data || [];
            }
            const { data, error } = await supabase.from('saved_replies').select('*').eq('guild_id', args[0]).ilike('trigger', args[1]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 7. SELECT ticket_id FROM tickets WHERE channel_id = ? AND status = ?
        if (cleanSql.includes('SELECT ticket_id FROM tickets WHERE channel_id = ? AND status = ?')) {
            const { data, error } = await supabase.from('tickets').select('ticket_id').eq('channel_id', args[0]).eq('status', args[1]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 8. INSERT INTO messages (ticket_id, author_id, content) VALUES (?, ?, ?)
        if (cleanSql.includes('INSERT INTO messages')) {
            const { data, error } = await supabase.from('messages').insert({
                ticket_id: parseInt(args[0]),
                author_id: args[1],
                content: args[2]
            }).select('message_id').maybeSingle();
            if (error) throw error;
            return { lastInsertRowid: data ? data.message_id : null };
        }

        // 9. SELECT log_channel_id FROM guild_configs WHERE guild_id = ?
        if (cleanSql.includes('SELECT log_channel_id FROM guild_configs WHERE guild_id = ?')) {
            const { data, error } = await supabase.from('guild_configs').select('log_channel_id').eq('guild_id', args[0]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 10. SELECT * FROM guild_configs WHERE guild_id = ?
        if (cleanSql.includes('SELECT * FROM guild_configs WHERE guild_id = ?')) {
            const { data, error } = await supabase.from('guild_configs').select('*').eq('guild_id', args[0]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 11. SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND DATE(created_at) = ?
        if (cleanSql.includes('SELECT COUNT(*) as count FROM tickets') && cleanSql.includes('DATE(created_at)')) {
            const startOfDay = `${args[1]}T00:00:00.000Z`;
            const endOfDay = `${args[1]}T23:59:59.999Z`;
            const { count, error } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('user_id', args[0]).gte('created_at', startOfDay).lte('created_at', endOfDay);
            if (error) throw error;
            return { count: count || 0 };
        }

        // 12. SELECT * FROM tickets WHERE ticket_id = ?
        if (cleanSql.includes('SELECT * FROM tickets WHERE ticket_id = ?')) {
            const { data, error } = await supabase.from('tickets').select('*').eq('ticket_id', parseInt(args[0])).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 13. UPDATE tickets SET claimed_by = ? WHERE ticket_id = ?
        if (cleanSql.includes('UPDATE tickets SET claimed_by = ? WHERE ticket_id = ?')) {
            const { error } = await supabase.from('tickets').update({ claimed_by: args[0] }).eq('ticket_id', parseInt(args[1]));
            if (error) throw error;
            return { changes: 1 };
        }

        // 14. INSERT INTO support_points (user_id, guild_id, total_points, tickets_closed) ON CONFLICT
        if (cleanSql.includes('INSERT INTO support_points')) {
            const { data: existing, error: fetchErr } = await supabase.from('support_points').select('*').eq('user_id', args[0]).eq('guild_id', args[1]).maybeSingle();
            if (fetchErr) throw fetchErr;

            if (existing) {
                const { error } = await supabase.from('support_points').update({ total_points: (existing.total_points || 0) + 1 }).eq('user_id', args[0]).eq('guild_id', args[1]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('support_points').insert({ user_id: args[0], guild_id: args[1], total_points: 1, tickets_closed: 0 });
                if (error) throw error;
            }
            return { changes: 1 };
        }

        // 15. UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE ticket_id = ?
        if (cleanSql.includes('UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP')) {
            const { error } = await supabase.from('tickets').update({ status: args[0], closed_at: new Date().toISOString() }).eq('ticket_id', parseInt(args[1]));
            if (error) throw error;
            return { changes: 1 };
        }

        // 16. UPDATE tickets SET rating = ? WHERE ticket_id = ?
        if (cleanSql.includes('UPDATE tickets SET rating = ? WHERE ticket_id = ?')) {
            const { error } = await supabase.from('tickets').update({ rating: parseInt(args[0]) }).eq('ticket_id', parseInt(args[1]));
            if (error) throw error;
            return { changes: 1 };
        }

        // 17. SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
        if (cleanSql.includes('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')) {
            const { data, error } = await supabase.from('tickets').select('*').eq('user_id', args[0]).order('created_at', { ascending: false }).limit(5);
            if (error) throw error;
            return data || [];
        }

        // 18. INSERT INTO notes (ticket_id, admin_id, note_content) VALUES (?, ?, ?)
        if (cleanSql.includes('INSERT INTO notes')) {
            const { error } = await supabase.from('notes').insert({
                ticket_id: parseInt(args[0]),
                admin_id: args[1],
                note_content: args[2]
            });
            if (error) throw error;
            return { changes: 1 };
        }

        // 19. SELECT user_id FROM tickets WHERE ticket_id = ?
        if (cleanSql.includes('SELECT user_id FROM tickets WHERE ticket_id = ?')) {
            const { data, error } = await supabase.from('tickets').select('user_id').eq('ticket_id', parseInt(args[0])).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 20. INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)
        if (cleanSql.includes('INSERT OR IGNORE INTO users') || cleanSql.includes('INSERT INTO users')) {
            const { error } = await supabase.from('users').upsert({ user_id: args[0], username: args[1] }, { onConflict: 'user_id' });
            if (error) throw error;
            return { changes: 1 };
        }

        // 21. INSERT INTO tickets (user_id, channel_id, category, topic, description, status) VALUES (?, ?, ?, ?, ?, ?)
        if (cleanSql.includes('INSERT INTO tickets')) {
            const { data, error } = await supabase.from('tickets').insert({
                user_id: args[0],
                channel_id: args[1],
                category: args[2],
                topic: args[3],
                description: args[4],
                status: args[5]
            }).select('ticket_id').maybeSingle();
            if (error) throw error;
            return { lastInsertRowid: data ? data.ticket_id : null };
        }

        // 22. SELECT * FROM welcome_config WHERE guild_id = ?
        if (cleanSql.includes('SELECT * FROM welcome_config WHERE guild_id = ?')) {
            const { data, error } = await supabase.from('welcome_config').select('*').eq('guild_id', args[0]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 23. INSERT INTO welcome_config ... ON CONFLICT
        if (cleanSql.includes('INSERT INTO welcome_config')) {
            const { error } = await supabase.from('welcome_config').upsert({
                guild_id: args[0],
                channel_id: args[1],
                message: args[2],
                enabled: args[3] === 1 || args[3] === true
            }, { onConflict: 'guild_id' });
            if (error) throw error;
            return { changes: 1 };
        }

        // 24. SELECT * FROM guild_configs (with no WHERE clause, or SELECT * FROM guild_configs)
        if (cleanSql.includes('SELECT * FROM guild_configs') && !cleanSql.includes('WHERE')) {
            const { data, error } = await supabase.from('guild_configs').select('*');
            if (error) throw error;
            return data || [];
        }

        // 25. SELECT * FROM tickets WHERE status = 'open' AND first_response_at IS NULL (Delayed tickets)
        if (cleanSql.includes('first_response_at IS NULL') && cleanSql.includes('tickets') && cleanSql.includes('status = \'open\'')) {
            const { data, error } = await supabase.from('tickets').select('*').eq('status', 'open').is('first_response_at', null);
            if (error) throw error;
            const alertHours = args[0] || 24;
            const thresholdTime = new Date(Date.now() - alertHours * 60 * 60 * 1000);
            return (data || []).filter(ticket => new Date(ticket.created_at) < thresholdTime);
        }

        // 26. UPDATE welcome_config SET enabled = ? WHERE guild_id = ?
        if (cleanSql.includes('UPDATE welcome_config SET enabled = ? WHERE guild_id = ?')) {
            const { error } = await supabase.from('welcome_config').update({ enabled: args[0] === 1 || args[0] === true }).eq('guild_id', args[1]);
            if (error) throw error;
            return { changes: 1 };
        }

        // 27. SELECT * FROM support_points WHERE user_id = ? AND guild_id = ?
        if (cleanSql.includes('SELECT * FROM support_points WHERE user_id = ? AND guild_id = ?')) {
            const { data, error } = await supabase.from('support_points').select('*').eq('user_id', args[0]).eq('guild_id', args[1]).maybeSingle();
            if (error) throw error;
            return data;
        }

        // 28. SELECT user_id, total_points FROM support_points WHERE guild_id = ? ORDER BY total_points DESC
        if (cleanSql.includes('SELECT user_id, total_points FROM support_points')) {
            if (cleanSql.includes('LIMIT')) {
                const { data, error } = await supabase.from('support_points').select('user_id, total_points, tickets_closed, average_rating').eq('guild_id', args[0]).order('total_points', { ascending: false }).limit(5);
                if (error) throw error;
                return data || [];
            } else {
                const { data, error } = await supabase.from('support_points').select('user_id, total_points').eq('guild_id', args[0]).order('total_points', { ascending: false });
                if (error) throw error;
                return data || [];
            }
        }

        // 29. UPDATE support_points SET total_points = 0, tickets_closed = 0, average_rating = 0 WHERE user_id = ? AND guild_id = ?
        if (cleanSql.includes('UPDATE support_points SET total_points = 0')) {
            const { error } = await supabase.from('support_points').update({ total_points: 0, tickets_closed: 0, average_rating: 0 }).eq('user_id', args[0]).eq('guild_id', args[1]);
            if (error) throw error;
            return { changes: 1 };
        }

        // 30. DELETE FROM saved_replies WHERE guild_id = ? AND trigger = ?
        if (cleanSql.includes('DELETE FROM saved_replies')) {
            const { error } = await supabase.from('saved_replies').delete().eq('guild_id', args[0]).eq('trigger', args[1]);
            if (error) throw error;
            return { changes: 1 };
        }

        // 31. UPDATE guild_configs SET alert_hours = ? WHERE guild_id = ?
        if (cleanSql.includes('UPDATE guild_configs SET alert_hours = ? WHERE guild_id = ?')) {
            const { error } = await supabase.from('guild_configs').update({ alert_hours: parseInt(args[0]) }).eq('guild_id', args[1]);
            if (error) throw error;
            return { changes: 1 };
        }

        // 32. UPDATE guild_configs SET tech_welcome = ?, admin_welcome = ?, general_welcome = ?
        if (cleanSql.includes('UPDATE guild_configs SET') && (cleanSql.includes('welcome') || cleanSql.includes('alert_hours'))) {
            let field = '';
            if (cleanSql.includes('tech_welcome')) field = 'tech_welcome';
            else if (cleanSql.includes('admin_welcome')) field = 'admin_welcome';
            else if (cleanSql.includes('general_welcome')) field = 'general_welcome';

            if (field) {
                const { error } = await supabase.from('guild_configs').update({ [field]: args[0] }).eq('guild_id', args[1]);
                if (error) throw error;
            }
            return { changes: 1 };
        }

        // 33. INSERT INTO guild_configs
        if (cleanSql.includes('INSERT INTO guild_configs')) {
            const { error } = await supabase.from('guild_configs').upsert({
                guild_id: args[0],
                tech_category_id: args[1],
                admin_category_id: args[2],
                general_category_id: args[3],
                support_role_id: args[4],
                log_channel_id: args[5]
            }, { onConflict: 'guild_id' });
            if (error) throw error;
            return { changes: 1 };
        }

        // 34. SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC
        if (cleanSql.includes('SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC')) {
            const { data, error } = await supabase.from('messages').select('*').eq('ticket_id', parseInt(args[0])).order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        }

        // 35. SELECT COUNT(*) as count FROM tickets (Stats queries)
        if (cleanSql.includes('SELECT COUNT(*) as count FROM tickets')) {
            let query = supabase.from('tickets').select('*', { count: 'exact', head: true });
            if (cleanSql.includes('WHERE status = ?')) {
                query = query.eq('status', args[0]);
            }
            const { count, error } = await query;
            if (error) throw error;
            return { count: count || 0 };
        }

        // 36. SELECT AVG(rating) as avg FROM tickets WHERE rating IS NOT NULL
        if (cleanSql.includes('SELECT AVG(rating) as avg FROM tickets')) {
            const { data, error } = await supabase.from('tickets').select('rating').not('rating', 'is', null);
            if (error) throw error;
            if (!data || data.length === 0) return { avg: 0 };
            const sum = data.reduce((acc, curr) => acc + (curr.rating || 0), 0);
            return { avg: sum / data.length };
        }

        // 37. SELECT AVG( (julianday(first_response_at) - julianday(created_at)) * 24 ) as avg_hours
        if (cleanSql.includes('first_response_at IS NOT NULL') && cleanSql.includes('julianday')) {
            const { data, error } = await supabase.from('tickets').select('created_at, first_response_at').not('first_response_at', 'is', null);
            if (error) throw error;
            if (!data || data.length === 0) return { avg_hours: 0 };
            let totalHours = 0;
            data.forEach(t => {
                const diffMs = new Date(t.first_response_at) - new Date(t.created_at);
                totalHours += diffMs / (1000 * 60 * 60);
            });
            return { avg_hours: totalHours / data.length };
        }

        // 38. SELECT category, COUNT(*) as count FROM tickets GROUP BY category
        if (cleanSql.includes('SELECT category, COUNT(*) as count FROM tickets')) {
            const { data, error } = await supabase.from('tickets').select('category');
            if (error) throw error;
            const counts = {};
            (data || []).forEach(t => {
                counts[t.category] = (counts[t.category] || 0) + 1;
            });
            return Object.entries(counts).map(([category, count]) => ({ category, count }));
        }

        // 39. SELECT claimed_by, COUNT(*) as tickets_closed, AVG(rating) as avg_rating FROM tickets WHERE claimed_by IS NOT NULL AND status = 'closed' GROUP BY claimed_by ORDER BY tickets_closed DESC LIMIT 5
        if (cleanSql.includes('claimed_by IS NOT NULL') && cleanSql.includes('tickets_closed DESC')) {
            const { data, error } = await supabase.from('tickets').select('claimed_by, rating').eq('status', 'closed').not('claimed_by', 'is', null);
            if (error) throw error;
            const groups = {};
            (data || []).forEach(t => {
                if (!groups[t.claimed_by]) {
                    groups[t.claimed_by] = { claimed_by: t.claimed_by, tickets_closed: 0, total_rating: 0, rating_count: 0 };
                }
                groups[t.claimed_by].tickets_closed += 1;
                if (t.rating !== null && t.rating !== undefined) {
                    groups[t.claimed_by].total_rating += t.rating;
                    groups[t.claimed_by].rating_count += 1;
                }
            });
            const result = Object.values(groups).map(g => ({
                claimed_by: g.claimed_by,
                tickets_closed: g.tickets_closed,
                avg_rating: g.rating_count > 0 ? g.total_rating / g.rating_count : null
            }));
            result.sort((a, b) => b.tickets_closed - a.tickets_closed);
            return result.slice(0, 5);
        }

        // 40. INSERT INTO saved_replies (guild_id, trigger, content, created_by) VALUES (?, ?, ?, ?)
        if (cleanSql.includes('INSERT INTO saved_replies')) {
            const { error } = await supabase.from('saved_replies').insert({
                guild_id: args[0],
                trigger: args[1],
                content: args[2],
                created_by: args[3]
            });
            if (error) throw error;
            return { changes: 1 };
        }

        // 41. UPDATE saved_replies SET content = ?, created_by = ? WHERE guild_id = ? AND trigger = ?
        if (cleanSql.includes('UPDATE saved_replies SET content = ?')) {
            const { error } = await supabase.from('saved_replies').update({
                content: args[0],
                created_by: args[1]
            }).eq('guild_id', args[2]).eq('trigger', args[3]);
            if (error) throw error;
            return { changes: 1 };
        }

        // 42. UPDATE support_points SET tickets_closed = tickets_closed + 1 WHERE user_id = ? AND guild_id = ?
        if (cleanSql.includes('UPDATE support_points SET tickets_closed = tickets_closed + 1')) {
            const { data: existing, error: fetchErr } = await supabase.from('support_points').select('*').eq('user_id', args[0]).eq('guild_id', args[1]).maybeSingle();
            if (fetchErr) throw fetchErr;

            if (existing) {
                const { error } = await supabase.from('support_points').update({ tickets_closed: (existing.tickets_closed || 0) + 1 }).eq('user_id', args[0]).eq('guild_id', args[1]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('support_points').insert({ user_id: args[0], guild_id: args[1], total_points: 0, tickets_closed: 1, average_rating: 0 });
                if (error) throw error;
            }
            return { changes: 1 };
        }

        // 43. UPDATE support_points SET average_rating = ? WHERE user_id = ? AND guild_id = ?
        if (cleanSql.includes('UPDATE support_points SET average_rating')) {
            const userId = args[0];
            const guildId = args[1];
            
            const { data: tickets, error: ticketErr } = await supabase.from('tickets')
                .select('rating')
                .eq('claimed_by', userId)
                .eq('status', 'closed')
                .not('rating', 'is', null);
            if (ticketErr) throw ticketErr;
            
            let avgRating = 0;
            if (tickets && tickets.length > 0) {
                const sum = tickets.reduce((acc, curr) => acc + (curr.rating || 0), 0);
                avgRating = sum / tickets.length;
            }
            
            const { error } = await supabase.from('support_points')
                .update({ average_rating: avgRating })
                .eq('user_id', userId)
                .eq('guild_id', guildId);
            if (error) throw error;
            return { changes: 1 };
        }

        // 44. UPDATE tickets SET first_response_at = CURRENT_TIMESTAMP WHERE ticket_id = ?
        if (cleanSql.includes('UPDATE tickets SET first_response_at = CURRENT_TIMESTAMP')) {
            const { error } = await supabase.from('tickets').update({ first_response_at: new Date().toISOString() }).eq('ticket_id', parseInt(args[0]));
            if (error) throw error;
            return { changes: 1 };
        }

        console.log('[SUPABASE WARNING] Unhandled Query:', sql);
        return null;
    } catch (err) {
        console.error('[SUPABASE ERROR] executing query:', sql, err.message);
        throw err;
    }
}

class DBWrapper {
    prepare(sql) {
        return {
            get: async (...args) => {
                return await executeQuery(sql, args, 'get');
            },
            run: async (...args) => {
                return await executeQuery(sql, args, 'run');
            },
            all: async (...args) => {
                return await executeQuery(sql, args, 'all');
            }
        };
    }
}

const db = new DBWrapper();

module.exports = { db, initDb };
