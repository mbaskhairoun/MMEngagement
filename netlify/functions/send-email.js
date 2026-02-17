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

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Verify Firebase ID token
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

    try {
        const { to, subject, html, from_email, from_name } = JSON.parse(event.body);

        if (!to || !to.length || !subject || !html) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields: to, subject, html" }) };
        }

        // Strip HTML tags to generate plain text version
        const text = html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<li>/gi, '- ')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const response = await fetch("https://api.mailersend.com/v1/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiToken}`
            },
            body: JSON.stringify({
                from: {
                    email: from_email || "info@marlybaskha.ca",
                    name: from_name || "Marly & Michael"
                },
                to: to,
                subject: subject,
                html: html,
                text: text
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("MailerSend error:", response.status, errText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: "Failed to send email", details: errText })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: `Email sent to ${to.length} recipient(s)` })
        };
    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message })
        };
    }
};
