# Marly & Michael — Wedding Website

Next.js 15 (App Router) on Vercel, Neon Postgres, MailerSend for email. No Firebase.

- Wedding: Monday, August 23, 2027 — ceremony 1:00 PM at St. Mary Church, El Rehab; reception 5:00 PM at Jaz Little Venice, Ain Sokhna.
- All wedding facts live in `content/wedding.ts` and are imported everywhere (site, admin, emails, calendar).

## Layout

```
app/                 public site (page.tsx), admin dashboard (admin/), API routes (api/)
components/site/     public site components
components/admin/    admin dashboard components
content/wedding.ts   single source of truth for names, dates, venues
lib/                 db client, validation, auth, mail, ics, guest matching
db/schema.sql        Postgres schema (idempotent); db/migrate.ts applies it
docs/API.md          API reference
public/photos/       couple photos
test/                vitest unit tests
```

## Run locally

```sh
npm install
cp .env.example .env.local   # fill in values (see below)
npm run db:migrate           # idempotent; applies db/schema.sql
npm run dev                  # http://localhost:3000  (admin at /admin)
npm test                     # vitest
npm run typecheck
```

## Environment

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (project `mm-wedding`) |
| `MAILERSEND_API_TOKEN` | MailerSend API token. If unset, RSVPs still save; emails are skipped and logged |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | Sender identity; domain must be verified in MailerSend |
| `ADMIN_PASSWORD` | Admin dashboard password |
| `SESSION_SECRET` | HMAC secret for the admin session cookie (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL used in metadata and emails |

## Deploy

Vercel project `mm-wedding` (team "Michael Baskhairoun's projects"), root directory = repo root.
`npx vercel --prod` from the repo root, or connect the GitHub repo in the Vercel dashboard for push-to-deploy.
Environment variables above are set in the Vercel project; `MAILERSEND_API_TOKEN` must be added manually.

## Data model

- `guests` — one row per invitation (household); `members` lists every person on it.
- `rsvps` — one per guest (upsert); attending/declined members, chosen events, meal, children, requests, message.
- `settings` — `form_config`: `{ rsvpDisabled, fields }` controls RSVP open/closed and visible form fields.
- `email_logs` — every confirmation / broadcast send attempt.
