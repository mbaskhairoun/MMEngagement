#!/usr/bin/env node
// Full Pinterest → decor portal sync (see docs/DECOR.md "Pinterest sync").
//
//   npm run sync:pinterest            (loads .env.local itself)
//
// Crawls the public board in headless Chrome, upserts sections + pins into Neon,
// mirrors new images to Vercel Blob and marks pins that left the board as removed.
// Idempotent: a second run with an unchanged board writes the same rows and uploads nothing.
//
// Exit codes: 0 ok · 1 crawl looked blocked (< 50% of expected pins) · 2 configuration · 3 unexpected error.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { BlobNotFoundError, head, put } from "@vercel/blob";
import puppeteer from "puppeteer-core";
import {
  boardRssUrl,
  checkCapture,
  imageExtension,
  imageHash,
  isBlobUrl,
  isNumericPinId,
  normalisePin,
  parseEnv,
  pickSlug,
  rssPubDates,
  slugify,
} from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAX_SCROLLS = 6;
const UPLOAD_CONCURRENCY = 4;

class ConfigError extends Error {}
class BlockedError extends Error {}

const log = (...args) => console.log("[pinterest-sync]", ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Environment ─────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new ConfigError(`${name} is not set (export it or add it to .env.local)`);
  return value;
}

async function resolveChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === "darwin" && existsSync(MAC_CHROME)) return MAC_CHROME;
  try {
    const { default: full } = await import("puppeteer");
    const path = full.executablePath();
    if (path && existsSync(path)) return path;
  } catch {
    // `puppeteer` (full) is not installed locally; CI installs it with `npm i --no-save puppeteer`.
  }
  throw new ConfigError(
    "No Chrome found. Set PUPPETEER_EXECUTABLE_PATH, install Google Chrome, or `npm i --no-save puppeteer && npx puppeteer browsers install chrome`.",
  );
}

// ── Crawl ───────────────────────────────────────────────────────────────────

/** `data` query param of a Pinterest resource URL → options object. */
function resourceOptions(url) {
  try {
    const data = new URL(url).searchParams.get("data");
    return data ? (JSON.parse(data).options ?? {}) : {};
  } catch {
    return {};
  }
}

/** Pin objects embedded in the server-rendered page for a given resource name. */
async function ssrResourcePins(page, resourceName) {
  return page.evaluate((name) => {
    const el = document.getElementById("__PWS_INITIAL_PROPS__");
    if (!el) return [];
    try {
      const resources = JSON.parse(el.textContent).initialReduxState?.resources?.[name] ?? {};
      return Object.values(resources).flatMap((r) => (Array.isArray(r?.data) ? r.data : []));
    } catch {
      return [];
    }
  }, resourceName);
}

async function readBoard(page) {
  return page.evaluate(() => {
    const el = document.getElementById("__PWS_INITIAL_PROPS__");
    if (!el) return null;
    const state = JSON.parse(el.textContent).initialReduxState ?? {};
    const path = location.pathname.replace(/\/+$/, "/");
    const boards = Object.values(state.boards ?? {});
    const board = boards.find((b) => b?.url === path) ?? boards[0] ?? null;
    const sections = Object.values(state.boardsections ?? {})
      .filter((s) => s?.type === "board_section" || (s?.id && s?.slug))
      .map((s) => ({ id: String(s.id), title: String(s.title ?? "").trim(), slug: String(s.slug), pinCount: Number(s.pin_count ?? 0) }));
    return board
      ? { id: String(board.id), name: board.name, pinCount: Number(board.pin_count ?? 0), sectionCount: Number(board.section_count ?? sections.length), sections }
      : null;
  });
}

async function crawl(boardUrl, executablePath) {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1400, height: 1000 });

    // Captured raw pins per bucket: section pinterest id, or "" for the board feed (unsectioned).
    const buckets = new Map();
    let currentBucket = null;
    const add = (bucket, d) => {
      if (!d?.id || !d?.images) return;
      if (!buckets.has(bucket)) buckets.set(bucket, new Map());
      buckets.get(bucket).set(String(d.id), d);
    };
    page.on("response", async (res) => {
      const url = res.url();
      const isSection = url.includes("BoardSectionPinsResource");
      if (!isSection && !url.includes("BoardFeedResource")) return;
      try {
        const json = await res.json();
        const bucket = isSection ? String(resourceOptions(url).section_id ?? currentBucket ?? "") : "";
        if (!isSection && currentBucket !== "") return; // board feed only counts on the board page
        for (const d of json?.resource_response?.data ?? []) add(bucket, d);
      } catch {
        // non-JSON / aborted response
      }
    });

    const loginWall = () =>
      page.evaluate(
        () => !!document.querySelector('[data-test-id="login-modal"], [data-test-id="signup-modal"], form[name="loginForm"]'),
      );

    log(`loading board ${boardUrl}`);
    currentBucket = "";
    await page.goto(boardUrl, { waitUntil: "networkidle2", timeout: 60_000 });
    const board = await readBoard(page);
    if (!board) throw new BlockedError("could not read the board from the page (no __PWS_INITIAL_PROPS__ board)");
    const sectionTotal = board.sections.reduce((n, s) => n + s.pinCount, 0);
    log(`board "${board.name}": ${board.pinCount} pins, ${board.sections.length} sections${(await loginWall()) ? " (login wall shown)" : ""}`);

    // Unsectioned pins only exist when the board total exceeds the section totals.
    const unsectioned = Math.max(0, board.pinCount - sectionTotal);
    if (unsectioned > 0) {
      for (const d of await ssrResourcePins(page, "BoardFeedResource")) add("", d);
      for (let i = 0; i < MAX_SCROLLS && (buckets.get("")?.size ?? 0) < board.pinCount; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await sleep(1200);
      }
    }

    for (const section of board.sections) {
      currentBucket = section.id;
      const url = `${boardUrl.replace(/\/+$/, "")}/${section.slug}/`;
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
      for (const d of await ssrResourcePins(page, "BoardSectionPinsResource")) add(section.id, d);
      for (let i = 0; i < MAX_SCROLLS && (buckets.get(section.id)?.size ?? 0) < section.pinCount; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await sleep(1200);
      }
      const got = buckets.get(section.id)?.size ?? 0;
      log(`  section ${section.title.padEnd(16)} expected ${String(section.pinCount).padStart(3)}  captured ${String(got).padStart(3)}`);
    }

    // Section membership wins over the board feed; a pin seen in two sections keeps the first (board order).
    const pins = new Map();
    for (const section of board.sections) {
      for (const d of buckets.get(section.id)?.values() ?? []) {
        const pin = normalisePin(d);
        if (pin && !pins.has(pin.pinterestId)) pins.set(pin.pinterestId, { ...pin, sectionPinterestId: section.id });
      }
    }
    for (const d of buckets.get("")?.values() ?? []) {
      const pin = normalisePin(d);
      if (pin && !pins.has(pin.pinterestId)) pins.set(pin.pinterestId, { ...pin, sectionPinterestId: null });
    }
    return { board, expected: Math.max(board.pinCount, sectionTotal), pins: [...pins.values()] };
  } finally {
    await browser.close();
  }
}

// ── Blob ────────────────────────────────────────────────────────────────────

async function mirror(sourceUrl, pinterestId) {
  const ext = imageExtension(null, sourceUrl);
  const pathname = `inspo/${pinterestId}.${ext}`;
  try {
    const existing = await head(pathname);
    return { url: existing.url, uploaded: false };
  } catch (err) {
    if (!(err instanceof BlobNotFoundError)) throw err;
  }
  const res = await fetch(sourceUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${sourceUrl} → HTTP ${res.status}`);
  const contentType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const body = Buffer.from(await res.arrayBuffer());
  const blob = await put(pathname, body, { access: "public", contentType, addRandomSuffix: false });
  return { url: blob.url, uploaded: true };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ── Database ────────────────────────────────────────────────────────────────

async function fetchPubDates(boardUrl) {
  try {
    const res = await fetch(boardRssUrl(boardUrl), { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
    return res.ok ? rssPubDates(await res.text()) : new Map();
  } catch {
    return new Map();
  }
}

async function upsertSections(sql, sections) {
  const existing = await sql`select slug, pinterest_id from inspo_sections`;
  const takenBy = new Map(existing.map((r) => [r.slug, r.pinterest_id]));
  const ids = new Map();
  for (const [index, s] of sections.entries()) {
    const slug = pickSlug(slugify(s.slug || s.title), s.id, takenBy);
    const rows = await sql`
      insert into inspo_sections (pinterest_id, title, slug, sort_order)
      values (${s.id}, ${s.title || s.slug}, ${slug}, ${index})
      on conflict (pinterest_id) do update
        set title = excluded.title, slug = excluded.slug, sort_order = excluded.sort_order,
            updated_at = case
              when (inspo_sections.title, inspo_sections.slug, inspo_sections.sort_order)
                   is distinct from (excluded.title, excluded.slug, excluded.sort_order) then now()
              else inspo_sections.updated_at end
      returning id`;
    takenBy.set(slug, s.id);
    ids.set(s.id, rows[0].id);
  }
  return ids;
}

async function main() {
  loadEnvLocal();
  const databaseUrl = requireEnv("DATABASE_URL");
  requireEnv("BLOB_READ_WRITE_TOKEN");
  const boardUrl = requireEnv("PINTEREST_BOARD_URL").trim().replace(/\/*$/, "/");
  const executablePath = await resolveChrome();
  log(`chrome: ${executablePath}`);

  const started = Date.now();
  const { board, expected, pins } = await crawl(boardUrl, executablePath);

  const capture = checkCapture(expected, pins.length);
  if (!capture.ok) {
    throw new BlockedError(`${capture.reason}. Pinterest probably served a bot wall; nothing was written.`);
  }

  const sql = neon(databaseUrl);
  const pubDates = await fetchPubDates(boardUrl);
  const sectionIds = await upsertSections(sql, board.sections);

  const existingRows = await sql`select id, pinterest_id, image_url, source_image_url, section_id, removed_at from inspo_pins`;
  const byPinterestId = new Map(existingRows.map((r) => [r.pinterest_id, r]));
  // RSS-added placeholders (opaque feed token as id) are adopted by image hash.
  const placeholdersByHash = new Map(
    existingRows
      .filter((r) => !isNumericPinId(r.pinterest_id))
      .map((r) => [imageHash(r.source_image_url), r])
      .filter(([hash]) => hash),
  );

  let added = 0;
  let adopted = 0;
  let restored = 0;
  let moved = 0;
  let uploads = 0;
  const failures = [];

  const plans = pins.map((pin) => {
    let row = byPinterestId.get(pin.pinterestId);
    if (!row) {
      const placeholder = placeholdersByHash.get(imageHash(pin.sourceImageUrl));
      if (placeholder) {
        row = placeholder;
        placeholdersByHash.delete(imageHash(pin.sourceImageUrl));
      }
    }
    return { pin, row };
  });

  const images = await mapLimit(plans, UPLOAD_CONCURRENCY, async ({ pin, row }) => {
    if (row && isBlobUrl(row.image_url)) return row.image_url;
    try {
      const blob = await mirror(pin.sourceImageUrl, pin.pinterestId);
      if (blob.uploaded) uploads += 1;
      return blob.url;
    } catch (err) {
      failures.push(`${pin.pinterestId}: ${err.message}`);
      return null;
    }
  });

  for (const [i, { pin, row }] of plans.entries()) {
    const imageUrl = images[i];
    if (!imageUrl) continue; // could not mirror; retried next run
    const sectionId = pin.sectionPinterestId
      ? sectionIds.get(pin.sectionPinterestId)
      : (row?.section_id ?? null); // unsectioned in the feed: keep whatever we had
    const pinnedAt = pin.pinnedAt ?? pubDates.get(imageHash(pin.sourceImageUrl)) ?? null;
    if (row && row.pinterest_id !== pin.pinterestId) {
      await sql`update inspo_pins set pinterest_id = ${pin.pinterestId} where id = ${row.id}`;
      adopted += 1;
    }
    if (row?.removed_at) restored += 1;
    if (row && row.section_id !== sectionId) moved += 1;
    const result = await sql`
      insert into inspo_pins (pinterest_id, section_id, title, description, image_url, source_image_url,
                              width, height, dominant_color, pin_url, link, pinned_at, synced_at, removed_at)
      values (${pin.pinterestId}, ${sectionId}, ${pin.title}, ${pin.description}, ${imageUrl}, ${pin.sourceImageUrl},
              ${pin.width}, ${pin.height}, ${pin.dominantColor}, ${pin.pinUrl}, ${pin.link}, ${pinnedAt}, now(), null)
      on conflict (pinterest_id) do update set
        section_id = excluded.section_id, title = excluded.title, description = excluded.description,
        image_url = excluded.image_url, source_image_url = excluded.source_image_url,
        width = excluded.width, height = excluded.height, dominant_color = excluded.dominant_color,
        pin_url = excluded.pin_url, link = excluded.link,
        pinned_at = coalesce(excluded.pinned_at, inspo_pins.pinned_at),
        synced_at = now(), removed_at = null
      returning (xmax = 0) as inserted`;
    if (result[0]?.inserted) added += 1;
  }

  // Only reached when the capture passed the safety rule. Pins whose mirror failed are kept live.
  const keep = plans.map((p) => p.pin.pinterestId);
  const removedRows = await sql`
    update inspo_pins set removed_at = now()
    where removed_at is null and not (pinterest_id = any(${keep}::text[]))
    returning pinterest_id`;
  const removed = removedRows.length;

  const [{ n: pinCount }] = await sql`select count(*)::int as n from inspo_pins where removed_at is null`;
  const lastSyncedAt = new Date().toISOString();
  const info = { lastSyncedAt, pinCount, sectionCount: board.sections.length, source: "crawl", added, removed };
  await sql`
    insert into settings (key, value, updated_at) values ('pinterest_sync', ${JSON.stringify(info)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log("");
  console.log("Pinterest sync complete");
  console.log(`  board        ${board.name} (${boardUrl})`);
  console.log(`  captured     ${pins.length} / ${expected} expected pins (${Math.round(capture.ratio * 100)}%)`);
  console.log(`  sections     ${board.sections.length}`);
  console.log(`  pins live    ${pinCount}`);
  console.log(`  added        ${added}`);
  console.log(`  removed      ${removed}`);
  console.log(`  restored     ${restored}`);
  console.log(`  re-sectioned ${moved}`);
  console.log(`  adopted RSS  ${adopted}`);
  console.log(`  uploads      ${uploads} image(s) to Vercel Blob`);
  console.log(`  took         ${secs}s`);
  if (failures.length > 0) {
    console.log(`  image errors ${failures.length} (pins skipped this run, retried next run):`);
    for (const f of failures) console.log(`    - ${f}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    if (err instanceof BlockedError) {
      console.error(`\n[pinterest-sync] FAILED (blocked): ${err.message}`);
      process.exit(1);
    }
    if (err instanceof ConfigError) {
      console.error(`\n[pinterest-sync] FAILED (config): ${err.message}`);
      process.exit(2);
    }
    console.error("\n[pinterest-sync] FAILED (unexpected):", err);
    process.exit(3);
  },
);
