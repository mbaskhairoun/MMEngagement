/* Types and fetch helpers for the decor portal. Contract: docs/DECOR.md. */

export type ItemStatus = "proposed" | "approved" | "ordered" | "declined";
export const STATUSES: ItemStatus[] = ["proposed", "approved", "ordered", "declined"];
export const STATUS_LABEL: Record<ItemStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  ordered: "Ordered",
  declined: "Declined",
};

export interface Section {
  id: string;
  pinterestId: string | null;
  title: string;
  slug: string;
  sortOrder: number;
  pinCount: number;
  itemCount: number;
}

export interface Pin {
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
}

export interface SyncInfo {
  lastSyncedAt: string | null;
  pinCount: number | null;
  sectionCount: number | null;
  source: string | null;
}

export interface InspoData {
  sections: Section[];
  pins: Pin[];
  sync: SyncInfo | null;
}

export interface Photo {
  id: string;
  url: string;
  pathname: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface Item {
  id: string;
  sectionId: string | null;
  inspoPinId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  estimatedCost: number | null;
  currency: string;
  status: ItemStatus;
  vendor: string | null;
  link: string | null;
  notes: string | null;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
  pin?: { id: string; imageUrl: string; pinUrl: string | null } | null;
}

export interface ItemInput {
  name: string;
  sectionId?: string | null;
  inspoPinId?: string | null;
  description?: string;
  quantity: number;
  unit?: string;
  estimatedCost?: number | null;
  currency?: string;
  status?: ItemStatus;
  vendor?: string;
  link?: string;
  notes?: string;
  addedBy?: string;
}

export interface PhotoInput {
  url: string;
  pathname: string;
  width?: number;
  height?: number;
}

export interface SyncResult {
  added?: number;
  total?: number;
  lastSyncedAt?: string | null;
  dispatched?: boolean;
}

export const MAX_PHOTOS = 12;
export const EXPORT_URL = "/api/decor/items/export";
export const UPLOAD_URL = "/api/decor/upload";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const UNAUTHORIZED_EVENT = "decor:unauthorized";

interface Envelope {
  ok?: boolean;
  error?: string;
}

const FRIENDLY: Record<string, string> = {
  invalid_password: "Incorrect password",
  sync_unavailable: "Pinterest can't be reached right now. Try again in a bit.",
  section_not_empty: "That category still has pins or items in it.",
  section_is_pinterest: "Categories that come from Pinterest can't be deleted here.",
  too_many_photos: `An item can have at most ${MAX_PHOTOS} photos.`,
  too_many_requests: "Too many attempts. Wait a minute and try again.",
  invalid_body: "Some fields need another look.",
  duplicate_section: "A category with that name already exists.",
  item_not_found: "That item no longer exists. Refresh the page.",
  pin_not_found: "That pin no longer exists. Refresh the page.",
  photo_not_found: "That photo was already removed.",
  section_not_found: "That category no longer exists. Refresh the page.",
  invalid_photo_url: "The photo upload didn't finish correctly. Try again.",
  upload_rejected: "The photo was rejected by storage.",
  auth_not_configured: "The portal password isn't configured yet.",
};

/** Fetch a decor endpoint. Throws ApiError; 401 also fires UNAUTHORIZED_EVENT. */
export async function api<T extends object = Record<string, never>>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T & Envelope> {
  let res: Response;
  try {
    res = await fetch(`/api/decor${path}`, {
      method: init?.method ?? "GET",
      credentials: "same-origin",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Network error. Check your connection.", 0, "network");
  }
  let data: (T & Envelope) | null = null;
  try {
    data = (await res.json()) as T & Envelope;
  } catch {
    data = null;
  }
  if (res.status === 401 && path !== "/login") {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError("Your session expired. Sign in again.", 401, "unauthorized");
  }
  if (!res.ok || !data || data.ok === false) {
    const code = data?.error ?? `http_${res.status}`;
    throw new ApiError(FRIENDLY[code] ?? (data?.error || `Request failed (${res.status})`), res.status, code);
  }
  return data;
}

const enc = encodeURIComponent;

export const decorApi = {
  me: () => api<{ authenticated: boolean; role: "decor" | "admin" }>("/me"),
  login: (password: string) => api("/login", { method: "POST", body: { password } }),
  logout: () => api("/logout", { method: "POST" }),

  inspo: () => api<InspoData>("/inspo"),
  sync: (full = false) => api<SyncResult>(full ? "/sync?full=1" : "/sync", { method: "POST" }),
  movePin: (id: string, sectionId: string | null) =>
    api<{ pin: Pin }>(`/pins/${enc(id)}`, { method: "PATCH", body: { sectionId } }).then((r) => r.pin),
  createSection: (title: string) =>
    api<{ section: Section }>("/sections", { method: "POST", body: { title } }).then((r) => r.section),

  items: () => api<{ items: Item[] }>("/items").then((r) => r.items),
  createItem: (b: ItemInput) => api<{ item: Item }>("/items", { method: "POST", body: b }).then((r) => r.item),
  updateItem: (id: string, b: ItemInput) =>
    api<{ item: Item }>(`/items/${enc(id)}`, { method: "PUT", body: b }).then((r) => r.item),
  setStatus: (id: string, status: ItemStatus) =>
    api<{ item: Item }>(`/items/${enc(id)}`, { method: "PATCH", body: { status } }).then((r) => r.item),
  deleteItem: (id: string) => api(`/items/${enc(id)}`, { method: "DELETE" }),
  addPhoto: (itemId: string, p: PhotoInput) =>
    api<{ photo: Photo }>(`/items/${enc(itemId)}/photos`, { method: "POST", body: p }).then((r) => r.photo),
  deletePhoto: (itemId: string, photoId: string) =>
    api(`/items/${enc(itemId)}/photos/${enc(photoId)}`, { method: "DELETE" }),
};

/* ---------- formatting helpers ---------- */

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US")} ${currency}`;
  }
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
