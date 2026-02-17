"""
Send RSVP confirmation email via MailerSend API.

Usage:
    python send-sample.py
    python send-sample.py "John Doe:john@example.com" "Jane:jane@example.com"

Requires:
    - MM_MLSN_API_TOKEN environment variable set
    - pip install requests
"""

import os
import sys
import json
import base64
import requests
from datetime import datetime

# ── Config ──────────────────────────────────────────────────
API_TOKEN = os.environ.get("MM_MLSN_API_TOKEN")
FROM_EMAIL = "info@marlybaskha.ca"
FROM_NAME = "Marly & Michael"
TEMPLATE_FILE = os.path.join(os.path.dirname(__file__), "email-template.html")

# Sample recipients — replace with real emails for testing
SAMPLE_RECIPIENTS = [
    {
        "name": "Marly Mehani",
        "email": "MarlyMehani@gmail.com",
        "status": "Joyfully Accepts",
        "attending_members": ["Michael Baskhairoun", "Marly Baskhairoun"],
    },
]


# ── ICS Calendar Invite ─────────────────────────────────────
def generate_ics():
    """Generate .ics calendar file for the engagement party."""
    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Marly & Michael//Engagement//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        "DTSTART:20260524T220000Z",
        "DTEND:20260525T030000Z",
        "SUMMARY:Marly & Michael's Engagement Celebration",
        "DESCRIPTION:Join us for our engagement celebration!\\nDress code: Spring Semi-Formal\\n\\nVenue: Nai Restaurant\\nhttps://share.google/CJsTXrNLmr4Mc2SRK",
        "LOCATION:Nai Restaurant",
        "URL:https://share.google/CJsTXrNLmr4Mc2SRK",
        f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}",
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
    ])


# ── Populate template placeholders ─────────────────────────────
def fill_template(html, recipient):
    """Replace all placeholders in the HTML template."""
    name = recipient.get("name", "Guest")
    status = recipient.get("status", "Joyfully Accepts")
    members = recipient.get("attending_members", [name])
    is_attending = status == "Joyfully Accepts"
    members_str = "<br>".join(members) if is_attending and members else "—"

    result = html.replace("{{HEADER_LABEL}}", "RSVP Confirmed")
    result = result.replace("{{NAME}}", name)
    subtitle = (
        "Your RSVP for Marly &amp; Michael's engagement celebration has been received. We're so excited to celebrate with you!"
        if is_attending else
        "Your RSVP for Marly &amp; Michael's engagement celebration has been received. We'll miss you and hope to see you soon!"
    )
    result = result.replace("{{SUBTITLE_MESSAGE}}", subtitle)
    result = result.replace("{{STATUS}}", status)
    result = result.replace("{{MEMBERS_LABEL}}", "Guests Attending" if is_attending else "Attendance")
    result = result.replace("{{ATTENDING_MEMBERS}}", members_str)
    result = result.replace("{{FOOTER_MESSAGE}}", "We can't wait to celebrate with you!" if is_attending else "We hope to see you soon!")
    return result


# ── Plain text version ───────────────────────────────────────
def generate_plain_text(recipient):
    name = recipient.get("name", "Guest")
    status = recipient.get("status", "Joyfully Accepts")
    members = recipient.get("attending_members", [name])
    members_str = "\n  ".join(members) if members else name

    return f"""RSVP CONFIRMED

Thank You, {name}

Your RSVP for Marly & Michael's engagement celebration
has been received. We're so excited to celebrate with you!

────────────────────────────

YOUR RESPONSE: {status}

GUESTS ATTENDING:
  {members_str}

────────────────────────────

EVENT DETAILS

Date: May 24th, 2026
Time: 6:00 PM
Venue: Nai Restaurant
Dress Code: Spring Semi-Formal

View Location: https://share.google/CJsTXrNLmr4Mc2SRK

────────────────────────────

We can't wait to celebrate with you!
Marly & Michael
"""


# ── Deduplicate emails ───────────────────────────────────────
def deduplicate(recipients):
    """Remove duplicate emails (case-insensitive), keeping the first occurrence."""
    seen = set()
    unique = []
    for r in recipients:
        email_lower = r["email"].strip().lower()
        if email_lower not in seen:
            seen.add(email_lower)
            unique.append(r)
    return unique


# ── Send email ───────────────────────────────────────────────
def send_email(recipients):
    if not API_TOKEN:
        print("ERROR: MM_MLSN_API_TOKEN environment variable not set.")
        print("Set it with: export MM_MLSN_API_TOKEN=your_token_here")
        sys.exit(1)

    # Load HTML template
    with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
        html_template = f.read()

    # Generate calendar invite
    ics_content = generate_ics()
    ics_base64 = base64.b64encode(ics_content.encode("utf-8")).decode("utf-8")

    # Deduplicate
    recipients = deduplicate(recipients)

    print(f"\nSending to {len(recipients)} recipient(s):")
    for r in recipients:
        print(f"  - {r['name']} <{r['email']}>")

    # Send one personalized email per recipient
    success = 0
    failed = 0
    for r in recipients:
        html_content = fill_template(html_template, r)
        plain_text = generate_plain_text(r)

        payload = {
            "from": {
                "email": FROM_EMAIL,
                "name": FROM_NAME,
            },
            "to": [{"email": r["email"], "name": r["name"]}],
            "subject": "RSVP Confirmed — Marly & Michael's Engagement Celebration",
            "html": html_content,
            "text": plain_text,
            "attachments": [
                {
                    "filename": "engagement-celebration.ics",
                    "content": ics_base64,
                    "disposition": "attachment",
                }
            ],
        }

        print(f"\nSending to {r['name']} <{r['email']}>...")
        response = requests.post(
            "https://api.mailersend.com/v1/email",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {API_TOKEN}",
            },
            data=json.dumps(payload),
        )

        if response.status_code == 202:
            print(f"  Sent successfully!")
            success += 1
        else:
            print(f"  Failed. Status: {response.status_code}")
            print(f"  Response: {response.text}")
            failed += 1

    print(f"\nDone. {success} sent, {failed} failed.")


# ── Main ─────────────────────────────────────────────────────
if __name__ == "__main__":
    # You can modify SAMPLE_RECIPIENTS above, or pass emails as arguments:
    #   python send-sample.py "John Doe:john@example.com" "Jane:jane@example.com"
    # CLI args use sample status/members; edit SAMPLE_RECIPIENTS for full control.
    if len(sys.argv) > 1:
        recipients = []
        for arg in sys.argv[1:]:
            if ":" in arg:
                name, email = arg.split(":", 1)
            else:
                name, email = arg.strip(), arg.strip()
            recipients.append({
                "name": name.strip(),
                "email": email.strip(),
                "status": "Joyfully Accepts",
                "attending_members": [name.strip()],
            })
    else:
        recipients = SAMPLE_RECIPIENTS

    send_email(recipients)
