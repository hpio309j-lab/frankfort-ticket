const { db } = require('../db/schema');

async function generateTranscript(ticketId) {
    const ticket = await db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketId);
    const messages = await db.prepare('SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId);
    if (!ticket) return '<h1>التذكرة غير موجودة</h1>';

    let html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>نسخة محادثة التذكرة #${ticketId}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #36393f; color: #dcddde; padding: 20px; text-align: right; }
            .chat-container { max-width: 800px; margin: 0 auto; }
            .message { margin-bottom: 10px; padding: 15px; border-radius: 8px; position: relative; }
            .message.user { border-right: 4px solid #5865F2; background: #2f3136; }
            .message.admin { border-right: 4px solid #FAA61A; background: #2f3136; } 
            .meta { font-size: 0.85em; color: #72767d; margin-bottom: 8px; }
            .content { font-size: 1.05em; line-height: 1.4; }
            h1 { color: #fff; border-bottom: 1px solid #4f545c; padding-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <h1>نسخة محادثة التذكرة #${ticketId}</h1>
            <p>معرف المستخدم: ${ticket.user_id}</p>
            <p>القسم: ${ticket.category}</p>
            <p>الموضوع: ${ticket.topic}</p>
            <hr>
    `;

    messages.forEach(msg => {
        const type = msg.author_id === ticket.user_id ? 'user' : 'admin';
        const label = type === 'user' ? 'المستخدم' : 'الدعم الفني';
        html += `
            <div class="message ${type}">
                <div class="meta"><b>${label}</b> (${msg.author_id}) - ${msg.created_at}</div>
                <div class="content">${msg.content}</div>
            </div>
        `;
    });

    html += `</div></body></html>`;
    return html;
}

module.exports = { generateTranscript };
