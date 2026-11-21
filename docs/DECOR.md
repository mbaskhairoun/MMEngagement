# Decor portal (`/winners`)

Lives at `/winners` (API under `/api/decor/*`). A password-protected area for the couple and their decorators. Two tabs:

1. **Inspiration** — a mirror of the public Pinterest board, grouped by the board's sections (categories).
2. **Selections** — the items the decorators propose or the couple chooses: name, category, description, quantity, photos, cost, status.

Password: env `DECOR_PASSWORD`. Cookie `mm_decor` (same HMAC scheme as admin, `lib/auth.ts`, separate cookie name and audience). The admin cookie must NOT grant decor access and vice versa, except: an admin session may also read/write decor routes (couple convenience). Implement as `requireDecor(req)` that accepts either a valid `mm_decor` or a valid `mm_admin` cookie.

## Data (already applied to Neon, see `db/schema.sql`)

- `inspo_sections` — categories. Pinterest sections have `pinterest_id`; custom ones have `pinterest_id = null`. Ordered by `sort_order`, then title.
- `inspo_pins` — mirrored pins. `image_url` is OUR Vercel Blob copy (`inspo/<pinterest_id>.<ext>`); `source_image_url` is Pinterest's. `removed_at` set when a pin is no longer on the board (hidden by default).
- `decor_items` — selections. `status` ∈ proposed | approved | ordered | declined. `currency` default `EGP`.
- `decor_item_photos` — uploaded photos per item (Vercel Blob, `decor/<itemId>/<uuid>.<ext>`).
- `settings` key `pinterest_sync` → `{ lastSyncedAt, pinCount, sectionCount, source }`.

## Pinterest sync — daily, automatic, with sections

Pinterest's JSON endpoints reject anonymous server calls, but the public board renders fine in headless Chrome, so the full sync is a crawl:

- **Full sync (`scripts/pinterest/sync.mjs`)** — Node + puppeteer-core. Reads `PINTEREST_BOARD_URL`, loads the board page to list sections (from `__PWS_INITIAL_PROPS__` → `initialReduxState.boardsections`), then visits each section page and intercepts `BoardSectionPinsResource` JSON responses (scrolling until `pin_count` pins are captured or 6 scrolls). Upserts `inspo_sections` (by `pinterest_id`; renames follow Pinterest; `sort_order` = board order) and `inspo_pins` (by `pinterest_id`; section follows Pinterest, so a pin moved on Pinterest moves here). New images are mirrored to Blob (`inspo/<pinterest_id>.<ext>`), existing ones are not re-uploaded. Pins no longer on the board get `removed_at = now()`; pins that reappear get `removed_at = null`. Writes `settings.pinterest_sync = { lastSyncedAt, pinCount, sectionCount, source: "crawl", added, removed }`. Exit code 1 and a clear message if fewer than 50% of the expected pins were captured (bot wall), so the schedule shows red instead of silently wiping pins; never mark pins removed in that case.
  - Chrome binary: `PUPPETEER_EXECUTABLE_PATH` if set, else the macOS Google Chrome path, else `puppeteer`'s bundled browser (the workflow installs `puppeteer` on CI).
  - `npm run sync:pinterest` runs it locally (loads `.env.local` itself).
  - Reference crawl + captured dataset from 2026‑11‑20: `scripts/pinterest/pin-crawl.mjs`, `pins.json`, `sections.json` (63 pins, 13 sections).
- **Schedule: GitHub Actions** `.github/workflows/pinterest-sync.yml` — `schedule: "0 3 * * *"` (03:00 UTC daily ≈ 05:00 Cairo) + `workflow_dispatch`. Steps: checkout, Node 22, `npm ci`, `npx puppeteer browsers install chrome`, `node scripts/pinterest/sync.mjs`. Secrets `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`; var `PINTEREST_BOARD_URL`. Concurrency group `pinterest-sync` so runs never overlap.
- **Safety net on Vercel:** `POST /api/decor/sync` (also hit by a Vercel cron, `vercel.json` → `{ "crons": [{ "path": "/api/decor/sync", "schedule": "0 4 * * *" }] }`) reads the public RSS feed `${PINTEREST_BOARD_URL without trailing slash}.rss` (plain `fetch`, works from Vercel), adds pins not yet in the DB into a section titled "New from Pinterest" (slug `new-from-pinterest`, custom), mirrors images, and updates `pinterest_sync` only if it added something (`source: "rss"`). It never deletes or re-categorises pins; the next crawl assigns the real section. The cron call is authenticated by the `Authorization: Bearer ${CRON_SECRET}` header Vercel sends (env `CRON_SECRET`); the button in the UI uses the decor cookie. Response `{ ok, added, total, lastSyncedAt }`; 503 `sync_unavailable` if RSS fails.
- **On-demand full sync from the UI:** `POST /api/decor/sync?full=1` triggers the GitHub workflow via `POST https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/pinterest-sync.yml/dispatches` with `GITHUB_TOKEN` (fine-grained, Actions: write) if both env vars are set → `{ ok, dispatched:true }`; otherwise falls back to the RSS sync and returns `{ ok, dispatched:false, added, … }`.
- The UI lets anyone move a pin to a category (`PATCH /api/decor/pins/:id { sectionId }`); the crawl will put it back where Pinterest has it, so the tooltip says "To keep a pin in a category, move it on Pinterest".

## Image storage

`@vercel/blob` with `BLOB_READ_WRITE_TOKEN` (set in Vercel + `.env.local`). Store `mm-wedding-media`, public access.

- Server-side `put()` for Pinterest mirrors.
- **Client uploads** for decorator photos (phones produce 5–10 MB files, above the 4.5 MB serverless body limit): `POST /api/decor/upload` implements `handleUpload` from `@vercel/blob/client` (gated by `requireDecor`, `allowedContentTypes` image/jpeg|png|webp|heic, `maximumSizeInBytes` 15 MB, pathname prefix `decor/<itemId>/`). The browser uses `upload()` from `@vercel/blob/client` with `handleUploadUrl: "/api/decor/upload"`, then registers the blob with `POST /api/decor/items/:id/photos { url, pathname, width?, height? }`.

## API (all JSON, `{ ok:true, … }` / `{ ok:false, error, issues? }`, same conventions as `docs/API.md`)

Auth
- `POST /api/decor/login { password }` → sets `mm_decor` (7 days). 401 `invalid_password`. Same rate limit helper as admin.
- `POST /api/decor/logout`, `GET /api/decor/me` → `{ ok, authenticated:true, role: "decor" | "admin" }`.

Inspiration (all behind `requireDecor`)
- `GET /api/decor/inspo` → `{ ok, sections: Section[], pins: Pin[], sync: { lastSyncedAt, pinCount, sectionCount, source } | null }`
  - `Section = { id, pinterestId: string|null, title, slug, sortOrder, pinCount, itemCount }`
  - `Pin = { id, pinterestId, sectionId: string|null, title, description, imageUrl, width, height, dominantColor, pinUrl, link, pinnedAt, removedAt }` (removed pins included only with `?includeRemoved=1`)
- `POST /api/decor/sync` → quick RSS sync → `{ ok, added, total, lastSyncedAt }` (503 `sync_unavailable` if RSS fetch fails).
- `PATCH /api/decor/pins/:id { sectionId: string|null }` → `{ ok, pin }`.
- `POST /api/decor/sections { title }` → `{ ok, section }` (custom category; 409 on duplicate slug). `PATCH /api/decor/sections/:id { title?, sortOrder? }`. `DELETE /api/decor/sections/:id` → 409 `section_not_empty` if it has pins or items; Pinterest-backed sections cannot be deleted (409 `section_is_pinterest`).

Selections (all behind `requireDecor`)
- `GET /api/decor/items?sectionId=&status=` → `{ ok, items: Item[] }` newest first.
  - `Item = { id, sectionId, inspoPinId, name, description, quantity, unit, estimatedCost: number|null, currency, status, vendor, link, notes, addedBy, createdAt, updatedAt, photos: Photo[], pin?: { id, imageUrl, pinUrl } | null }`
  - `Photo = { id, url, pathname, width, height, sortOrder }`
- `POST /api/decor/items` body `{ name (1–120), sectionId?, inspoPinId?, description? (≤2000), quantity (int ≥0, default 1), unit? (≤30), estimatedCost? (≥0), currency? (3 letters, default EGP), status? (default proposed), vendor? (≤120), link? (url), notes? (≤2000), addedBy? (≤80) }` → 201 `{ ok, item }`.
- `PUT /api/decor/items/:id` same body (full replace) → `{ ok, item }`. `PATCH /api/decor/items/:id { status }` for quick status changes.
- `DELETE /api/decor/items/:id` → deletes row and its blobs (`del()` for each photo pathname) → `{ ok }`.
- `POST /api/decor/items/:id/photos { url, pathname, width?, height? }` → 201 `{ ok, photo }` (max 12 photos per item → 409 `too_many_photos`; url must be on the blob store hostname).
- `DELETE /api/decor/items/:id/photos/:photoId` → deletes row + blob → `{ ok }`.
- `POST /api/decor/upload` → `handleUpload` token exchange (see Image storage).
- `GET /api/decor/items/export` → CSV (one row per item, photo URLs joined by `|`).

Admin
- The admin dashboard gets a "Decor portal" link in its sidebar pointing to `/winners` (opens in the same tab; admin cookie grants access).

## UI (`/winners`)

Public-site palette (cream + sea blues, see `app/globals.css` tokens) but a working-tool layout like the admin: top bar with monogram, "Decor portal", tabs **Inspiration** / **Selections**, and a Log out button. Login card like the admin's but titled "Decorators & planners" with the hint "Ask Marly or Michael for the password".

Inspiration tab
- Category chips across the top (All + each section, with pin counts), masonry grid of pins (CSS columns, `next/image` with blob URLs, `sizes`), hover reveals title/"Open on Pinterest"; click opens a lightbox with the full image, title/description, category selector (to re-categorise), and an **"Add to selections"** button that opens the item form pre-filled with that pin and category.
- Header row: "63 pins · 13 categories · synced 20 Nov 2026" and a **Sync from Pinterest** button (calls the quick sync; shows "Added N new pins" or "Up to date"). A small "i" tooltip explains the full sync is run from the couple's computer.
- "+ New category" for custom categories.

Selections tab
- Summary strip: counts by status, total estimated cost per currency.
- Filters: category, status; search.
- Cards (grid) with first photo (or the linked pin image), name, category, quantity + unit, cost, status badge, "added by"; click opens a side panel/modal to edit.
- **Add item** form: name, category select (+ "new category" inline), description, quantity + unit, estimated cost + currency, vendor, link, notes, your name (remembered in localStorage), status, photos (multi-file, drag/drop, client-side resize to max 2000px before upload, progress per file), optional "Inspired by" pin picker.
- Status change inline (proposed → approved → ordered / declined).
- Export CSV button.
- Fully usable at 375px (decorators on phones): single-column cards, bottom sheet for the form, large tap targets.
