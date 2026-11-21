// Pure helpers for scripts/pinterest/sync.mjs (no I/O), unit-tested in test/pinterest-sync-lib.test.ts.

/** Minimum share of the board's pins a crawl must capture before it may write anything. */
export const MIN_CAPTURE_RATIO = 0.5;

/**
 * The "expected vs captured" safety rule. A crawl that sees fewer than half of the
 * pins Pinterest says the board has is treated as a bot wall / layout change:
 * nothing is written and the process exits non-zero, so pins are never wiped.
 */
export function checkCapture(expected, captured) {
  if (!Number.isFinite(expected) || expected <= 0) {
    return { ok: false, ratio: 0, reason: "board reports no pins (could not read the board)" };
  }
  const ratio = captured / expected;
  if (ratio < MIN_CAPTURE_RATIO) {
    return {
      ok: false,
      ratio,
      reason: `captured ${captured} of ${expected} expected pins (${Math.round(ratio * 100)}% < ${MIN_CAPTURE_RATIO * 100}%)`,
    };
  }
  return { ok: true, ratio, reason: null };
}

/** Same rules as lib/validation.ts `slugify`. */
export function slugify(title) {
  const slug = String(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "category";
}

/** The 32-hex hash in an i.pinimg.com URL, shared by all size variants of a pin image. */
export function imageHash(url) {
  return /\/([0-9a-f]{32})\.[a-z0-9]+(?:[?#]|$)/i.exec(url ?? "")?.[1]?.toLowerCase() ?? null;
}

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
};

/** Blob file extension: from the content type when known, else the URL, else `jpg`. */
export function imageExtension(contentType, url = "") {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (EXT_BY_TYPE[type]) return EXT_BY_TYPE[type];
  const fromUrl = /\.([a-z0-9]{3,4})(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase();
  return fromUrl === "jpeg" ? "jpg" : (fromUrl ?? "jpg");
}

/** Numeric Pinterest ids come from the crawl; RSS-added placeholder pins use the feed's opaque token. */
export const isNumericPinId = (id) => /^\d+$/.test(id);

export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
export const isBlobUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
};

/** Minimal `.env` parser: KEY=value lines, optional quotes, `#` comments. */
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
    if (quoted) value = quoted[1] === '"' ? quoted[2].replace(/\\n/g, "\n") : quoted[2];
    else value = value.replace(/\s+#.*$/, "");
    out[m[1]] = value;
  }
  return out;
}

/**
 * Picks the slug for a Pinterest section: its own slug unless another section
 * (different pinterest id) already uses it, then `<slug>-<last 4 of id>`.
 */
export function pickSlug(slug, pinterestId, takenBy) {
  const owner = takenBy.get(slug);
  return owner === undefined || owner === pinterestId ? slug : `${slug}-${pinterestId.slice(-4)}`;
}

/** Normalises a raw Pinterest pin object (resource JSON) into our row shape, or null if unusable. */
export function normalisePin(d) {
  const img = d?.images?.orig ?? d?.images?.["736x"];
  if (!d?.id || !img?.url) return null;
  const created = d.created_at ? Date.parse(d.created_at) : NaN;
  const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    pinterestId: String(d.id),
    title: text(d.grid_title) ?? text(d.title),
    description: text(d.description) ?? text(d.closeup_unified_description),
    sourceImageUrl: img.url,
    width: Number.isInteger(img.width) ? img.width : null,
    height: Number.isInteger(img.height) ? img.height : null,
    dominantColor: text(d.dominant_color),
    pinUrl: `https://www.pinterest.com/pin/${d.id}/`,
    link: text(d.link),
    pinnedAt: Number.isNaN(created) ? null : new Date(created).toISOString(),
  };
}

/** `https://…/user/board/` → `https://…/user/board.rss`. */
export const boardRssUrl = (boardUrl) => `${boardUrl.trim().replace(/\/+$/, "")}.rss`;

/** image hash → ISO pubDate from a board RSS feed (best-effort enrichment for `pinned_at`). */
export function rssPubDates(xml) {
  const out = new Map();
  for (const [, item] of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const src = /i\.pinimg\.com\/[^"&<\s]+/.exec(item)?.[0];
    const hash = src ? imageHash(`https://${src}`) : null;
    const date = /<pubDate>([^<]+)<\/pubDate>/i.exec(item)?.[1];
    const t = date ? Date.parse(date) : NaN;
    if (hash && !Number.isNaN(t)) out.set(hash, new Date(t).toISOString());
  }
  return out;
}
