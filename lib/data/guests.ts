import {
  sql,
  toGuest,
  toGuestAdmin,
  toGuestPublic,
  type Guest,
  type GuestAdmin,
  type GuestPublic,
  type GuestRow,
  type GuestWithRsvpRow,
} from "@/lib/db";
import type { GuestInput } from "@/lib/validation";

/** A household always lists at least one individual: default to the invitation name. */
const membersFor = (input: GuestInput) => (input.members.length > 0 ? input.members : [input.invitationName]);

export async function listGuestsPublic(): Promise<GuestPublic[]> {
  const rows = (await sql`select id, invitation_name, members, has_rsvped from guests`) as Array<
    Pick<GuestRow, "id" | "invitation_name" | "members" | "has_rsvped">
  >;
  return rows.map((r) =>
    toGuestPublic({ id: r.id, invitationName: r.invitation_name, members: r.members, hasRsvped: r.has_rsvped }),
  );
}

export async function getGuest(id: string): Promise<Guest | null> {
  const rows = (await sql`select * from guests where id = ${id}`) as GuestRow[];
  return rows[0] ? toGuest(rows[0]) : null;
}

export async function listGuestsAdmin(): Promise<GuestAdmin[]> {
  const rows = (await sql`
    select g.*, r.attending as rsvp_attending,
           case when r.attending then cardinality(r.attending_members) else 0 end as rsvp_total_attending
    from guests g left join rsvps r on r.guest_id = g.id
    order by g.invitation_name_lower`) as GuestWithRsvpRow[];
  return rows.map(toGuestAdmin);
}

/** Throws a unique-violation (23505) error when the invitation name already exists. */
export async function createGuest(input: GuestInput): Promise<Guest> {
  const rows = (await sql`
    insert into guests (invitation_name, email, members, notes)
    values (${input.invitationName}, ${input.email}, ${membersFor(input)}, ${input.notes})
    returning *`) as GuestRow[];
  return toGuest(rows[0]);
}

/** Returns null when the guest does not exist. Keeps the RSVP's denormalised invitation name in sync. */
export async function updateGuest(id: string, input: GuestInput): Promise<Guest | null> {
  const [guestRows] = await sql.transaction([
    sql`
      update guests
      set invitation_name = ${input.invitationName}, email = ${input.email},
          members = ${membersFor(input)}, notes = ${input.notes}, updated_at = now()
      where id = ${id}
      returning *`,
    sql`update rsvps set invitation_name = ${input.invitationName} where guest_id = ${id}`,
  ]);
  const row = (guestRows as GuestRow[])[0];
  return row ? toGuest(row) : null;
}

export async function deleteGuest(id: string): Promise<boolean> {
  const rows = await sql`delete from guests where id = ${id} returning id`;
  return rows.length > 0;
}

/**
 * Bulk import executed as one Postgres transaction over the HTTP driver.
 * `replace` deletes every guest first (cascading their RSVPs); duplicates by
 * case-insensitive invitation name, existing or within the batch, are skipped.
 */
export async function importGuests(
  mode: "append" | "replace",
  guests: GuestInput[],
): Promise<{ added: number; skipped: number }> {
  const payload = JSON.stringify(
    guests.map((g) => ({ invitationName: g.invitationName, email: g.email, members: membersFor(g), notes: g.notes })),
  );
  const insert = sql`
    insert into guests (invitation_name, email, members, notes)
    select x->>'invitationName', x->>'email',
           array(select jsonb_array_elements_text(x->'members')), x->>'notes'
    from jsonb_array_elements(${payload}::jsonb) with ordinality as t(x, n)
    order by n
    on conflict (invitation_name_lower) do nothing
    returning id`;
  const results = mode === "replace" ? await sql.transaction([sql`delete from guests`, insert]) : [await insert];
  const added = results[results.length - 1].length;
  return { added, skipped: guests.length - added };
}
