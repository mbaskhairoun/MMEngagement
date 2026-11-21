import { wedding } from "@/content/wedding";
import type { Guest, RsvpPublic } from "@/lib/db";
import { writeEmailLog, type EmailLogType } from "@/lib/data/email-logs";
import { PALETTE, SERIF, button, escapeHtml, eyebrow, paragraph, renderLayout, rule } from "@/lib/email-template";
import { buildWeddingIcs, localDateTime } from "@/lib/ics";
import { EMAIL_REGEX } from "@/lib/validation";

export const MAILERSEND_ENDPOINT = "https://api.mailersend.com/v1/email";
export const SEND_CONCURRENCY = 5;

export type Recipient = { email: string; name?: string | null };

export type SendFailure = { email: string; error: string };

export type SendOutcome = { skipped: true } | { skipped: false; succeeded: number; failed: SendFailure[] };

type Message = {
  from: { email: string; name: string };
  to: Array<{ email: string; name?: string }>;
  reply_to: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; disposition: "attachment" }>;
};

type PostResult = { email: string; ok: boolean; status: number | null; error?: string };

// ── Personalisation helpers ─────────────────────────────────

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "Friend";
}

export function personalize(text: string, recipient: Recipient, escape = false): string {
  const name = recipient.name?.trim() || recipient.email;
  const sub = (v: string) => (escape ? escapeHtml(v) : v);
  return text
    .replace(/\{\{\s*name\s*\}\}/gi, () => sub(name))
    .replace(/\{\{\s*first_name\s*\}\}/gi, () => sub(firstName(recipient.name || recipient.email)))
    .replace(/\{\{\s*email\s*\}\}/gi, () => sub(recipient.email));
}

/** Valid, trimmed, case-insensitively unique recipients in their original order. */
export function dedupeRecipients(list: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of list) {
    const email = r.email.trim();
    const key = email.toLowerCase();
    if (!EMAIL_REGEX.test(email) || seen.has(key)) continue;
    seen.add(key);
    out.push({ email, name: r.name?.trim() || null });
  }
  return out;
}

/** Plain text (no tags) becomes escaped paragraphs; HTML authored by the admin passes through. */
export function normalizeBodyHtml(raw: string): string {
  const body = raw.trim();
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  return body
    .split(/\n{2,}/)
    .map((para) => paragraph(escapeHtml(para).replace(/\n/g, "<br>")))
    .join("");
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6])>/gi, "\n\n")
    .replace(/<\/(div|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Transport ───────────────────────────────────────────────

function apiToken(): string | null {
  return process.env.MAILERSEND_API_TOKEN?.trim() || null;
}

const sender = () => ({ email: wedding.mail.fromEmail, name: wedding.mail.fromName });

async function post(token: string, message: Message): Promise<PostResult> {
  const email = message.to[0].email;
  try {
    const res = await fetch(MAILERSEND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(message),
    });
    if (res.ok) return { email, ok: true, status: res.status };
    return { email, ok: false, status: res.status, error: (await res.text()).slice(0, 500) || res.statusText };
  } catch (err) {
    return { email, ok: false, status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** One message per recipient, sent SEND_CONCURRENCY at a time; every attempt is logged as a single email_logs row. */
async function deliver(
  messages: Message[],
  log: { type: EmailLogType; guestId?: string; guestName?: string | null },
): Promise<SendOutcome> {
  const recipients = messages.map((m) => m.to[0].email);
  const token = apiToken();
  if (!token) {
    console.warn(`[mail] MAILERSEND_API_TOKEN is not set; skipped ${log.type} email to ${recipients.length} recipient(s)`);
    await writeEmailLog({ ...log, recipients, success: false, error: "skipped: MAILERSEND_API_TOKEN not set" });
    return { skipped: true };
  }

  const results: PostResult[] = [];
  for (let i = 0; i < messages.length; i += SEND_CONCURRENCY) {
    results.push(...(await Promise.all(messages.slice(i, i + SEND_CONCURRENCY).map((m) => post(token, m)))));
  }
  const failed = results.filter((r) => !r.ok).map((r) => ({ email: r.email, error: r.error ?? "unknown error" }));
  const firstFailure = results.find((r) => !r.ok);
  if (failed.length > 0) console.error(`[mail] ${log.type}: ${failed.length}/${results.length} failed`, failed);

  await writeEmailLog({
    ...log,
    recipients,
    success: failed.length === 0 && results.length > 0,
    statusCode: (firstFailure ?? results[0])?.status ?? null,
    error: failed.length > 0 ? failed.map((f) => `${f.email}: ${f.error}`).join("; ") : null,
  });
  return { skipped: false, succeeded: results.length - failed.length, failed };
}

// ── RSVP confirmation ───────────────────────────────────────

const siteUrl = () => wedding.site.url.replace(/\/$/, "");

function googleCalendarUrl(event: (typeof wedding.events)[number]): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${wedding.couple.display} — ${event.name}`,
    dates: `${localDateTime(wedding.date.iso, event.startLocal)}/${localDateTime(wedding.date.iso, event.startLocal, event.durationMinutes)}`,
    ctz: wedding.date.timeZone,
    location: `${event.venue}, ${event.area}`,
    details: `${event.note}\n\nDress code: ${wedding.dressCode.label}\nDirections: ${event.mapsUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const nameList = (names: string[]) => names.map(escapeHtml).join("<br>");

function eventLabel(ids: string[]): string {
  const names = wedding.events.filter((e) => ids.includes(e.id)).map((e) => e.kind);
  return names.length > 0 ? names.join(" &amp; ") : "—";
}

function responseBlock(rsvp: RsvpPublic): string {
  const section = (label: string, value: string, color: string = PALETTE.text) =>
    `${eyebrow(label)}<p style="margin:0 0 16px 0;font-family:${SERIF};font-size:18px;line-height:1.6;color:${color};">${value}</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;background-color:${PALETTE.tint};border-left:3px solid ${PALETTE.blueDeep};">
<tr><td style="padding:22px 26px 6px 26px;">
${section("Your response", rsvp.attending ? "Joyfully accepts" : "Regretfully declines")}
${rsvp.attending ? section("Guests attending", nameList(rsvp.attendingMembers)) : ""}
${rsvp.attending ? section("Celebrating at", eventLabel(rsvp.events)) : ""}
${rsvp.declinedMembers.length > 0 ? section("Unable to attend", nameList(rsvp.declinedMembers), PALETTE.muted) : ""}
</td></tr></table>`;
}

function eventDetails(): string {
  const events = wedding.events
    .map(
      (e) => `<tr><td align="center" style="padding:0 0 26px 0;">
${eyebrow(`${escapeHtml(e.kind)} · ${escapeHtml(e.startDisplay)}`)}
<p style="margin:0 0 2px 0;font-family:${SERIF};font-size:24px;font-style:italic;color:${PALETTE.text};">${escapeHtml(e.name)}</p>
<p style="margin:0 0 4px 0;font-family:${SERIF};font-size:17px;color:${PALETTE.text};">${escapeHtml(e.venue)}</p>
<p style="margin:0 0 10px 0;font-family:${SERIF};font-size:15px;color:${PALETTE.muted};">${escapeHtml(e.area)}</p>
<p style="margin:0 0 10px 0;font-family:${SERIF};font-size:15px;font-style:italic;line-height:1.6;color:${PALETTE.muted};">${escapeHtml(e.note)}</p>
${button(e.mapsUrl, "Directions", false)}${button(googleCalendarUrl(e), "Google Calendar", false)}
</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:0 0 8px 0;">${eyebrow("The day", "letter-spacing:4px;")}
<p style="margin:0 0 22px 0;font-family:${SERIF};font-size:22px;color:${PALETTE.text};">${escapeHtml(wedding.date.weekday)}, ${escapeHtml(wedding.date.display)}</p></td></tr>
${events}
<tr><td align="center" style="padding:0 0 24px 0;">${rule(60)}</td></tr>
<tr><td align="center" style="padding:0 0 24px 0;">${eyebrow("Dress code")}
<p style="margin:0 0 6px 0;font-family:${SERIF};font-size:20px;color:${PALETTE.text};">${escapeHtml(wedding.dressCode.label)}</p>
<p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.6;color:${PALETTE.muted};">${escapeHtml(wedding.dressCode.detail)}</p></td></tr>
<tr><td align="center" style="padding:0 0 12px 0;">${button(`${siteUrl()}/api/calendar.ics`, "Add both events to your calendar", true)}
<p style="margin:10px 0 0 0;font-family:${SERIF};font-size:13px;color:${PALETTE.muted};">A calendar invite (.ics) is also attached to this email.</p></td></tr>
</table>`;
}

function confirmationText(rsvp: RsvpPublic, recipient: Recipient, isUpdate: boolean): string {
  const line = "────────────────────────────";
  const events = wedding.events
    .map((e) => `${e.kind.toUpperCase()} — ${e.startDisplay}\n${e.name}\n${e.venue}, ${e.area}\n${e.note}\nDirections: ${e.mapsUrl}`)
    .join("\n\n");
  const attending = rsvp.attending
    ? `\n\nGUESTS ATTENDING:\n${rsvp.attendingMembers.map((m) => `  ${m}`).join("\n")}`
    : "";
  const declined = rsvp.declinedMembers.length
    ? `\n\nUNABLE TO ATTEND:\n${rsvp.declinedMembers.map((m) => `  ${m}`).join("\n")}`
    : "";
  return `${isUpdate ? "RSVP UPDATED" : "RSVP CONFIRMED"}

Thank you, ${firstName(recipient.name)}

${line}

YOUR RESPONSE: ${rsvp.attending ? "Joyfully accepts" : "Regretfully declines"}${attending}${declined}

${line}

${wedding.date.weekday}, ${wedding.date.display}

${events}

Dress code: ${wedding.dressCode.label}
Add to calendar: ${siteUrl()}/api/calendar.ics

${line}

${rsvp.attending ? "We can't wait to celebrate with you!" : "We will miss you and hope to celebrate together soon."}
${wedding.couple.display}
`;
}

export async function sendRsvpConfirmation(args: {
  guest: Pick<Guest, "id">;
  rsvp: RsvpPublic;
  isUpdate: boolean;
}): Promise<SendOutcome> {
  const { guest, rsvp, isUpdate } = args;
  const recipients = dedupeRecipients([
    { email: rsvp.email, name: rsvp.fullName },
    ...Object.entries(rsvp.memberEmails).map(([name, email]) => ({ email, name })),
  ]);
  const headerLabel = isUpdate ? "RSVP Updated" : "RSVP Confirmed";
  const subject = `${headerLabel} — ${wedding.couple.display}'s Wedding`;
  const intro = rsvp.attending
    ? `Your ${isUpdate ? "updated " : ""}RSVP for our wedding has been received. We are so happy you will be celebrating with us!`
    : `Your ${isUpdate ? "updated " : ""}RSVP for our wedding has been received. We will miss you, and we are grateful you let us know.`;
  const footerMessage = rsvp.attending ? "We can&#39;t wait to celebrate with you!" : "With love and gratitude,";
  const ics = Buffer.from(buildWeddingIcs(), "utf-8").toString("base64");

  const messages: Message[] = recipients.map((r) => ({
    from: sender(),
    to: [{ email: r.email, ...(r.name ? { name: r.name } : {}) }],
    reply_to: sender(),
    subject,
    html: renderLayout({
      headerLabel,
      greeting: `Thank you, ${escapeHtml(firstName(r.name))}`,
      preheader: escapeHtml(intro),
      contentHtml: `${paragraph(escapeHtml(intro), "text-align:center;font-style:italic;")}${responseBlock(rsvp)}${eventDetails()}`,
      footerMessage,
    }),
    text: confirmationText(rsvp, r, isUpdate),
    attachments: [{ filename: "marly-michael-wedding.ics", content: ics, disposition: "attachment" }],
  }));

  return deliver(messages, {
    type: isUpdate ? "rsvp_updated" : "rsvp_confirmed",
    guestId: guest.id,
    guestName: rsvp.fullName,
  });
}

// ── Broadcast ───────────────────────────────────────────────

export async function sendBroadcast(args: {
  recipients: Recipient[];
  subject: string;
  bodyHtml: string;
  headerLabel?: string | null;
  footerMessage?: string | null;
  preheader?: string | null;
}): Promise<SendOutcome> {
  const headerLabel = args.headerLabel || `A Note From ${wedding.couple.display}`;
  const footerMessage = args.footerMessage || "With love,";
  const body = normalizeBodyHtml(args.bodyHtml);
  const bodyText = htmlToPlainText(body);

  const messages: Message[] = dedupeRecipients(args.recipients).map((r) => {
    const subject = personalize(args.subject, r);
    const greetName = firstName(r.name || r.email);
    return {
      from: sender(),
      to: [{ email: r.email, ...(r.name ? { name: r.name } : {}) }],
      reply_to: sender(),
      subject,
      html: renderLayout({
        headerLabel: escapeHtml(headerLabel),
        greeting: `Dear ${escapeHtml(greetName)}`,
        preheader: escapeHtml(personalize(args.preheader || subject, r)),
        contentHtml: personalize(body, r, true),
        footerMessage: escapeHtml(footerMessage),
        footnote: `You are receiving this because you were invited to ${escapeHtml(wedding.couple.display)}&#39;s wedding. To stop receiving these emails, reply with &quot;unsubscribe&quot;.`,
      }),
      text: `${headerLabel.toUpperCase()}\n\nDear ${greetName},\n\n${personalize(bodyText, r)}\n\n${footerMessage}\n${wedding.couple.display}\n`,
    };
  });

  return deliver(messages, { type: "broadcast" });
}
