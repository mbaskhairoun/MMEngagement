import { wedding } from "@/content/wedding";

/** Country is not part of content/wedding.ts; kept here so it lives in one place. */
export const COUNTRY = "Egypt";

/** "Ain Sokhna" — the town of the reception, taken from its area string. */
export const RECEPTION_TOWN = wedding.events[wedding.events.length - 1].area.split(",")[0].trim();

/** "El Rehab" — the town of the ceremony, without the "City" suffix. */
export const CEREMONY_TOWN = wedding.events[0].area.split(",")[0].replace(/\s+City$/i, "").trim();
