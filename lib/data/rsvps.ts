import { sql, toRsvpAdmin, toRsvpPublic, type Guest, type RsvpAdmin, type RsvpPublic, type RsvpRow } from "@/lib/db";
import type { RsvpInput } from "@/lib/validation";

export async function getRsvpByGuest(guestId: string): Promise<RsvpPublic | null> {
  const rows = (await sql`select * from rsvps where guest_id = ${guestId}`) as RsvpRow[];
  return rows[0] ? toRsvpPublic(rows[0]) : null;
}

export async function listRsvpsAdmin(): Promise<RsvpAdmin[]> {
  const rows = (await sql`select * from rsvps order by created_at desc`) as RsvpRow[];
  return rows.map(toRsvpAdmin);
}

/**
 * Inserts or replaces the household's RSVP and marks the guest as responded,
 * atomically. `isUpdate` is true when an RSVP already existed.
 */
export async function upsertRsvp(
  guest: Guest,
  input: RsvpInput,
  userAgent: string | null,
): Promise<{ rsvp: RsvpPublic; isUpdate: boolean }> {
  const [upserted] = await sql.transaction([
    sql`
      insert into rsvps (
        guest_id, invitation_name, full_name, email, phone, attending,
        attending_members, declined_members, member_emails, events,
        relationship, meal_preference, dietary_restrictions, children_count, children_ages,
        song_request, transport_needed, accommodation_needed, special_requests, message, user_agent
      ) values (
        ${guest.id}, ${guest.invitationName}, ${input.fullName}, ${input.email}, ${input.phone}, ${input.attending},
        ${input.attendingMembers}, ${input.declinedMembers}, ${JSON.stringify(input.memberEmails)}::jsonb, ${input.events},
        ${input.relationship}, ${input.mealPreference}, ${input.dietaryRestrictions}, ${input.childrenCount}, ${input.childrenAges},
        ${input.songRequest}, ${input.transportNeeded}, ${input.accommodationNeeded}, ${input.specialRequests}, ${input.message}, ${userAgent}
      )
      on conflict (guest_id) do update set
        invitation_name = excluded.invitation_name, full_name = excluded.full_name, email = excluded.email,
        phone = excluded.phone, attending = excluded.attending, attending_members = excluded.attending_members,
        declined_members = excluded.declined_members, member_emails = excluded.member_emails, events = excluded.events,
        relationship = excluded.relationship, meal_preference = excluded.meal_preference,
        dietary_restrictions = excluded.dietary_restrictions, children_count = excluded.children_count,
        children_ages = excluded.children_ages, song_request = excluded.song_request,
        transport_needed = excluded.transport_needed, accommodation_needed = excluded.accommodation_needed,
        special_requests = excluded.special_requests, message = excluded.message, user_agent = excluded.user_agent,
        updated_at = now()
      returning *, (xmax <> 0) as was_update`,
    sql`update guests set has_rsvped = true, updated_at = now() where id = ${guest.id}`,
  ]);
  const row = (upserted as Array<RsvpRow & { was_update: boolean }>)[0];
  return { rsvp: toRsvpPublic(row), isUpdate: row.was_update };
}

/** Deletes an RSVP and reopens the household. Returns false when the RSVP does not exist. */
export async function deleteRsvp(id: string): Promise<boolean> {
  const rows = await sql`
    with removed as (delete from rsvps where id = ${id} returning guest_id)
    update guests set has_rsvped = false, updated_at = now()
    from removed where guests.id = removed.guest_id
    returning guests.id`;
  return rows.length > 0;
}
