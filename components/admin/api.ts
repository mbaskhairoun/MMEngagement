export interface Guest {
  id: string;
  invitationName: string;
  email: string | null;
  members: string[];
  notes: string | null;
  hasRsvped: boolean;
  createdAt: string;
  updatedAt: string;
  attending: boolean | null;
  totalAttending: number;
}

export interface GuestInput {
  invitationName: string;
  email?: string;
  members: string[];
  notes?: string;
}

export interface Rsvp {
  id: string;
  guestId: string | null;
  invitationName: string;
  fullName: string;
  email: string;
  phone: string | null;
  attending: boolean;
  attendingMembers: string[];
  declinedMembers: string[];
  memberEmails: Record<string, string>;
  events: string[];
  relationship: string | null;
  mealPreference: string | null;
  dietaryRestrictions: string | null;
  childrenCount: number | null;
  childrenAges: string | null;
  songRequest: string | null;
  transportNeeded: boolean | null;
  accommodationNeeded: boolean | null;
  specialRequests: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FieldKey =
  | "phone"
  | "relationship"
  | "mealPreference"
  | "dietary"
  | "childrenCount"
  | "songRequest"
  | "transportNeeded"
  | "accommodationNeeded"
  | "specialRequests"
  | "message";

export interface Settings {
  rsvpDisabled: boolean;
  fields: Record<string, boolean>;
}

export interface Stats {
  households: number;
  individuals: number;
  responded: number;
  attendingHouseholds: number;
  attendingIndividuals: number;
  declinedHouseholds: number;
  pending: number;
  byEvent: { ceremony: number; reception: number };
  meals: Record<string, number>;
  children: number;
  timeline: { date: string; count: number }[];
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailSendBody {
  to: EmailRecipient[];
  subject: string;
  html: string;
  headerLabel?: string;
  footerMessage?: string;
  preheader?: string;
}

export interface EmailSendResult {
  succeeded: number;
  failed: { email: string; error: string }[];
}

export interface EmailLog {
  id: string;
  guestName: string | null;
  type: string;
  recipients: string[];
  success: boolean;
  statusCode: number | null;
  error: string | null;
  sentAt: string;
}

export interface ImportResult {
  added: number;
  skipped: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const UNAUTHORIZED_EVENT = "admin:unauthorized";

interface Envelope {
  ok?: boolean;
  error?: string;
}

/** Fetch an admin endpoint. Throws ApiError; 401 also fires UNAUTHORIZED_EVENT. */
export async function api<T extends object = Record<string, never>>(
  path: string,
  init?: { method?: string; body?: unknown },
  opts?: { allow207?: boolean },
): Promise<T & Envelope> {
  const res = await fetch(`/api/admin${path}`, {
    method: init?.method ?? "GET",
    credentials: "same-origin",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  let data: (T & Envelope) | null = null;
  try {
    data = (await res.json()) as T & Envelope;
  } catch {
    data = null;
  }
  if (res.status === 401 && path !== "/login") {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError("Unauthorized", 401);
  }
  const okStatus = res.ok || (opts?.allow207 && res.status === 207);
  if (!okStatus || !data || data.ok === false) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const adminApi = {
  me: () => api("/me"),
  login: (password: string) => api("/login", { method: "POST", body: { password } }),
  logout: () => api("/logout", { method: "POST" }),
  guests: () => api<{ guests: Guest[] }>("/guests").then((r) => r.guests),
  createGuest: (g: GuestInput) => api<{ guest: Guest }>("/guests", { method: "POST", body: g }),
  updateGuest: (id: string, g: GuestInput) =>
    api<{ guest: Guest }>(`/guests/${encodeURIComponent(id)}`, { method: "PUT", body: g }),
  deleteGuest: (id: string) => api(`/guests/${encodeURIComponent(id)}`, { method: "DELETE" }),
  importGuests: (mode: "append" | "replace", guests: GuestInput[]) =>
    api<ImportResult>("/guests/import", { method: "POST", body: { mode, guests } }),
  rsvps: () => api<{ rsvps: Rsvp[] }>("/rsvps").then((r) => r.rsvps),
  deleteRsvp: (id: string) => api(`/rsvps/${encodeURIComponent(id)}`, { method: "DELETE" }),
  settings: () => api<Settings>("/settings"),
  saveSettings: (s: Partial<Settings>) => api<Settings>("/settings", { method: "PUT", body: s }),
  stats: () => api<Stats>("/stats"),
  sendEmail: (b: EmailSendBody) =>
    api<EmailSendResult>("/email/send", { method: "POST", body: b }, { allow207: true }),
  emailLogs: (limit = 100) =>
    api<{ logs: EmailLog[] }>(`/email/logs?limit=${limit}`).then((r) => r.logs),
};

export const EXPORT_URL = "/api/admin/rsvps/export";
export const EXPORT_BY_MEMBER_URL = "/api/admin/rsvps/export?by=member";

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function guestStatus(g: Guest): "attending" | "declined" | "pending" {
  if (!g.hasRsvped) return "pending";
  if (g.attending === null) return "pending";
  return g.attending ? "attending" : "declined";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
