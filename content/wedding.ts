/**
 * Single source of truth for wedding facts. Imported by the public site,
 * the admin dashboard, the confirmation email, and the .ics calendar route.
 * All times are local to Africa/Cairo.
 */
export const wedding = {
  couple: {
    bride: "Marly",
    groom: "Michael",
    display: "Marly & Michael",
    hashtag: null as string | null,
  },
  date: {
    iso: "2027-08-23",                 // Monday, August 23, 2027
    display: "August 23, 2027",
    weekday: "Monday",
    timeZone: "Africa/Cairo",
  },
  events: [
    {
      id: "ceremony",
      name: "Holy Matrimony",
      kind: "Ceremony",
      venue: "St. Mary Church",
      area: "El Rehab City, New Cairo",
      startLocal: "13:00",              // 1:00 PM
      startDisplay: "1:00 PM",
      durationMinutes: 90,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=St.+Mary+Church+El+Rehab+City+Cairo",
      note: "Please arrive by 12:30 PM so you are seated before the procession.",
    },
    {
      id: "reception",
      name: "Reception by the Sea",
      kind: "Reception",
      venue: "Jaz Little Venice Golf Resort",
      area: "Ain Sokhna, Red Sea",
      startLocal: "17:00",              // 5:00 PM
      startDisplay: "5:00 PM",
      durationMinutes: 420,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Jaz+Little+Venice+Golf+Resort+Ain+Sokhna",
      note: "Ain Sokhna is roughly a 90-minute drive from El Rehab. Dinner, dancing and the sea breeze await.",
    },
  ],
  dressCode: {
    label: "Beach Formal",
    detail:
      "Light suits and linen for gentlemen, flowing dresses for ladies. Pastel blues, creams and sand tones are warmly encouraged. The reception is on grass and sand, so block heels or wedges are kinder than stilettos.",
  },
  rsvp: {
    deadlineDisplay: "June 1, 2027",
    deadlineIso: "2027-06-01",
  },
  site: {
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://marlybaskha.ca",
    title: "Marly & Michael — The Wedding",
    description:
      "Join us as we say 'I do' on August 23, 2027. Ceremony at St. Mary Church, El Rehab, followed by a reception by the sea at Jaz Little Venice, Ain Sokhna.",
  },
  mail: {
    fromEmail: process.env.MAIL_FROM_EMAIL ?? "info@marlybaskha.ca",
    fromName: process.env.MAIL_FROM_NAME ?? "Marly & Michael",
  },
} as const;

export type WeddingEventId = (typeof wedding.events)[number]["id"];
