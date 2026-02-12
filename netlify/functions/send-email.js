exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Check for auth token (Firebase ID token from admin)
    const authHeader = event.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
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
                html: html
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
