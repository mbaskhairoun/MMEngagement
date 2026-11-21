import { sql } from "@/lib/db";
import type { Pin, PinterestSyncInfo, Section, SyncSource } from "@/lib/decor-types";
import { slugify } from "@/lib/validation";

type Timestamp = Date | string;
const iso = (v: Timestamp): string => (v instanceof Date ? v : new Date(v)).toISOString();
const isoOrNull = (v: Timestamp | null): string | null => (v === null ? null : iso(v));

type SectionRow = {
  id: string;
  pinterest_id: string | null;
  title: string;
  slug: string;
  sort_order: number;
  pin_count: number | string;
  item_count: number | string;
};

type PinRow = {
  id: string;
  pinterest_id: string;
  section_id: string | null;
  title: string | null;
  description: string | null;
  image_url: string;
  width: number | null;
  height: number | null;
  dominant_color: string | null;
  pin_url: string | null;
  link: string | null;
  pinned_at: Timestamp | null;
  removed_at: Timestamp | null;
};

const toSection = (r: SectionRow): Section => ({
  id: r.id,
  pinterestId: r.pinterest_id,
  title: r.title,
  slug: r.slug,
  sortOrder: r.sort_order,
  pinCount: Number(r.pin_count),
  itemCount: Number(r.item_count),
});

const toPin = (r: PinRow): Pin => ({
  id: r.id,
  pinterestId: r.pinterest_id,
  sectionId: r.section_id,
  title: r.title,
  description: r.description,
  imageUrl: r.image_url,
  width: r.width,
  height: r.height,
  dominantColor: r.dominant_color,
  pinUrl: r.pin_url,
  link: r.link,
  pinnedAt: isoOrNull(r.pinned_at),
  removedAt: isoOrNull(r.removed_at),
});

/** A function, not a constant: building a fragment touches the lazily-created client. */
const pinColumns = () => sql`id, pinterest_id, section_id, title, description, image_url, width, height,
  dominant_color, pin_url, link, pinned_at, removed_at`;

// ── Sections ────────────────────────────────────────────────────────────────

/** All sections in display order with live (non-removed) pin counts and item counts. */
export async function listSections(): Promise<Section[]> {
  const rows = (await sql`
    select s.id, s.pinterest_id, s.title, s.slug, s.sort_order,
           (select count(*) from inspo_pins p where p.section_id = s.id and p.removed_at is null) as pin_count,
           (select count(*) from decor_items i where i.section_id = s.id) as item_count
    from inspo_sections s
    order by s.sort_order, lower(s.title)`) as SectionRow[];
  return rows.map(toSection);
}

export async function getSection(id: string): Promise<Section | null> {
  const rows = (await sql`
    select s.id, s.pinterest_id, s.title, s.slug, s.sort_order,
           (select count(*) from inspo_pins p where p.section_id = s.id and p.removed_at is null) as pin_count,
           (select count(*) from decor_items i where i.section_id = s.id) as item_count
    from inspo_sections s where s.id = ${id}`) as SectionRow[];
  return rows[0] ? toSection(rows[0]) : null;
}

/** Custom (non-Pinterest) category, appended after existing ones. Throws 23505 on a duplicate slug. */
export async function createSection(title: string): Promise<Section> {
  const rows = (await sql`
    insert into inspo_sections (title, slug, sort_order)
    values (${title}, ${slugify(title)}, (select coalesce(max(sort_order), -1) + 1 from inspo_sections))
    returning id`) as Array<{ id: string }>;
  const section = await getSection(rows[0].id);
  if (!section) throw new Error("section vanished after insert");
  return section;
}

/** Renames (also re-slugs) and/or reorders. Returns null when missing. Throws 23505 on a duplicate slug. */
export async function updateSection(
  id: string,
  patch: { title?: string; sortOrder?: number },
): Promise<Section | null> {
  const title = patch.title ?? null;
  const slug = patch.title === undefined ? null : slugify(patch.title);
  const sortOrder = patch.sortOrder ?? null;
  const rows = await sql`
    update inspo_sections
    set title = coalesce(${title}::text, title),
        slug = coalesce(${slug}::text, slug),
        sort_order = coalesce(${sortOrder}::int, sort_order),
        updated_at = now()
    where id = ${id}
    returning id`;
  return rows.length > 0 ? getSection(id) : null;
}

export type DeleteSectionResult = "deleted" | "not_found" | "section_is_pinterest" | "section_not_empty";

/** Deletes a custom, empty section. Removed pins still count as "in" the section. */
export async function deleteSection(id: string): Promise<DeleteSectionResult> {
  const rows = (await sql`
    select pinterest_id,
           exists(select 1 from inspo_pins where section_id = ${id}) as has_pins,
           exists(select 1 from decor_items where section_id = ${id}) as has_items
    from inspo_sections where id = ${id}`) as Array<{
    pinterest_id: string | null;
    has_pins: boolean;
    has_items: boolean;
  }>;
  const row = rows[0];
  if (!row) return "not_found";
  if (row.pinterest_id) return "section_is_pinterest";
  if (row.has_pins || row.has_items) return "section_not_empty";
  const deleted = await sql`
    delete from inspo_sections s where s.id = ${id} and s.pinterest_id is null
      and not exists(select 1 from inspo_pins where section_id = s.id)
      and not exists(select 1 from decor_items where section_id = s.id)
    returning id`;
  return deleted.length > 0 ? "deleted" : "section_not_empty";
}

export type SectionUpsert = { pinterestId: string; title: string; slug: string; sortOrder: number };

/**
 * Upserts Pinterest-backed sections by `pinterest_id` (title/slug/order follow Pinterest).
 * A slug already taken by another section gets a `-<last 4 of id>` suffix.
 * Returns a map pinterest_id → our section id.
 */
export async function upsertSections(sections: SectionUpsert[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const s of sections) {
    const taken = await sql`
      select 1 from inspo_sections where slug = ${s.slug} and pinterest_id is distinct from ${s.pinterestId}`;
    const slug = taken.length > 0 ? `${s.slug}-${s.pinterestId.slice(-4)}` : s.slug;
    const rows = (await sql`
      insert into inspo_sections (pinterest_id, title, slug, sort_order)
      values (${s.pinterestId}, ${s.title}, ${slug}, ${s.sortOrder})
      on conflict (pinterest_id) do update
        set title = excluded.title, slug = excluded.slug, sort_order = excluded.sort_order, updated_at = now()
      returning id`) as Array<{ id: string }>;
    ids.set(s.pinterestId, rows[0].id);
  }
  return ids;
}

/** Finds or creates a custom section by slug (used for the RSS "New from Pinterest" bucket). */
export async function ensureCustomSection(slug: string, title: string): Promise<string> {
  const rows = (await sql`
    insert into inspo_sections (title, slug, sort_order)
    values (${title}, ${slug}, (select coalesce(max(sort_order), -1) + 1 from inspo_sections))
    on conflict (slug) do update set slug = excluded.slug
    returning id`) as Array<{ id: string }>;
  return rows[0].id;
}

// ── Pins ────────────────────────────────────────────────────────────────────

/** Newest pins first (Pinterest ids grow over time). Removed pins only when asked. */
export async function listPins(includeRemoved = false): Promise<Pin[]> {
  const rows = (await sql`
    select ${pinColumns()} from inspo_pins
    where ${includeRemoved} or removed_at is null
    order by pinned_at desc nulls last, length(pinterest_id) desc, pinterest_id desc`) as PinRow[];
  return rows.map(toPin);
}

/** Pinterest ids plus the image hashes (from the source image URL) of every pin we hold, removed or not. */
export async function listKnownPinKeys(): Promise<{ ids: Set<string>; imageHashes: Set<string> }> {
  const rows = (await sql`select pinterest_id, source_image_url from inspo_pins`) as Array<{
    pinterest_id: string;
    source_image_url: string | null;
  }>;
  const imageHashes = new Set<string>();
  for (const r of rows) {
    const hash = r.source_image_url ? /([0-9a-f]{32})\.[a-z0-9]+/i.exec(r.source_image_url)?.[1] : undefined;
    if (hash) imageHashes.add(hash.toLowerCase());
  }
  return { ids: new Set(rows.map((r) => r.pinterest_id)), imageHashes };
}

export async function countSections(): Promise<number> {
  const rows = (await sql`select count(*) as n from inspo_sections`) as Array<{ n: number | string }>;
  return Number(rows[0].n);
}

export async function countLivePins(): Promise<number> {
  const rows = (await sql`select count(*) as n from inspo_pins where removed_at is null`) as Array<{
    n: number | string;
  }>;
  return Number(rows[0].n);
}

/** Moves a pin to a section (or none). Null when the pin is missing; throws 23503 for an unknown section. */
export async function setPinSection(id: string, sectionId: string | null): Promise<Pin | null> {
  const rows = (await sql`
    update inspo_pins set section_id = ${sectionId} where id = ${id}
    returning ${pinColumns()}`) as PinRow[];
  return rows[0] ? toPin(rows[0]) : null;
}

export type PinUpsert = {
  pinterestId: string;
  sectionId: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string;
  sourceImageUrl: string | null;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  pinUrl: string | null;
  link: string | null;
  pinnedAt: string | null;
};

/**
 * Upserts pins by `pinterest_id`. `mode: "insert"` only adds pins we do not have
 * (the RSS path never re-categorises); `mode: "upsert"` also updates existing ones
 * and clears `removed_at` (the crawl). Returns how many rows were newly inserted.
 */
export async function upsertPins(pins: PinUpsert[], mode: "insert" | "upsert"): Promise<number> {
  let inserted = 0;
  for (const p of pins) {
    const values = sql`(${p.pinterestId}, ${p.sectionId}, ${p.title}, ${p.description}, ${p.imageUrl},
      ${p.sourceImageUrl}, ${p.width}, ${p.height}, ${p.dominantColor}, ${p.pinUrl}, ${p.link}, ${p.pinnedAt})`;
    const rows = (
      mode === "insert"
        ? await sql`
          insert into inspo_pins (pinterest_id, section_id, title, description, image_url, source_image_url,
                                  width, height, dominant_color, pin_url, link, pinned_at)
          values ${values}
          on conflict (pinterest_id) do nothing
          returning (xmax = 0) as inserted`
        : await sql`
          insert into inspo_pins (pinterest_id, section_id, title, description, image_url, source_image_url,
                                  width, height, dominant_color, pin_url, link, pinned_at)
          values ${values}
          on conflict (pinterest_id) do update set
            section_id = excluded.section_id, title = excluded.title, description = excluded.description,
            image_url = excluded.image_url, source_image_url = excluded.source_image_url,
            width = excluded.width, height = excluded.height, dominant_color = excluded.dominant_color,
            pin_url = excluded.pin_url, link = excluded.link,
            pinned_at = coalesce(excluded.pinned_at, inspo_pins.pinned_at),
            synced_at = now(), removed_at = null
          returning (xmax = 0) as inserted`
    ) as Array<{ inserted: boolean }>;
    if (rows[0]?.inserted) inserted += 1;
  }
  return inserted;
}

/** Marks live pins whose Pinterest id is not in `keep` as removed. Returns how many were marked. */
export async function markRemoved(keep: string[]): Promise<number> {
  const rows = await sql`
    update inspo_pins set removed_at = now()
    where removed_at is null and not (pinterest_id = any(${keep}::text[]))
    returning id`;
  return rows.length;
}

// ── Sync status ─────────────────────────────────────────────────────────────

const SYNC_KEY = "pinterest_sync";
const SOURCES: readonly SyncSource[] = ["crawl", "rss", "local"];

function isSyncInfo(v: unknown): v is PinterestSyncInfo {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.lastSyncedAt === "string" &&
    typeof r.pinCount === "number" &&
    typeof r.sectionCount === "number" &&
    typeof r.source === "string" &&
    (SOURCES as readonly string[]).includes(r.source)
  );
}

export async function getSyncInfo(): Promise<PinterestSyncInfo | null> {
  const rows = (await sql`select value from settings where key = ${SYNC_KEY}`) as Array<{ value: unknown }>;
  const value = rows[0]?.value;
  if (!isSyncInfo(value)) return null;
  const { lastSyncedAt, pinCount, sectionCount, source, added, removed } = value;
  return { lastSyncedAt, pinCount, sectionCount, source, added, removed };
}

export async function setSyncInfo(info: PinterestSyncInfo): Promise<void> {
  await sql`
    insert into settings (key, value, updated_at)
    values (${SYNC_KEY}, ${JSON.stringify(info)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
