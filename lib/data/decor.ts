import { sql } from "@/lib/db";
import { MAX_PHOTOS_PER_ITEM, type DecorStatus, type Item, type Photo } from "@/lib/decor-types";
import type { DecorItemInput } from "@/lib/validation";

type Timestamp = Date | string;
const iso = (v: Timestamp): string => (v instanceof Date ? v : new Date(v)).toISOString();

type ItemRow = {
  id: string;
  section_id: string | null;
  inspo_pin_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  estimated_cost: string | number | null;
  currency: string;
  status: DecorStatus;
  vendor: string | null;
  link: string | null;
  notes: string | null;
  added_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  pin_image_url: string | null;
  pin_url: string | null;
};

type PhotoRow = {
  id: string;
  item_id: string;
  url: string;
  pathname: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
};

const toPhoto = (r: PhotoRow): Photo => ({
  id: r.id,
  url: r.url,
  pathname: r.pathname,
  width: r.width,
  height: r.height,
  sortOrder: r.sort_order,
});

function toItem(r: ItemRow, photos: Photo[]): Item {
  return {
    id: r.id,
    sectionId: r.section_id,
    inspoPinId: r.inspo_pin_id,
    name: r.name,
    description: r.description,
    quantity: r.quantity,
    unit: r.unit,
    estimatedCost: r.estimated_cost === null ? null : Number(r.estimated_cost),
    currency: r.currency,
    status: r.status,
    vendor: r.vendor,
    link: r.link,
    notes: r.notes,
    addedBy: r.added_by,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    photos,
    pin:
      r.inspo_pin_id && r.pin_image_url ? { id: r.inspo_pin_id, imageUrl: r.pin_image_url, pinUrl: r.pin_url } : null,
  };
}

async function photosFor(itemIds: string[]): Promise<Map<string, Photo[]>> {
  const byItem = new Map<string, Photo[]>();
  if (itemIds.length === 0) return byItem;
  const rows = (await sql`
    select id, item_id, url, pathname, width, height, sort_order from decor_item_photos
    where item_id = any(${itemIds}::uuid[])
    order by sort_order, created_at`) as PhotoRow[];
  for (const r of rows) {
    const list = byItem.get(r.item_id) ?? [];
    list.push(toPhoto(r));
    byItem.set(r.item_id, list);
  }
  return byItem;
}

async function hydrate(rows: ItemRow[]): Promise<Item[]> {
  const photos = await photosFor(rows.map((r) => r.id));
  return rows.map((r) => toItem(r, photos.get(r.id) ?? []));
}

export type ItemFilter = { sectionId?: string; status?: DecorStatus };

/** Items newest first, optionally filtered by section and/or status. */
export async function listItems(filter: ItemFilter = {}): Promise<Item[]> {
  const sectionId = filter.sectionId ?? null;
  const status = filter.status ?? null;
  const rows = (await sql`
    select i.*, p.image_url as pin_image_url, p.pin_url
    from decor_items i left join inspo_pins p on p.id = i.inspo_pin_id
    where (${sectionId}::uuid is null or i.section_id = ${sectionId}::uuid)
      and (${status}::text is null or i.status = ${status}::text)
    order by i.created_at desc`) as ItemRow[];
  return hydrate(rows);
}

export async function getItem(id: string): Promise<Item | null> {
  const rows = (await sql`
    select i.*, p.image_url as pin_image_url, p.pin_url
    from decor_items i left join inspo_pins p on p.id = i.inspo_pin_id
    where i.id = ${id}`) as ItemRow[];
  const [item] = await hydrate(rows);
  return item ?? null;
}

/** Throws a 23503 foreign-key error when `sectionId` / `inspoPinId` do not exist. */
export async function createItem(input: DecorItemInput): Promise<Item> {
  const rows = (await sql`
    insert into decor_items (section_id, inspo_pin_id, name, description, quantity, unit, estimated_cost,
                             currency, status, vendor, link, notes, added_by)
    values (${input.sectionId}, ${input.inspoPinId}, ${input.name}, ${input.description}, ${input.quantity},
            ${input.unit}, ${input.estimatedCost}, ${input.currency}, ${input.status}, ${input.vendor},
            ${input.link}, ${input.notes}, ${input.addedBy})
    returning id`) as Array<{ id: string }>;
  const item = await getItem(rows[0].id);
  if (!item) throw new Error("item vanished after insert");
  return item;
}

/** Full replace. Null when missing; throws 23503 for unknown references. */
export async function replaceItem(id: string, input: DecorItemInput): Promise<Item | null> {
  const rows = await sql`
    update decor_items set
      section_id = ${input.sectionId}, inspo_pin_id = ${input.inspoPinId}, name = ${input.name},
      description = ${input.description}, quantity = ${input.quantity}, unit = ${input.unit},
      estimated_cost = ${input.estimatedCost}, currency = ${input.currency}, status = ${input.status},
      vendor = ${input.vendor}, link = ${input.link}, notes = ${input.notes}, added_by = ${input.addedBy},
      updated_at = now()
    where id = ${id}
    returning id`;
  return rows.length > 0 ? getItem(id) : null;
}

export async function setItemStatus(id: string, status: DecorStatus): Promise<Item | null> {
  const rows = await sql`update decor_items set status = ${status}, updated_at = now() where id = ${id} returning id`;
  return rows.length > 0 ? getItem(id) : null;
}

/** Deletes the item (photos cascade). Returns the photo blob pathnames to clean up, or null when missing. */
export async function deleteItem(id: string): Promise<string[] | null> {
  const photos = (await sql`select pathname, url from decor_item_photos where item_id = ${id}`) as Array<{
    pathname: string | null;
    url: string;
  }>;
  const rows = await sql`delete from decor_items where id = ${id} returning id`;
  if (rows.length === 0) return null;
  return photos.map((p) => p.pathname ?? p.url);
}

export type AddPhotoResult = { photo: Photo } | { error: "item_not_found" | "too_many_photos" };

/** Appends a photo, enforcing the per-item limit in the same statement. */
export async function addPhoto(
  itemId: string,
  photo: { url: string; pathname: string; width: number | null; height: number | null },
): Promise<AddPhotoResult> {
  const rows = (await sql`
    insert into decor_item_photos (item_id, url, pathname, width, height, sort_order)
    select i.id, ${photo.url}, ${photo.pathname}, ${photo.width}, ${photo.height},
           coalesce((select max(sort_order) + 1 from decor_item_photos where item_id = i.id), 0)
    from decor_items i
    where i.id = ${itemId}
      and (select count(*) from decor_item_photos where item_id = i.id) < ${MAX_PHOTOS_PER_ITEM}
    returning id, item_id, url, pathname, width, height, sort_order`) as PhotoRow[];
  if (rows[0]) {
    await sql`update decor_items set updated_at = now() where id = ${itemId}`;
    return { photo: toPhoto(rows[0]) };
  }
  const exists = await sql`select 1 from decor_items where id = ${itemId}`;
  return { error: exists.length > 0 ? "too_many_photos" : "item_not_found" };
}

/** Deletes one photo row. Returns its blob pathname (or url) for cleanup, or null when missing. */
export async function deletePhoto(itemId: string, photoId: string): Promise<string | null> {
  const rows = (await sql`
    delete from decor_item_photos where id = ${photoId} and item_id = ${itemId}
    returning pathname, url`) as Array<{ pathname: string | null; url: string }>;
  return rows[0] ? (rows[0].pathname ?? rows[0].url) : null;
}

export async function itemExists(id: string): Promise<boolean> {
  return (await sql`select 1 from decor_items where id = ${id}`).length > 0;
}

/** Maps a foreign-key violation on decor_items to an API error code, or null for any other error. */
export function itemReferenceError(err: unknown): "section_not_found" | "pin_not_found" | null {
  if (typeof err !== "object" || err === null || !("code" in err) || err.code !== "23503") return null;
  const constraint = "constraint" in err && typeof err.constraint === "string" ? err.constraint : "";
  return constraint.includes("pin") ? "pin_not_found" : "section_not_found";
}
