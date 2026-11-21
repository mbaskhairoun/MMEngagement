/** Wire types for the decor portal API (`/api/decor/**`). Client-safe: no server imports. */

export const DECOR_STATUSES = ["proposed", "approved", "ordered", "declined"] as const;
export type DecorStatus = (typeof DECOR_STATUSES)[number];

export type Section = {
  id: string;
  pinterestId: string | null;
  title: string;
  slug: string;
  sortOrder: number;
  pinCount: number;
  itemCount: number;
};

export type Pin = {
  id: string;
  pinterestId: string;
  sectionId: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  pinUrl: string | null;
  link: string | null;
  pinnedAt: string | null;
  removedAt: string | null;
};

export type SyncSource = "crawl" | "rss" | "local";

export type PinterestSyncInfo = {
  lastSyncedAt: string;
  pinCount: number;
  sectionCount: number;
  source: SyncSource;
  added?: number;
  removed?: number;
};

export type Photo = {
  id: string;
  url: string;
  pathname: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
};

export type Item = {
  id: string;
  sectionId: string | null;
  inspoPinId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  estimatedCost: number | null;
  currency: string;
  status: DecorStatus;
  vendor: string | null;
  link: string | null;
  notes: string | null;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
  pin: { id: string; imageUrl: string; pinUrl: string | null } | null;
};

export const MAX_PHOTOS_PER_ITEM = 12;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const RSS_SECTION_SLUG = "new-from-pinterest";
export const RSS_SECTION_TITLE = "New from Pinterest";
