import { wedding } from "@/content/wedding";

type WeddingEvent = (typeof wedding.events)[number];

const CRLF = "\r\n";
const UID_DOMAIN = "marlybaskha.ca";

/** Egypt observes EEST (+03) from the last Friday of April to the last Thursday of October. */
const CAIRO_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Africa/Cairo",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0300",
  "TZNAME:EEST",
  "DTSTART:19700424T000000",
  "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=-1FR",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0200",
  "TZNAME:EET",
  "DTSTART:19701029T235959",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1TH",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: lines longer than 75 octets continue on the next line after a space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock arithmetic in the event's local zone, formatted as an iCalendar local DATE-TIME. */
export function localDateTime(dateIso: string, timeLocal: string, plusMinutes = 0): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = timeLocal.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + plusMinutes));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function vevent(event: WeddingEvent, stamp: string): string[] {
  const tz = wedding.date.timeZone;
  const start = localDateTime(wedding.date.iso, event.startLocal);
  const end = localDateTime(wedding.date.iso, event.startLocal, event.durationMinutes);
  const location = `${event.venue}, ${event.area}`;
  const description = [
    `${event.kind} for the wedding of ${wedding.couple.display}.`,
    event.note,
    `Dress code: ${wedding.dressCode.label}`,
    `Directions: ${event.mapsUrl}`,
  ].join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:marly-michael-wedding-${event.id}@${UID_DOMAIN}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tz}:${start}`,
    `DTEND;TZID=${tz}:${end}`,
    `SUMMARY:${escapeIcsText(`${wedding.couple.display} — ${event.name}`)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${event.mapsUrl}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT1H",
    `DESCRIPTION:${escapeIcsText(`${event.name} begins in 1 hour at ${event.venue}`)}`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

export function buildWeddingIcs(now: Date = new Date()): string {
  const stamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marly & Michael//Wedding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`${wedding.couple.display} — Wedding`)}`,
    `X-WR-TIMEZONE:${wedding.date.timeZone}`,
    ...CAIRO_VTIMEZONE,
    ...wedding.events.flatMap((e) => vevent(e, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
