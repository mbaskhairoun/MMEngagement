import { sql } from "@/lib/db";
import { wedding } from "@/content/wedding";

export type Stats = {
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
  timeline: Array<{ date: string; count: number }>;
};

type TotalsRow = {
  households: number;
  individuals: number;
  pending: number;
  responded: number;
  attending_households: number;
  attending_individuals: number;
  declined_households: number;
  ceremony: number;
  reception: number;
  children: number;
};

export async function getStats(): Promise<Stats> {
  const tz = wedding.date.timeZone;
  const [totals, meals, timeline] = await sql.transaction(
    [
      sql`
        select
          (select count(*) from guests)::int as households,
          (select coalesce(sum(greatest(cardinality(members), 1)), 0) from guests)::int as individuals,
          (select count(*) from guests g where not exists (select 1 from rsvps r where r.guest_id = g.id))::int as pending,
          count(r.id)::int as responded,
          count(r.id) filter (where r.attending)::int as attending_households,
          coalesce(sum(cardinality(r.attending_members)) filter (where r.attending), 0)::int as attending_individuals,
          count(r.id) filter (where not r.attending)::int as declined_households,
          coalesce(sum(cardinality(r.attending_members)) filter (where r.attending and 'ceremony' = any(r.events)), 0)::int as ceremony,
          coalesce(sum(cardinality(r.attending_members)) filter (where r.attending and 'reception' = any(r.events)), 0)::int as reception,
          coalesce(sum(r.children_count) filter (where r.attending), 0)::int as children
        from rsvps r`,
      sql`
        select lower(trim(meal_preference)) as meal, count(*)::int as count
        from rsvps where attending and meal_preference is not null
        group by 1 order by 2 desc`,
      sql`
        select to_char((created_at at time zone ${tz})::date, 'YYYY-MM-DD') as date, count(*)::int as count
        from rsvps group by 1 order by 1`,
    ],
    { readOnly: true },
  );
  const t = (totals as TotalsRow[])[0];
  const mealRows = meals as Array<{ meal: string; count: number }>;
  const dayRows = timeline as Array<{ date: string; count: number }>;
  return {
    households: t.households,
    individuals: t.individuals,
    responded: t.responded,
    attendingHouseholds: t.attending_households,
    attendingIndividuals: t.attending_individuals,
    declinedHouseholds: t.declined_households,
    pending: t.pending,
    byEvent: { ceremony: t.ceremony, reception: t.reception },
    meals: Object.fromEntries(mealRows.map((m) => [m.meal, m.count])),
    children: t.children,
    timeline: dayRows,
  };
}
