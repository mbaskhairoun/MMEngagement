const FIREBASE_API_KEY = "AIzaSyBCtD1ZhcUND9bbOo1t7bqwiTB64asWVuY";

// Verify Firebase ID token via Google's REST API (no admin SDK needed)
async function verifyFirebaseToken(idToken) {
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
        }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.users && data.users.length > 0 ? data.users[0] : null;
}

// ── Branded template (matches the RSVP confirmation look) ────

const EMAIL_SHELL = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{HEADER_LABEL}} - Marly &amp; Michael</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Great+Vibes&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">{{PREHEADER}}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF7F2;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #FFFDF9; border: 1px solid #e8e0d4;">
                    <tr>
                        <td style="height: 4px; background: linear-gradient(90deg, #D4AF37, #E8D48B, #D4AF37); font-size: 0; line-height: 0;">&nbsp;</td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 30px 0 30px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #D4AF37;">
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="padding-bottom: 20px;">
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #D4AF37;">{{HEADER_LABEL}}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="padding-bottom: 10px;">
                                                    <h1 style="margin: 0; font-family: 'Great Vibes', 'Brush Script MT', cursive; font-size: 38px; font-weight: 400; color: #1A1A1A;">Dear {{NAME}}</h1>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="padding-bottom: 25px;">
                                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td style="width: 80px; height: 0; border-top: 1px solid #D4AF37; font-size: 0; line-height: 0;">&nbsp;</td>
                                                            <td style="padding: 0 8px;">
                                                                <span style="display: inline-block; width: 5px; height: 5px; background-color: #D4AF37; transform: rotate(45deg); -webkit-transform: rotate(45deg);">&#8203;</span>
                                                            </td>
                                                            <td style="width: 80px; height: 0; border-top: 1px solid #D4AF37; font-size: 0; line-height: 0;">&nbsp;</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 0 5px 10px 5px; font-family: Georgia, serif; font-size: 16px; color: #3D3D3D; line-height: 1.8;">
                                                    {{BODY_HTML}}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 30px 30px 40px 30px;">
                            <p style="margin: 0 0 10px 0; font-family: Georgia, serif; font-size: 14px; font-style: italic; color: #6B6B6B;">{{FOOTER_MESSAGE}}</p>
                            <p style="margin: 0 0 20px 0; font-family: 'Great Vibes', 'Brush Script MT', cursive; font-size: 28px; color: #D4AF37;">Marly &amp; Michael</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="width: 60px; height: 1px; background-color: #D4AF37; font-size: 0; line-height: 0;">&nbsp;</td>
                                </tr>
                            </table>
                            <p style="margin: 15px 0 4px 0; font-family: Georgia, serif; font-size: 11px; color: #9A9A9A; letter-spacing: 1px;">&copy; 2026 - With Love</p>
                            <p style="margin: 0; font-family: Georgia, serif; font-size: 10px; color: #B5B5B5;">
                                You're receiving this because you were invited to Marly &amp; Michael's engagement celebration.<br>
                                To stop receiving these emails, reply with "unsubscribe".
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="height: 4px; background: linear-gradient(90deg, #D4AF37, #E8D48B, #D4AF37); font-size: 0; line-height: 0;">&nbsp;</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// If body has no HTML tags, treat as plain text and convert paragraph/line breaks
function normalizeBodyHtml(raw) {
    const body = String(raw || "").trim();
    if (!body) return "";
    const hasTags = /<[a-z][\s\S]*>/i.test(body);
    if (hasTags) return body;
    return body
        .split(/\n{2,}/)
        .map(para => `<p style="margin: 0 0 16px 0;">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function htmlToPlainText(html) {
    return String(html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<li>/gi, "- ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function firstName(name) {
    if (!name) return "Friend";
    const cleaned = String(name).trim().split(/\s+/)[0];
    return cleaned || "Friend";
}

function personalize(text, recipient, { escape } = { escape: false }) {
    if (!text) return "";
    const name = recipient.name || recipient.email;
    const fn = firstName(name);
    const sub = (v) => (escape ? escapeHtml(v) : v);
    return String(text)
        .replace(/\{\{\s*name\s*\}\}/gi, sub(name))
        .replace(/\{\{\s*first_name\s*\}\}/gi, sub(fn))
        .replace(/\{\{\s*email\s*\}\}/gi, sub(recipient.email));
}

function buildMessage({ recipient, subject, headerLabel, bodyHtml, footerMessage, preheader, fromEmail, fromName }) {
    const personalSubject = personalize(subject, recipient);
    const personalBodyHtml = personalize(bodyHtml, recipient, { escape: true });
    const personalBodyText = personalize(htmlToPlainText(bodyHtml), recipient);
    const greetName = escapeHtml(firstName(recipient.name || recipient.email));

    const html = EMAIL_SHELL
        .replace(/\{\{HEADER_LABEL\}\}/g, escapeHtml(headerLabel))
        .replace("{{PREHEADER}}", escapeHtml(preheader || personalSubject))
        .replace("{{NAME}}", greetName)
        .replace("{{BODY_HTML}}", personalBodyHtml)
        .replace("{{FOOTER_MESSAGE}}", escapeHtml(footerMessage));

    const text = `${headerLabel.toUpperCase()}\n\nDear ${firstName(recipient.name || recipient.email)},\n\n${personalBodyText}\n\n${footerMessage}\nMarly & Michael`;

    return {
        from: { email: fromEmail, name: fromName },
        to: [{ email: recipient.email.trim(), name: recipient.name || undefined }],
        reply_to: { email: fromEmail, name: fromName },
        subject: personalSubject,
        html,
        text,
        headers: [
            { name: "List-Unsubscribe", value: `<mailto:${fromEmail}?subject=Unsubscribe>` },
            { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" }
        ]
    };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BULK_BATCH_SIZE = 500; // MailerSend bulk-email cap per request

// ── Handler ──────────────────────────────────────────────────

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const authHeader = event.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
    const idToken = authHeader.slice(7);
    const user = await verifyFirebaseToken(idToken);
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired token" }) };
    }

    const apiToken = process.env.MM_MLSN_API_TOKEN;
    if (!apiToken) {
        return { statusCode: 500, body: JSON.stringify({ error: "MailerSend API token not configured" }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }

    const {
        to,
        subject,
        html,
        from_email,
        from_name,
        header_label,
        footer_message,
        preheader
    } = payload;

    if (!Array.isArray(to) || to.length === 0 || !subject || !html) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields: to, subject, html" }) };
    }

    const fromEmail = (from_email || "info@marlybaskha.ca").trim();
    const fromName = from_name || "Marly & Michael";
    const headerLabel = header_label || "A Note From Marly & Michael";
    const footerMessage = footer_message || "With love,";

    // Dedupe + validate
    const seen = new Set();
    const recipients = [];
    for (const r of to) {
        if (!r || !r.email) continue;
        const email = String(r.email).trim();
        if (!EMAIL_REGEX.test(email)) continue;
        const key = email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push({ email, name: r.name ? String(r.name).trim() : "" });
    }

    if (recipients.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "No valid recipients" }) };
    }

    const bodyHtml = normalizeBodyHtml(html);

    const messages = recipients.map(recipient =>
        buildMessage({ recipient, subject, headerLabel, bodyHtml, footerMessage, preheader, fromEmail, fromName })
    );

    try {
        const responses = [];
        for (let i = 0; i < messages.length; i += BULK_BATCH_SIZE) {
            const batch = messages.slice(i, i + BULK_BATCH_SIZE);
            const response = await fetch("https://api.mailersend.com/v1/bulk-email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiToken}`
                },
                body: JSON.stringify(batch)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("MailerSend bulk-email error:", response.status, errText);
                return {
                    statusCode: response.status,
                    body: JSON.stringify({ error: "Failed to queue emails", details: errText })
                };
            }

            responses.push(await response.json());
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Queued ${recipients.length} individual email(s) for delivery`,
                bulk_responses: responses
            })
        };
    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message })
        };
    }
};
