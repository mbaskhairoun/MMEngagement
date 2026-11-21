import { mirrorImageToBlob } from "@/lib/blob";
import {
  countLivePins,
  countSections,
  ensureCustomSection,
  getSyncInfo,
  listKnownPinKeys,
  setSyncInfo,
  upsertPins,
  type PinUpsert,
} from "@/lib/data/inspo";
import { RSS_SECTION_SLUG, RSS_SECTION_TITLE } from "@/lib/decor-types";
import { boardRssUrl, parseBoardRss, type RssPin } from "@/lib/pinterest-rss";

export class SyncUnavailableError extends Error {}

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (compatible; MMWeddingDecorSync/1.0)";

export type RssSyncResult = { added: number; total: number; lastSyncedAt: string | null };

async function fetchRss(): Promise<RssPin[]> {
  const board = process.env.PINTEREST_BOARD_URL;
  if (!board) throw new SyncUnavailableError("PINTEREST_BOARD_URL is not set");
  let res: Response;
  try {
    res = await fetch(boardRssUrl(board), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.1" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new SyncUnavailableError(`RSS fetch failed: ${String(err)}`);
  }
  if (!res.ok) throw new SyncUnavailableError(`RSS fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  if (!/<rss[\s>]/i.test(xml)) throw new SyncUnavailableError("RSS response is not a feed");
  return parseBoardRss(xml);
}

/**
 * Quick sync from the board RSS (works from Vercel). Adds pins we do not have yet
 * (matched by image hash, since the feed's pin token is not the numeric id) into the
 * "New from Pinterest" section. Never deletes or re-categorises; the next crawl does.
 */
export async function syncFromRss(): Promise<RssSyncResult> {
  const feed = await fetchRss();
  const known = await listKnownPinKeys();
  const fresh = feed.filter((p) => !known.imageHashes.has(p.imageHash) && !known.ids.has(p.pinKey));

  let added = 0;
  if (fresh.length > 0) {
    const sectionId = await ensureCustomSection(RSS_SECTION_SLUG, RSS_SECTION_TITLE);
    const rows: PinUpsert[] = [];
    for (const p of fresh) {
      try {
        const blob = await mirrorImageToBlob(p.imageUrl, `inspo/${p.pinKey}.jpg`);
        rows.push({
          pinterestId: p.pinKey,
          sectionId,
          title: p.title,
          description: p.description,
          imageUrl: blob.url,
          sourceImageUrl: p.imageUrl,
          width: null,
          height: null,
          dominantColor: null,
          pinUrl: p.pinUrl,
          link: null,
          pinnedAt: p.pinnedAt,
        });
      } catch (err) {
        console.error(`[decor-sync] could not mirror ${p.imageUrl}:`, err);
      }
    }
    added = await upsertPins(rows, "insert");
  }

  const total = await countLivePins();
  if (added > 0) {
    const lastSyncedAt = new Date().toISOString();
    await setSyncInfo({ lastSyncedAt, pinCount: total, sectionCount: await countSections(), source: "rss", added });
    return { added, total, lastSyncedAt };
  }
  return { added, total, lastSyncedAt: (await getSyncInfo())?.lastSyncedAt ?? null };
}

/**
 * Triggers the full-crawl GitHub workflow when `GITHUB_REPO` and `GITHUB_TOKEN` are set.
 * Returns false when not configured or when GitHub rejects the dispatch.
 */
export async function dispatchFullSync(): Promise<boolean> {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return false;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/pinterest-sync.yml/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ ref: process.env.GITHUB_SYNC_REF || "main" }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 204) return true;
    console.error(`[decor-sync] workflow dispatch failed: HTTP ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("[decor-sync] workflow dispatch failed:", err);
  }
  return false;
}
