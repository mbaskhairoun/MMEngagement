/**
 * Client-side contract for the public RSVP endpoints. Every request shape and
 * response shape the RSVP flow relies on lives here.
 */

export type EventId = "ceremony" | "reception";

export type Guest = {
  id: string;
  invitationName: string;
  members: string[];
  hasRsvped: boolean;
};

export type Candidate = { guest: Guest; matchedName: string };

export type Rsvp = {
  id: string;
  guestId: string;
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
};

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

export type FieldFlags = Record<FieldKey, boolean>;

export type Settings = { rsvpDisabled: boolean; fields: FieldFlags };

export type RsvpPayload = {
  guestId: string;
  fullName: string;
  email: string;
  phone: string;
  attending: boolean;
  attendingMembers: string[];
  declinedMembers: string[];
  memberEmails: Record<string, string>;
  events: EventId[];
  relationship: string;
  mealPreference: string;
  dietaryRestrictions: string;
  childrenCount: number;
  childrenAges: string;
  songRequest: string;
  transportNeeded: boolean;
  accommodationNeeded: boolean;
  specialRequests: string;
  message: string;
};

export type SubmitSuccess = { rsvpId: string; isUpdate: boolean; emailSent: boolean };

/** Every call resolves to one of these — callers never need try/catch. */
export type Result<T> =
  | { status: "ok"; data: T }
  | { status: "closed" }
  | { status: "error"; error: string; httpStatus?: number };

export const DEFAULT_FIELDS: FieldFlags = {
  phone: true,
  relationship: true,
  mealPreference: true,
  dietary: true,
  childrenCount: true,
  songRequest: true,
  transportNeeded: true,
  accommodationNeeded: true,
  specialRequests: true,
  message: true,
};

async function call<T>(input: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
    });
  } catch {
    return { status: "error", error: "network" };
  }
  if (res.status === 423) return { status: "closed" };
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  const record = (body ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok || record.ok === false) {
    if (record.error === "rsvp_closed") return { status: "closed" };
    return { status: "error", error: record.error ?? "unknown", httpStatus: res.status };
  }
  return { status: "ok", data: body as T };
}

export type LookupData = { exact: Guest | null; matchedName: string | null; candidates: Candidate[] };

export async function lookupGuest(name: string): Promise<Result<LookupData>> {
  const result = await call<{ exact?: Guest | null; matchedName?: string | null; candidates?: Candidate[] }>("/api/guests/lookup", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    data: {
      exact: result.data.exact ?? null,
      matchedName: result.data.matchedName ?? null,
      candidates: result.data.candidates ?? [],
    },
  };
}

export async function getExistingRsvp(guestId: string): Promise<Result<Rsvp | null>> {
  const result = await call<{ rsvp?: Rsvp | null }>(`/api/rsvp?guestId=${encodeURIComponent(guestId)}`);
  if (result.status !== "ok") return result;
  return { status: "ok", data: result.data.rsvp ?? null };
}

export async function getSettings(): Promise<Result<Settings>> {
  const result = await call<{ rsvpDisabled?: boolean; fields?: Partial<FieldFlags> }>("/api/settings");
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    data: {
      rsvpDisabled: Boolean(result.data.rsvpDisabled),
      fields: { ...DEFAULT_FIELDS, ...(result.data.fields ?? {}) },
    },
  };
}

export async function submitRsvp(payload: RsvpPayload): Promise<Result<SubmitSuccess>> {
  const result = await call<Partial<SubmitSuccess>>("/api/rsvp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    data: {
      rsvpId: result.data.rsvpId ?? "",
      isUpdate: Boolean(result.data.isUpdate),
      emailSent: Boolean(result.data.emailSent),
    },
  };
}

/** Household names, falling back to the invitation name for single guests. */
export function householdOf(guest: Guest): string[] {
  return guest.members.length > 0 ? guest.members : [guest.invitationName];
}

/** Human copy for error codes returned by the API. */
export function describeError(error: string, httpStatus?: number): string {
  switch (error) {
    case "network":
      return "We couldn't reach the server. Please check your connection and try again.";
    case "too_many_requests":
      return "That was a lot of tries in a short time. Please wait a minute and try again.";
    case "guest_not_found":
      return "We couldn't find your invitation any more. Please search for your name again.";
    case "invalid_body":
      return "A detail in the form wasn't quite right. Please check your entries and try again.";
    case "invalid_member":
    case "member_overlap":
    case "attending_members_must_be_empty":
      return "Something didn't line up with your household list. Please refresh the page and try again.";
    case "attending_members_required":
      return "Please tick at least one name from your household who will be joining us.";
    default:
      return httpStatus && httpStatus >= 500
        ? "Something went wrong on our side. Please try again in a moment."
        : "Something went wrong. Please check your details and try again.";
  }
}
