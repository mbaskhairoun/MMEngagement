const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{HEADER_LABEL}} - Marly &amp; Michael</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Great+Vibes&display=swap');
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
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
                                                    <h1 style="margin: 0; font-family: 'Great Vibes', 'Brush Script MT', cursive; font-size: 42px; font-weight: 400; color: #1A1A1A;">Thank You, {{NAME}}</h1>
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
                                                <td align="center" style="padding-bottom: 30px;">
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 16px; font-style: italic; color: #3D3D3D; line-height: 1.8;">{{SUBTITLE_MESSAGE}}</p>
                                                </td>
                                            </tr>
                                        </table>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F7E7CE; margin-bottom: 30px;">
                                            <tr>
                                                <td style="padding: 20px 25px;">
                                                    <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #B8962E;">Your Response</p>
                                                    <p style="margin: 0 0 15px 0; font-family: Georgia, serif; font-size: 20px; color: #1A1A1A;">{{STATUS}}</p>
                                                    <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #B8962E;">{{MEMBERS_LABEL}}</p>
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 16px; color: #1A1A1A; line-height: 1.8;">{{ATTENDING_MEMBERS}}</p>
                                                    {{DECLINED_SECTION}}
                                                </td>
                                            </tr>
                                        </table>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="padding-bottom: 20px;">
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: #D4AF37;">Event Details</p>
                                                </td>
                                            </tr>
                                        </table>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="padding-bottom: 20px;">
                                                    <p style="margin: 0 0 3px 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #D4AF37;">Date</p>
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 20px; color: #1A1A1A;">May 24th, 2026</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="padding-bottom: 20px;">
                                                    <p style="margin: 0 0 3px 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #D4AF37;">Time</p>
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 20px; color: #1A1A1A;">6:00 PM</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="padding-bottom: 20px;">
                                                    <p style="margin: 0 0 3px 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #D4AF37;">Venue</p>
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 20px; color: #1A1A1A;">Nai Restaurant</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="padding-bottom: 30px;">
                                                    <p style="margin: 0 0 3px 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #D4AF37;">Dress Code</p>
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 20px; color: #1A1A1A;">Spring Semi-Formal</p>
                                                </td>
                                            </tr>
                                        </table>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="padding-bottom: 30px;">
                                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td style="width: 60px; height: 1px; background-color: #D4AF37; font-size: 0; line-height: 0;">&nbsp;</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="padding-bottom: 15px;">
                                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td align="center" style="background-color: #1A1A1A; padding: 14px 40px;">
                                                                <a href="https://share.google/CJsTXrNLmr4Mc2SRK" target="_blank" style="font-family: Georgia, serif; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #FAF7F2; text-decoration: none;">View Location</a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="padding-bottom: 10px;">
                                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td align="center" style="border: 1px solid #D4AF37; padding: 14px 30px;">
                                                                <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Marly+%26+Michael%27s+Engagement+Celebration&dates=20260524T220000Z/20260525T030000Z&details=Join+us+for+our+engagement+celebration!+Dress+code:+Spring+Semi-Formal&location=Nai+Restaurant&sf=true" target="_blank" style="font-family: Georgia, serif; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #D4AF37; text-decoration: none;">Google Calendar</a>
                                                            </td>
                                                            <td style="width: 10px;">&nbsp;</td>
                                                            <td align="center" style="border: 1px solid #D4AF37; padding: 14px 30px;">
                                                                <a href="https://marlybaskha.ca/engagement.ics" target="_blank" style="font-family: Georgia, serif; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #D4AF37; text-decoration: none;">Apple Calendar</a>
                                                            </td>
                                                        </tr>
                                                    </table>
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
                            <p style="margin: 15px 0 0 0; font-family: Georgia, serif; font-size: 11px; color: #9A9A9A; letter-spacing: 1px;">&copy; 2026 - With Love</p>
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

// ── ICS Calendar Invite ──────────────────────────────────────

const ICS_CONTENT = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marly & Michael//Engagement//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "DTSTART:20260524T220000Z",
    "DTEND:20260525T030000Z",
    "SUMMARY:Marly & Michael's Engagement Celebration",
    "DESCRIPTION:Join us for our engagement celebration!\\nDress code: Spring Semi-Formal\\n\\nVenue: Nai Restaurant\\nhttps://share.google/CJsTXrNLmr4Mc2SRK",
    "LOCATION:Nai Restaurant",
    "URL:https://share.google/CJsTXrNLmr4Mc2SRK",
    "UID:marly-michael-engagement-20260524@marlybaskha.ca",
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Engagement party in 1 hour!",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
].join("\r\n");

const ICS_BASE64 = Buffer.from(ICS_CONTENT, "utf-8").toString("base64");

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES = ["Joyfully Accepts", "Regretfully Declines"];
const MAX_RECIPIENTS = 10;
const MAX_NAME_LENGTH = 100;
const MAX_MEMBERS = 20;

// ── Content builders ─────────────────────────────────────────

function getEmailContent(isAttending, isUpdate) {
    if (isUpdate) {
        return {
            headerLabel: "RSVP Updated",
            subject: "RSVP Updated \u2014 Marly & Michael's Engagement Celebration",
            subtitleMessage: isAttending
                ? "Your updated RSVP for Marly &amp; Michael&#39;s engagement celebration has been received. We&#39;re so excited to celebrate with you!"
                : "Your updated RSVP for Marly &amp; Michael&#39;s engagement celebration has been received. We&#39;ll miss you and hope to see you soon!",
            membersLabel: isAttending ? "Guests Attending" : "Attendance",
            footerMessage: isAttending
                ? "We can&#39;t wait to celebrate with you!"
                : "We hope to see you soon!",
            plainHeader: "RSVP UPDATED",
            plainSubtitle: isAttending
                ? "Your updated RSVP for Marly & Michael's engagement celebration\nhas been received. We're so excited to celebrate with you!"
                : "Your updated RSVP for Marly & Michael's engagement celebration\nhas been received. We'll miss you and hope to see you soon!",
            plainFooter: isAttending
                ? "We can't wait to celebrate with you!"
                : "We hope to see you soon!",
        };
    }

    return {
        headerLabel: "RSVP Confirmed",
        subject: "RSVP Confirmed \u2014 Marly & Michael's Engagement Celebration",
        subtitleMessage: isAttending
            ? "Your RSVP for Marly &amp; Michael&#39;s engagement celebration has been received. We&#39;re so excited to celebrate with you!"
            : "Your RSVP for Marly &amp; Michael&#39;s engagement celebration has been received. We&#39;ll miss you and hope to see you soon!",
        membersLabel: isAttending ? "Guests Attending" : "Attendance",
        footerMessage: isAttending
            ? "We can&#39;t wait to celebrate with you!"
            : "We hope to see you soon!",
        plainHeader: "RSVP CONFIRMED",
        plainSubtitle: isAttending
            ? "Your RSVP for Marly & Michael's engagement celebration\nhas been received. We're so excited to celebrate with you!"
            : "Your RSVP for Marly & Michael's engagement celebration\nhas been received. We'll miss you and hope to see you soon!",
        plainFooter: isAttending
            ? "We can't wait to celebrate with you!"
            : "We hope to see you soon!",
    };
}

function buildHtml(name, status, attendingMembers, declinedMembers, isAttending, isUpdate) {
    const content = getEmailContent(isAttending, isUpdate);
    const membersList = isAttending
        ? attendingMembers.map(m => escapeHtml(m)).join("<br>")
        : "\u2014";

    let declinedSection = "";
    if (declinedMembers && declinedMembers.length > 0) {
        const declinedList = declinedMembers.map(m => escapeHtml(m)).join("<br>");
        declinedSection = `
                                                    <p style="margin: 15px 0 8px 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #B8962E;">Unable to Attend</p>
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 16px; color: #999; line-height: 1.8;">${declinedList}</p>`;
    }

    return EMAIL_TEMPLATE
        .replace(/\{\{HEADER_LABEL\}\}/g, content.headerLabel)
        .replace("{{NAME}}", escapeHtml(name))
        .replace("{{SUBTITLE_MESSAGE}}", content.subtitleMessage)
        .replace("{{STATUS}}", escapeHtml(status))
        .replace("{{MEMBERS_LABEL}}", content.membersLabel)
        .replace("{{ATTENDING_MEMBERS}}", membersList)
        .replace("{{DECLINED_SECTION}}", declinedSection)
        .replace("{{FOOTER_MESSAGE}}", content.footerMessage);
}

function buildPlainText(name, status, attendingMembers, declinedMembers, isAttending, isUpdate) {
    const content = getEmailContent(isAttending, isUpdate);
    const membersList = isAttending
        ? attendingMembers.map(m => `  ${m}`).join("\n")
        : "  \u2014";
    const membersLabel = isAttending ? "GUESTS ATTENDING:" : "ATTENDANCE:";

    let declinedSection = "";
    if (declinedMembers && declinedMembers.length > 0) {
        declinedSection = `\n\nUNABLE TO ATTEND:\n${declinedMembers.map(m => `  ${m}`).join("\n")}`;
    }

    return `${content.plainHeader}

Thank You, ${name}

${content.plainSubtitle}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

YOUR RESPONSE: ${status}

${membersLabel}
${membersList}${declinedSection}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

EVENT DETAILS

Date: May 24th, 2026
Time: 6:00 PM
Venue: Nai Restaurant
Dress Code: Spring Semi-Formal

View Location: https://share.google/CJsTXrNLmr4Mc2SRK

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

${content.plainFooter}
Marly & Michael
`;
}

function deduplicateEmails(emails) {
    const seen = new Set();
    return emails.filter(e => {
        const lower = e.email.trim().toLowerCase();
        if (!lower || seen.has(lower)) return false;
        seen.add(lower);
        return true;
    });
}

// ── Handler ──────────────────────────────────────────────────

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Origin check — only allow requests from the website
    const origin = event.headers.origin || "";
    const referer = event.headers.referer || "";
    const allowedOrigins = ["https://marlybaskha.ca", "https://www.marlybaskha.ca"];
    const isAllowedOrigin = allowedOrigins.some(o => origin.startsWith(o) || referer.startsWith(o));

    // Allow localhost for development
    const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1") || referer.includes("localhost");

    if (!isAllowedOrigin && !isLocalhost) {
        console.warn("Blocked request from origin:", origin, "referer:", referer);
        return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const apiToken = process.env.MM_MLSN_API_TOKEN;
    if (!apiToken) {
        console.error("MM_MLSN_API_TOKEN not configured");
        return { statusCode: 500, body: JSON.stringify({ error: "Email service not configured" }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { name, status, attendingMembers, declinedMembers, emails, isUpdate } = body;

        // ── Strict input validation ──────────────────────────

        if (!name || typeof name !== "string" || name.length > MAX_NAME_LENGTH) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid name" }) };
        }

        if (!status || !VALID_STATUSES.includes(status)) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid status" }) };
        }

        if (!emails || !Array.isArray(emails) || emails.length === 0 || emails.length > MAX_RECIPIENTS) {
            return { statusCode: 400, body: JSON.stringify({ error: `Invalid emails (max ${MAX_RECIPIENTS})` }) };
        }

        // Validate each email address
        for (const e of emails) {
            if (!e.email || !EMAIL_REGEX.test(e.email.trim())) {
                return { statusCode: 400, body: JSON.stringify({ error: `Invalid email address: ${e.email}` }) };
            }
        }

        if (attendingMembers && (!Array.isArray(attendingMembers) || attendingMembers.length > MAX_MEMBERS)) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid attending members" }) };
        }

        if (declinedMembers && (!Array.isArray(declinedMembers) || declinedMembers.length > MAX_MEMBERS)) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid declined members" }) };
        }

        // ── Build email content ──────────────────────────────

        const isAttending = status === "Joyfully Accepts";
        const members = isAttending && attendingMembers && attendingMembers.length > 0
            ? attendingMembers
            : [name];
        const declined = declinedMembers && declinedMembers.length > 0 ? declinedMembers : [];
        const content = getEmailContent(isAttending, !!isUpdate);

        const html = buildHtml(name, status, members, declined, isAttending, !!isUpdate);
        const text = buildPlainText(name, status, members, declined, isAttending, !!isUpdate);
        const recipients = deduplicateEmails(emails);

        if (recipients.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "No valid emails to send to" }) };
        }

        const response = await fetch("https://api.mailersend.com/v1/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiToken}`
            },
            body: JSON.stringify({
                from: {
                    email: "info@marlybaskha.ca",
                    name: "Marly & Michael"
                },
                to: recipients.map(r => ({ email: r.email.trim(), name: r.name || name })),
                subject: content.subject,
                html: html,
                text: text,
                attachments: [
                    {
                        filename: "engagement-celebration.ics",
                        content: ICS_BASE64,
                        disposition: "attachment"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("MailerSend error:", response.status, errText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: "Failed to send confirmation email", details: errText })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `Confirmation sent to ${recipients.length} recipient(s)` })
        };
    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message })
        };
    }
};
