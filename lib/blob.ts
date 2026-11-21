import { BlobNotFoundError, del, head, put } from "@vercel/blob";

export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * The store's public hostname, derived from `BLOB_READ_WRITE_TOKEN`
 * (`vercel_blob_rw_<storeId>_<secret>` → `<storeid>.public.blob.vercel-storage.com`).
 * Null when the token is missing or not in that shape.
 */
export function blobStoreHost(token = process.env.BLOB_READ_WRITE_TOKEN): string | null {
  const storeId = token?.split("_")[3];
  return storeId ? `${storeId.toLowerCase()}${BLOB_HOST_SUFFIX}` : null;
}

/**
 * True for an https URL on our Vercel Blob store. When the store host can be derived
 * from the token the hostname must match it exactly; otherwise any public blob host is accepted.
 */
export function isBlobUrl(url: string, storeHost: string | null = blobStoreHost()): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return storeHost ? host === storeHost : host.endsWith(BLOB_HOST_SUFFIX) && host.length > BLOB_HOST_SUFFIX.length;
}

/** File extension for an image content type (falls back to the source URL's extension, then `jpg`). */
export function imageExtension(contentType: string | null, sourceUrl = ""): string {
  const fromType = contentType?.split(";")[0].trim().toLowerCase();
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/avif": "avif",
  };
  if (fromType && byType[fromType]) return byType[fromType];
  const fromUrl = /\.([a-z0-9]{3,4})(?:[?#]|$)/i.exec(sourceUrl)?.[1]?.toLowerCase();
  return fromUrl ?? "jpg";
}

export type MirroredBlob = { url: string; pathname: string; contentType: string; uploaded: boolean };

/**
 * Copies a remote image into the public blob store at `pathname` (no random suffix).
 * When a blob already exists there it is reused, so repeated calls never re-upload.
 */
export async function mirrorImageToBlob(sourceUrl: string, pathname: string): Promise<MirroredBlob> {
  try {
    const existing = await head(pathname);
    return { url: existing.url, pathname: existing.pathname, contentType: existing.contentType, uploaded: false };
  } catch (err) {
    if (!(err instanceof BlobNotFoundError)) throw err;
  }
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`fetch ${sourceUrl} failed: ${res.status}`);
  const contentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const body = Buffer.from(await res.arrayBuffer());
  const blob = await put(pathname, body, { access: "public", contentType, addRandomSuffix: false });
  return { url: blob.url, pathname: blob.pathname, contentType, uploaded: true };
}

/** Best-effort delete: failures are logged, never thrown. */
export async function deleteBlobs(pathnames: Array<string | null | undefined>): Promise<void> {
  const targets = pathnames.filter((p): p is string => Boolean(p));
  if (targets.length === 0) return;
  try {
    await del(targets);
  } catch (err) {
    console.error("[blob] delete failed:", targets, err);
  }
}
