/**
 * Parser for a public Pinterest board RSS feed (`<board url>.rss`).
 *
 * Each `<item>` has: `link` = pin URL (Pinterest now uses an opaque `e1_…` token,
 * not the numeric pin id), `description` = escaped HTML with an `<img src>` of a
 * 236px thumbnail followed by the pin description, `title`, `pubDate`.
 * Because the feed's pin token differs from the numeric id the crawl sees, pins are
 * matched across sources by their image hash (the 32-hex file name on i.pinimg.com).
 */

export type RssPin = {
  /** Token from the pin link (`/pin/<token>/`). Opaque; not the numeric pin id. */
  pinKey: string;
  pinUrl: string;
  /** 32-hex image hash shared by every size variant of the pin image. */
  imageHash: string;
  /** Thumbnail URL as found in the feed. */
  thumbnailUrl: string;
  /** Larger variant (736px wide, always JPEG) used for mirroring. */
  imageUrl: string;
  title: string | null;
  description: string | null;
  pinnedAt: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Text content of the first `<tag>` (CDATA or entity-encoded), or null. */
function tagText(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  if (!match) return null;
  const raw = match[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw);
  return cdata ? cdata[1] : decodeEntities(raw);
}

const blankToNull = (v: string | null | undefined): string | null => {
  const t = v?.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

/** The 32-hex hash in an i.pinimg.com URL (`…/20/1b/20/<hash>.jpg`), or null. */
export function pinImageHash(url: string): string | null {
  return /\/([0-9a-f]{32})\.[a-z0-9]+(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? null;
}

/** `https://i.pinimg.com/236x/aa/bb/cc/<hash>.jpg` → the same image at `size` (JPEG). */
export function pinImageAtSize(url: string, size = "736x"): string {
  const m = /^(https:\/\/i\.pinimg\.com)\/[^/]+\/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{32})\.[a-z0-9]+$/i.exec(
    url,
  );
  return m ? `${m[1]}/${size}/${m[2]}.jpg` : url;
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "));
}

export function parseBoardRss(xml: string): RssPin[] {
  const pins: RssPin[] = [];
  const seen = new Set<string>();
  for (const [, item] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const link = tagText(item, "link") ?? tagText(item, "guid");
    const pinKey = link ? /\/pin\/([^/?#]+)/.exec(link)?.[1] : undefined;
    const html = tagText(item, "description") ?? "";
    const src = /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1];
    const imageHash = src ? pinImageHash(src) : null;
    if (!link || !pinKey || !src || !imageHash || seen.has(imageHash)) continue;
    seen.add(imageHash);

    const title = blankToNull(tagText(item, "title"));
    const description = blankToNull(stripTags(html.replace(/^[\s\S]*?<\/a>/i, "")));
    const pubDate = tagText(item, "pubDate");
    const time = pubDate ? Date.parse(pubDate) : NaN;
    pins.push({
      pinKey,
      pinUrl: link.trim(),
      imageHash,
      thumbnailUrl: src,
      imageUrl: pinImageAtSize(src),
      title,
      description,
      pinnedAt: Number.isNaN(time) ? null : new Date(time).toISOString(),
    });
  }
  return pins;
}

/** `https://ca.pinterest.com/user/board/` → `https://ca.pinterest.com/user/board.rss`. */
export function boardRssUrl(boardUrl: string): string {
  return `${boardUrl.trim().replace(/\/+$/, "")}.rss`;
}
