import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;

function getClient(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

/**
 * Lazily-initialised Neon HTTP client. Importing this module never touches the
 * network or requires DATABASE_URL; the first query does.
 */
export const sql: Sql = new Proxy((() => undefined) as unknown as Sql, {
  apply: (_target, _this, args: unknown[]) => Reflect.apply(getClient(), undefined, args),
  get: (_target, prop) => {
    const value: unknown = Reflect.get(getClient(), prop);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});

type Timestamp = Date | string;

const iso = (v: Timestamp): string => (v instanceof Date ? v : new Date(v)).toISOString();

export type GuestRow = {
  id: string;
  invitation_name: string;
  email: string | null;
  members: string[];
  notes: string | null;
  has_rsvped: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type GuestWithRsvpRow = GuestRow & { rsvp_attending: boolean | null; rsvp_total_attending: number | null };

export type RsvpRow = {
  id: string;
  guest_id: string;
  invitation_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  attending: boolean;
  attending_members: string[];
  declined_members: string[];
  member_emails: Record<string, string>;
  events: string[];
  relationship: string | null;
  meal_preference: string | null;
  dietary_restrictions: string | null;
  children_count: number;
  children_ages: string | null;
  song_request: string | null;
  transport_needed: boolean;
  accommodation_needed: boolean;
  special_requests: string | null;
  message: string | null;
  user_agent: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type EmailLogRow = {
  id: string;
  guest_id: string | null;
  guest_name: string | null;
  type: string;
  recipients: string[];
  success: boolean;
  status_code: number | null;
  error: string | null;
  sent_at: Timestamp;
};

export type Guest = {
  id: string;
  invitationName: string;
  email: string | null;
  members: string[];
  notes: string | null;
  hasRsvped: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuestPublic = Pick<Guest, "id" | "invitationName" | "members" | "hasRsvped">;

export type GuestAdmin = Guest & { attending: boolean | null; totalAttending: number };

export type RsvpPublic = {
  id: string;
  guestId: string;
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
  childrenCount: number;
  childrenAges: string | null;
  songRequest: string | null;
  transportNeeded: boolean;
  accommodationNeeded: boolean;
  specialRequests: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RsvpAdmin = RsvpPublic & { userAgent: string | null; totalAttending: number; totalDeclined: number };

export type EmailLog = {
  id: string;
  guestId: string | null;
  guestName: string | null;
  type: string;
  recipients: string[];
  success: boolean;
  statusCode: number | null;
  error: string | null;
  sentAt: string;
};

export function toGuest(r: GuestRow): Guest {
  return {
    id: r.id,
    invitationName: r.invitation_name,
    email: r.email,
    members: r.members,
    notes: r.notes,
    hasRsvped: r.has_rsvped,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toGuestPublic(g: Pick<Guest, "id" | "invitationName" | "members" | "hasRsvped">): GuestPublic {
  return { id: g.id, invitationName: g.invitationName, members: g.members, hasRsvped: g.hasRsvped };
}

export function toGuestAdmin(r: GuestWithRsvpRow): GuestAdmin {
  return { ...toGuest(r), attending: r.rsvp_attending, totalAttending: r.rsvp_total_attending ?? 0 };
}

export function toRsvpPublic(r: RsvpRow): RsvpPublic {
  return {
    id: r.id,
    guestId: r.guest_id,
    invitationName: r.invitation_name,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    attending: r.attending,
    attendingMembers: r.attending_members,
    declinedMembers: r.declined_members,
    memberEmails: r.member_emails,
    events: r.events,
    relationship: r.relationship,
    mealPreference: r.meal_preference,
    dietaryRestrictions: r.dietary_restrictions,
    childrenCount: r.children_count,
    childrenAges: r.children_ages,
    songRequest: r.song_request,
    transportNeeded: r.transport_needed,
    accommodationNeeded: r.accommodation_needed,
    specialRequests: r.special_requests,
    message: r.message,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toRsvpAdmin(r: RsvpRow): RsvpAdmin {
  return {
    ...toRsvpPublic(r),
    userAgent: r.user_agent,
    totalAttending: r.attending ? r.attending_members.length : 0,
    totalDeclined: r.declined_members.length,
  };
}

export function toEmailLog(r: EmailLogRow): EmailLog {
  return {
    id: r.id,
    guestId: r.guest_id,
    guestName: r.guest_name,
    type: r.type,
    recipients: r.recipients,
    success: r.success,
    statusCode: r.status_code,
    error: r.error,
    sentAt: iso(r.sent_at),
  };
}

/** Every individual on an invitation; a household with no listed members is just its invitation name. */
export function householdMembers(g: Pick<Guest, "invitationName" | "members">): string[] {
  return g.members.length > 0 ? g.members : [g.invitationName];
}
