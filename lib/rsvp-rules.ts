import { householdMembers, type Guest } from "@/lib/db";
import { EVENT_IDS, type RsvpInput } from "@/lib/validation";

export type RsvpRuleError =
  | "invalid_member"
  | "member_overlap"
  | "attending_members_required"
  | "attending_members_must_be_empty";

/**
 * Applies household rules to a schema-valid RSVP: member names must belong to
 * the invitation (matched case-insensitively, stored in their canonical
 * spelling), attending and declined lists must not overlap, and attendee-only
 * details are cleared when the household declines.
 */
export function applyRsvpRules(
  guest: Pick<Guest, "invitationName" | "members">,
  input: RsvpInput,
): { value: RsvpInput; error?: undefined } | { value?: undefined; error: RsvpRuleError } {
  const canonical = new Map(householdMembers(guest).map((m) => [m.toLowerCase(), m]));
  const resolve = (names: string[]) => names.map((n) => canonical.get(n.trim().toLowerCase()));

  const attendingMembers = resolve(input.attendingMembers);
  const declinedMembers = resolve(input.declinedMembers);
  const emailEntries = Object.entries(input.memberEmails).map(([name, email]) => [canonical.get(name.trim().toLowerCase()), email]);
  if ([...attendingMembers, ...declinedMembers, ...emailEntries.map(([n]) => n)].some((n) => n === undefined)) {
    return { error: "invalid_member" };
  }
  const attending = attendingMembers as string[];
  const declined = declinedMembers as string[];
  if (attending.some((m) => declined.includes(m))) return { error: "member_overlap" };
  if (input.attending && attending.length === 0) return { error: "attending_members_required" };
  if (!input.attending && attending.length > 0) return { error: "attending_members_must_be_empty" };

  const base = {
    ...input,
    attendingMembers: attending,
    declinedMembers: declined,
    memberEmails: Object.fromEntries(emailEntries) as Record<string, string>,
  };
  if (input.attending) {
    return { value: { ...base, events: input.events.length > 0 ? input.events : [...EVENT_IDS] } };
  }
  return {
    value: {
      ...base,
      events: [],
      relationship: null,
      mealPreference: null,
      dietaryRestrictions: null,
      childrenCount: 0,
      childrenAges: null,
      songRequest: null,
      transportNeeded: false,
      accommodationNeeded: false,
      specialRequests: null,
    },
  };
}
