# API Reference

All endpoints are Next.js App Router route handlers under `app/api/**` running on the Node.js runtime.

## Conventions

- Request and response bodies are JSON (`Content-Type: application/json`). The two exceptions are `GET /api/calendar.ics` and `GET /api/admin/rsvps/export`.
- Success responses look like `{ "ok": true, ...fields }`.
- Error responses look like `{ "ok": false, "error": "<code>" }`. Schema validation failures also carry `issues`:
  `{ "ok": false, "error": "invalid_body", "issues": [{ "path": "attendingMembers.0", "message": "required" }] }`.
- Common error codes for every endpoint: `invalid_json` (400), `invalid_body` (400), `internal_error` (500).
- JSON responses are sent with `Cache-Control: no-store`.
- Timestamps are ISO 8601 UTC strings.
- IDs are UUIDs. A malformed ID returns 400 (`invalid_id` or `invalid_guest_id`).
- Strings are trimmed. An optional text field sent as `""` is stored as `null`.

### Shared types

```ts
type GuestPublic = { id: string; invitationName: string; members: string[]; hasRsvped: boolean };

type GuestAdmin = {
  id: string; invitationName: string; email: string | null; members: string[]; notes: string | null;
  hasRsvped: boolean; createdAt: string; updatedAt: string;
  attending: boolean | null;   // null = no RSVP yet
  totalAttending: number;      // attendingMembers.length when attending, else 0
};

type RsvpPublic = {
  id: string; guestId: string; invitationName: string; fullName: string; email: string; phone: string | null;
  attending: boolean; attendingMembers: string[]; declinedMembers: string[];
  memberEmails: Record<string, string>;            // member name -> email
  events: ("ceremony" | "reception")[];
  relationship: string | null; mealPreference: string | null; dietaryRestrictions: string | null;
  childrenCount: number; childrenAges: string | null; songRequest: string | null;
  transportNeeded: boolean; accommodationNeeded: boolean; specialRequests: string | null; message: string | null;
  createdAt: string; updatedAt: string;
};

type RsvpAdmin = RsvpPublic & { userAgent: string | null; totalAttending: number; totalDeclined: number };

type EmailLog = {
  id: string; guestId: string | null; guestName: string | null;
  type: "rsvp_confirmed" | "rsvp_updated" | "broadcast";
  recipients: string[]; success: boolean; statusCode: number | null; error: string | null; sentAt: string;
};
```

A household's individuals are its `members`. When `members` is empty, the household's one individual is `invitationName`. Creating or importing a guest with no members stores `[invitationName]`.

---

## Public endpoints

### `GET /api/settings`

```json
{ "ok": true, "rsvpDisabled": false, "fields": { "phone": true, "mealPreference": true, "...": true }, "rsvpDeadline": "2027-06-01" }
```

`fields` maps form field keys to visibility. The defaults are `phone, relationship, mealPreference, dietary, childrenCount, songRequest, transportNeeded (false), accommodationNeeded, specialRequests, message`. `rsvpDeadline` comes from `content/wedding.ts`. It is for display only and does not close the RSVP automatically.

### `POST /api/guests/lookup`

Body: `{ "name": string }` (1–100 characters after trimming).

| Status | Body |
|---|---|
| 200 | `{ ok, exact: GuestPublic \| null, matchedName: string \| null, candidates: Array<{ guest: GuestPublic, matchedName: string }> }` |
| 400 | `invalid_body` (empty or too long) |
| 423 | `rsvp_closed` |

Matching runs in this order:
1. The invitation name, exactly.
2. A household member, exactly.
3. Word prefixes, so "mich bask" finds "Michael Baskhairoun". A single hit becomes `exact`.
4. Levenshtein fuzzy matching on invitation names and members.

Matching ignores case, accents and punctuation. If `exact` is non-null, `candidates` is `[]`. Otherwise `candidates` holds at most 5 suggestions, best first, and may be empty. `matchedName` is the name that matched (an invitation or member name), which is useful for prefilling `fullName`. Guest email and notes are never returned.

### `GET /api/rsvp?guestId=<uuid>`

`{ ok: true, rsvp: RsvpPublic | null }`. Returns 400 `invalid_guest_id` for a malformed UUID.

### `POST /api/rsvp`

Body:

```ts
{
  guestId: string;                  // uuid
  fullName: string;                 // 1–100
  email: string;                    // valid email, lowercased
  phone?: string | null;            // <= 40
  attending: boolean;
  attendingMembers: string[];       // <= 20, unique (case-insensitive)
  declinedMembers: string[];        // <= 20, unique
  memberEmails?: Record<string, string>;   // member -> email; "" values are dropped; <= 20
  events?: ("ceremony" | "reception")[];
  relationship?: string | null;     // <= 200
  mealPreference?: string | null;   // <= 200
  dietaryRestrictions?: string | null;  // <= 1000
  childrenCount?: number;           // int 0–20, default 0
  childrenAges?: string | null;     // <= 200
  songRequest?: string | null;      // <= 200
  transportNeeded?: boolean;        // default false
  accommodationNeeded?: boolean;    // default false
  specialRequests?: string | null;  // <= 1000
  message?: string | null;          // <= 1000
}
```

The server applies these household rules:
- Every name in `attendingMembers`, `declinedMembers` and the keys of `memberEmails` must belong to the household. Names match case-insensitively and are stored in their canonical spelling.
- A name cannot be in both `attendingMembers` and `declinedMembers`.
- `attending: true` requires at least one name in `attendingMembers`.
- `attending: false` requires `attendingMembers` to be `[]`.
- When attending, `events` defaults to `["ceremony","reception"]` if omitted or empty. When declining, it is `[]`.
- When declining, the server clears the attendee-only fields: `relationship`, `mealPreference`, `dietaryRestrictions`, `childrenCount`, `childrenAges`, `songRequest`, `transportNeeded`, `accommodationNeeded` and `specialRequests`. It keeps `message` and `phone`.

| Status | Body |
|---|---|
| 200 | `{ ok, rsvpId, isUpdate: boolean, emailSent: boolean }` |
| 400 | `invalid_body`, `invalid_member`, `member_overlap`, `attending_members_required`, `attending_members_must_be_empty` |
| 404 | `guest_not_found` |
| 423 | `rsvp_closed` |

Each household has one RSVP, so a later submission replaces the earlier one (`isUpdate: true`). The server sets `guests.has_rsvped = true` in the same transaction.

The server then sends a confirmation email to `email` and every `memberEmails` address. Addresses are deduplicated and each recipient gets their own message with the `.ics` attached. `emailSent` is true when at least one message was accepted. If MailerSend is not configured or the send fails, `emailSent` is false and the RSVP still succeeds.

### `GET /api/calendar.ics`

Returns a `text/calendar` attachment named `marly-michael-wedding.ics`. It contains two VEVENTs (ceremony and reception) in local `Africa/Cairo` time with a VTIMEZONE, a one-hour alarm on each, and the UIDs `marly-michael-wedding-{ceremony|reception}@marlybaskha.ca`.

---

## Admin endpoints

Every admin endpoint except `login` and `logout` requires the `mm_admin` session cookie. Without a valid cookie they return **401** `{ ok: false, error: "unauthorized" }`. The cookie is httpOnly, SameSite=Lax, Secure in production, and lasts 7 days. Same-origin `fetch` sends it automatically.

### `POST /api/admin/login`
Body: `{ "password": string }`.

| Status | Body |
|---|---|
| 200 | `{ ok: true }` and sets the cookie |
| 401 | `invalid_password` |
| 429 | `too_many_requests`, with a `Retry-After` header. Triggered by 5 failed attempts per IP in 15 minutes (best effort, per instance). |
| 500 | `auth_not_configured` |

### `POST /api/admin/logout`
Returns `{ ok: true }` and clears the cookie. No session is required.

### `GET /api/admin/me`
Returns `{ ok: true, authenticated: true }`, or 401.

### `GET /api/admin/guests`
Returns `{ ok, guests: GuestAdmin[] }`, ordered by invitation name.

### `POST /api/admin/guests`
Body: `{ invitationName: string (1–100), email?: string | null | "", members?: string[] (<=20, unique, blanks dropped), notes?: string | null (<=1000) }`.

Returns **201** `{ ok, guest: Guest }`, where `Guest` is `GuestAdmin` without `attending` and `totalAttending`. Returns **409** `duplicate_invitation_name` if the name already exists (case-insensitive).

### `PUT /api/admin/guests/:id`
Takes the same body as POST and replaces every field. Returns `{ ok, guest }`, **404** `guest_not_found` or **409** `duplicate_invitation_name`. A rename also updates the RSVP's stored `invitationName`.

### `DELETE /api/admin/guests/:id`
Returns `{ ok: true }` or **404** `guest_not_found`. Deleting a guest also deletes its RSVP.

### `POST /api/admin/guests/import`
Body: `{ mode: "append" | "replace", guests: Array<GuestInput> }` (1–2000 rows, same row shape as POST guests).

Returns `{ ok, added, skipped }`. The import runs as one Postgres transaction. Rows whose invitation name already exists, either in the database or earlier in the same batch, are skipped. **`replace` deletes every existing guest first, which also deletes all RSVPs.** The client is expected to parse the xlsx file and send JSON.

### `GET /api/admin/rsvps`
Returns `{ ok, rsvps: RsvpAdmin[] }`, newest first.

### `DELETE /api/admin/rsvps/:id`
Returns `{ ok: true }` and sets the guest's `hasRsvped` to false. Returns **404** `rsvp_not_found` if the RSVP does not exist.

### `GET /api/admin/rsvps/export[?by=household|member]`
Returns a UTF-8 CSV download with a BOM so Excel opens it correctly.
- `by=household` (the default) downloads `rsvps.csv` with one row per RSVP and these columns: Invitation, Submitted By, Email, Phone, Attending, Attending Members, Declined Members, Total Attending, Events, Relationship, Meal Preference, Dietary Restrictions, Children Count, Children Ages, Song Request, Transport Needed, Accommodation Needed, Special Requests, Message, Submitted, Updated.
- `by=member` downloads `rsvps-by-member.csv` with one row per attending individual and these columns: Guest Name, Invitation, Email (the member's own address, or the submitter's email for the submitter), Phone (submitter only), Events, Meal Preference, Dietary Restrictions, Submitted.

List cells are joined with `; `. Cells beginning with `= + - @` are prefixed with `'` so spreadsheets do not treat them as formulas.

### `GET /api/admin/settings`
Returns `{ ok, rsvpDisabled: boolean, fields: Record<string, boolean> }`.

### `PUT /api/admin/settings`
Body: `{ rsvpDisabled?: boolean, fields?: Record<string, boolean> }`. Unknown top-level keys are rejected. Field keys must match `^[a-zA-Z][a-zA-Z0-9]{0,39}$`, with at most 50 keys. The update is merged into the stored settings: `fields` merges key by key and anything omitted keeps its current value. Returns the updated `{ ok, rsvpDisabled, fields }`.

### `POST /api/admin/email/send`
Body:

```ts
{
  to: Array<{ email: string; name?: string | null }>;  // 1–200, every address must be valid
  subject: string;          // 1–200; supports {{name}} {{first_name}} {{email}}
  html: string;             // 1–100000; HTML, or plain text (paragraphs on blank lines)
  headerLabel?: string;     // default "A Note From Marly & Michael"
  footerMessage?: string;   // default "With love,"
  preheader?: string;       // default: the personalised subject
}
```

Recipients are deduplicated case-insensitively. Each recipient gets an individual, personalised message: placeholders are replaced in the subject, body and preheader, and values inserted into the HTML are escaped. Up to 5 messages are sent concurrently. Each call writes one `email_logs` row.

| Status | Body |
|---|---|
| 200 | `{ ok: true, succeeded: number, failed: [] }` |
| 207 | `{ ok: true, succeeded, failed: [{ email, error }] }` (partial) |
| 502 | `{ ok: false, error: "send_failed", succeeded: 0, failed }` |
| 503 | `email_not_configured` (MAILERSEND_API_TOKEN unset; the skip is still logged) |

### `GET /api/admin/email/logs?limit=100`
`limit` must be between 1 and 500 and defaults to 100. Returns `{ ok, logs: EmailLog[] }`, newest first.

### `GET /api/admin/stats`

```ts
{
  ok: true,
  households: number;            // guests rows
  individuals: number;           // sum of max(members.length, 1)
  responded: number;             // RSVPs
  attendingHouseholds: number;
  attendingIndividuals: number;  // sum of attendingMembers over attending RSVPs
  declinedHouseholds: number;
  pending: number;               // households without an RSVP
  byEvent: { ceremony: number; reception: number };  // attending individuals per event
  meals: Record<string, number>; // attending households per meal (lowercased)
  children: number;              // sum of childrenCount over attending RSVPs
  timeline: Array<{ date: "YYYY-MM-DD"; count: number }>;  // RSVPs created per day (Africa/Cairo), ascending
}
```

---

## Decor portal endpoints

Backend for the decorators' portal, whose page lives at **`/winners`** (the API stays under `/api/decor/**`). The contract is `docs/DECOR.md`; this section documents what is implemented. Same conventions as above (JSON, `{ ok }` envelope, `issues` on `invalid_body`, `no-store`, UUID ids → `invalid_id`).

> **Deviations from `docs/DECOR.md`** (read these first)
> 1. **RSS pin ids.** Pinterest's board RSS links use an opaque token (`/pin/e1_AfqP…/`), not the numeric pin id the crawl sees. The RSS sync therefore matches pins by **image hash** (the 32‑hex file name on `i.pinimg.com`, identical across sizes). A pin added by RSS is stored with `pinterestId` = that token (non‑numeric) and a 736px JPEG mirror at `inspo/<token>.jpg`; the next crawl **adopts** it by image hash (rewrites `pinterest_id` to the numeric id, keeps its blob, assigns the real section). UI code should not assume `pinterestId` is numeric.
> 2. **`GET /api/decor/sync`** exists in addition to `POST`: Vercel cron jobs call their path with GET. Same auth and behaviour.
> 3. **Upload callback.** `POST /api/decor/upload` only requires the decor/admin cookie for the browser's `blob.generate-client-token` request; Vercel's `blob.upload-completed` callback carries no cookie and is authenticated by `handleUpload`'s signature check. The item must already exist (create the item first, then upload its photos). Blobs get a random suffix (`addRandomSuffix: true`), so register the `pathname` returned by `upload()`.
> 4. **Blocked crawl writes nothing.** When fewer than 50% of the expected pins are captured, `sync.mjs` exits 1 before any DB/Blob write (stricter than "never mark pins removed").
> 5. **Small additions:** `GET /api/decor/items/:id`; `settings.pinterest_sync` also carries `added`/`removed`; `POST /api/decor/sync?full=1` falls back to RSS when the GitHub dispatch call fails (not only when unconfigured).

### Auth and roles

`requireDecor` (in `lib/decor-auth.ts`) accepts a valid `mm_decor` cookie (role `decor`) **or** a valid `mm_admin` cookie (role `admin`). Tokens use the admin HMAC scheme from `lib/auth.ts` with an audience mixed into the MAC (`signToken/verifyToken(…, "admin" | "decor")`), so a decor token never verifies as admin and vice versa; admin tokens kept their exact format. Missing auth → 401 `unauthorized`.

#### `POST /api/decor/login`
Body `{ "password": string }`. Sets `mm_decor` (httpOnly, `SameSite=Lax`, 7 days). Errors: 401 `invalid_password`, 429 `too_many_requests` (5 failures / 15 min / IP, `Retry-After`), 500 `auth_not_configured` (`DECOR_PASSWORD` or `SESSION_SECRET` missing).

#### `POST /api/decor/logout`
Clears `mm_decor` only (an admin session is untouched). → `{ ok: true }`.

#### `GET /api/decor/me`
→ `{ ok: true, authenticated: true, role: "decor" | "admin" }`, else 401.

### Types

Defined in `lib/decor-types.ts` (client-safe, import it from UI code).

```ts
type Section = { id: string; pinterestId: string | null; title: string; slug: string; sortOrder: number;
  pinCount: number;   // live (non-removed) pins
  itemCount: number };
type Pin = { id: string; pinterestId: string; sectionId: string | null; title: string | null;
  description: string | null; imageUrl: string /* our Blob copy */; width: number | null; height: number | null;
  dominantColor: string | null; pinUrl: string | null; link: string | null;
  pinnedAt: string | null; removedAt: string | null };
type Photo = { id: string; url: string; pathname: string | null; width: number | null; height: number | null; sortOrder: number };
type Item = { id: string; sectionId: string | null; inspoPinId: string | null; name: string; description: string | null;
  quantity: number; unit: string | null; estimatedCost: number | null; currency: string;
  status: "proposed" | "approved" | "ordered" | "declined"; vendor: string | null; link: string | null;
  notes: string | null; addedBy: string | null; createdAt: string; updatedAt: string;
  photos: Photo[]; pin: { id: string; imageUrl: string; pinUrl: string | null } | null };
```

### Inspiration

#### `GET /api/decor/inspo[?includeRemoved=1]`
→ `{ ok, sections: Section[], pins: Pin[], sync: { lastSyncedAt, pinCount, sectionCount, source: "crawl" | "rss" } | null }`. Sections ordered by `sortOrder`, then title. Pins newest first (`pinnedAt`, then Pinterest id). Removed pins only with `includeRemoved=1`.

#### `POST /api/decor/sync[?full=1]` (also `GET`)
Auth: decor/admin cookie **or** `Authorization: Bearer ${CRON_SECRET}` (Vercel cron, `vercel.json` → daily 04:00 UTC).
- Quick RSS sync: fetches `${PINTEREST_BOARD_URL}.rss`, adds unseen pins to the custom section "New from Pinterest" (`new-from-pinterest`, created on demand), mirrors images, never deletes or re‑categorises. Updates `settings.pinterest_sync` (`source: "rss"`) only when it added something. → `{ ok, added, total, lastSyncedAt }` (`total` = live pins). 503 `sync_unavailable` when the feed cannot be fetched.
- `?full=1`: if `GITHUB_REPO` + `GITHUB_TOKEN` are set, dispatches `.github/workflows/pinterest-sync.yml` on `GITHUB_SYNC_REF` (default `main`) → `{ ok, dispatched: true }`; otherwise (or if GitHub rejects it) runs the RSS sync → `{ ok, dispatched: false, added, total, lastSyncedAt }`.

#### `PATCH /api/decor/pins/:id`
Body `{ sectionId: uuid | null }` → `{ ok, pin }`. 404 `pin_not_found` / `section_not_found`. The next crawl puts the pin back where Pinterest has it.

#### `POST /api/decor/sections`
Body `{ title }` (1–80) → 201 `{ ok, section }` (custom; slug from title; appended last). 409 `duplicate_section` on a slug clash.

#### `PATCH /api/decor/sections/:id`
Body `{ title?, sortOrder? }` (at least one; strict) → `{ ok, section }`. Renaming re-slugs. Pinterest sections can be edited but the next crawl restores Pinterest's title/order. 404 `section_not_found`, 409 `duplicate_section`.

#### `DELETE /api/decor/sections/:id`
→ `{ ok }`. 409 `section_is_pinterest` (Pinterest-backed), 409 `section_not_empty` (has pins, removed ones included, or items), 404 `section_not_found`.

### Selections

#### `GET /api/decor/items[?sectionId=<uuid>&status=<status>]`
→ `{ ok, items: Item[] }`, newest first. Empty filter values are ignored.

#### `POST /api/decor/items`
Body (zod `decorItemSchema`): `name` 1–120 (required), `sectionId?` uuid|null, `inspoPinId?` uuid|null, `description?` ≤2000, `quantity` int 0–1,000,000 (default 1), `unit?` ≤30, `estimatedCost?` ≥0 number|null (rounded to 2 dp), `currency?` 3 letters (upper-cased, default `EGP`), `status?` (default `proposed`), `vendor?` ≤120, `link?` http(s) URL, `notes?` ≤2000, `addedBy?` ≤80. Empty strings become `null`. → 201 `{ ok, item }`. 400 `section_not_found` / `pin_not_found` for unknown references.

#### `GET /api/decor/items/:id` → `{ ok, item }` (404 `item_not_found`).
#### `PUT /api/decor/items/:id` — same body, full replace → `{ ok, item }`.
#### `PATCH /api/decor/items/:id` — `{ status }` (strict) → `{ ok, item }`.
#### `DELETE /api/decor/items/:id` — deletes the row (photos cascade) and best-effort deletes their blobs → `{ ok }`.

#### `POST /api/decor/items/:id/photos`
Body `{ url, pathname, width?, height? }`. `url` must be https on our Blob store host (derived from `BLOB_READ_WRITE_TOKEN`; falls back to `*.public.blob.vercel-storage.com`), `pathname` must start with `decor/<itemId>/` and match the URL path. → 201 `{ ok, photo }`. 400 `invalid_photo_url` / `invalid_photo_pathname`, 404 `item_not_found`, 409 `too_many_photos` (max 12).

#### `DELETE /api/decor/items/:id/photos/:photoId` → deletes row + blob → `{ ok }` (404 `photo_not_found`).

#### `POST /api/decor/upload`
`handleUpload` token exchange for `upload(pathname, file, { access: "public", handleUploadUrl: "/api/decor/upload" })`. Pathname must be `decor/<itemId>/<file name>` (`[A-Za-z0-9._-]`, ≤120 chars) for an existing item; content types `image/jpeg|png|webp|heic`; max 15 MB. Errors: 401 (token request without session), 400 `invalid_pathname` / `item_not_found` / `upload_rejected`.

#### `GET /api/decor/items/export`
CSV (`decor-selections.csv`, UTF-8 BOM, formula-injection safe): Name, Category, Status, Quantity, Unit, Estimated Cost, Currency, Vendor, Link, Description, Notes, Added By, Inspired By Pin, Photos (URLs joined by `|`), Created, Updated.

### Full sync script and schedule

- `npm run sync:pinterest` → `scripts/pinterest/sync.mjs` (plain ESM; loads `.env.local`; needs `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `PINTEREST_BOARD_URL`). Chrome: `PUPPETEER_EXECUTABLE_PATH` → macOS Google Chrome → `puppeteer`'s bundled browser. Crawls the board's sections, upserts sections (by Pinterest id; slug clashes with custom categories get a `-<last4>` suffix) and pins, mirrors only pins that have no Blob image yet (`head()` before `put()`), enriches `pinnedAt` from the RSS feed, marks vanished pins removed and restores reappearing ones, writes `settings.pinterest_sync` (`source: "crawl"`). Exit codes: 0 ok, 1 blocked (< 50% captured; nothing written), 2 config, 3 unexpected. Pure helpers in `scripts/pinterest/lib.mjs`.
- GitHub Actions `.github/workflows/pinterest-sync.yml`: daily 03:00 UTC + manual; concurrency group `pinterest-sync`.

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `DECOR_PASSWORD` | Vercel, `.env.local` | Portal password |
| `BLOB_READ_WRITE_TOKEN` | Vercel, `.env.local`, GitHub secret | Blob store `mm-wedding-media` |
| `PINTEREST_BOARD_URL` | Vercel, `.env.local`, GitHub **variable** | Board to mirror |
| `DATABASE_URL` | GitHub secret (already in Vercel) | Crawl writes |
| `CRON_SECRET` | Vercel | Vercel sends it as `Authorization: Bearer …` on cron calls; without it the cron gets 401 |
| `GITHUB_REPO`, `GITHUB_TOKEN` | Vercel (optional) | `owner/repo` + fine-grained token (Actions: read & write) for `?full=1` |
| `GITHUB_SYNC_REF` | Vercel (optional) | Branch to dispatch on (default `main`) |
