import { wedding } from "@/content/wedding";

type WeddingEvent = (typeof wedding.events)[number];

/**
 * Offset (ms) of `timeZone` from UTC at the given instant, derived from Intl so
 * it honours daylight-saving rules (Egypt observes DST in summer).
 */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - instant;
}

/** Absolute instant for a wall-clock date + time in a given IANA zone. */
export function zonedTimeToUtc(isoDate: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset even when the guess straddles a DST change.
  let instant = naive - zoneOffsetMs(naive, timeZone);
  instant = naive - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}

export function eventStart(event: WeddingEvent): Date {
  return zonedTimeToUtc(wedding.date.iso, event.startLocal, wedding.date.timeZone);
}

export function eventEnd(event: WeddingEvent): Date {
  return new Date(eventStart(event).getTime() + event.durationMinutes * 60_000);
}

/** Ceremony start — the moment the countdown counts to. */
export function ceremonyStart(): Date {
  return eventStart(wedding.events[0]);
}

function toGoogleStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Google Calendar template link spanning the ceremony through the reception. */
export function googleCalendarUrl(): string {
  const first = wedding.events[0];
  const last = wedding.events[wedding.events.length - 1];
  const details = wedding.events
    .map((e) => `${e.startDisplay} · ${e.name} — ${e.venue}, ${e.area}`)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${wedding.couple.bride} & ${wedding.couple.groom}'s Wedding`,
    dates: `${toGoogleStamp(eventStart(first))}/${toGoogleStamp(eventEnd(last))}`,
    details: `${details}\n\n${wedding.site.url}`,
    location: `${first.venue}, ${first.area}`,
    ctz: wedding.date.timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
