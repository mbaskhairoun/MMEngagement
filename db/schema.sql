-- Marly & Michael wedding — Neon Postgres schema. Idempotent.
create extension if not exists pgcrypto;

-- One row per invitation (household). `members` lists every individual on the invitation.
create table if not exists guests (
  id                    uuid primary key default gen_random_uuid(),
  invitation_name       text not null,
  invitation_name_lower text generated always as (lower(invitation_name)) stored,
  email                 text,
  members               text[] not null default '{}',
  notes                 text,
  has_rsvped            boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists guests_invitation_name_lower_key on guests (invitation_name_lower);

-- One RSVP per invitation; updating replaces it.
create table if not exists rsvps (
  id                    uuid primary key default gen_random_uuid(),
  guest_id              uuid not null unique references guests(id) on delete cascade,
  invitation_name       text not null,
  full_name             text not null,
  email                 text not null,
  phone                 text,
  attending             boolean not null,
  attending_members     text[] not null default '{}',
  declined_members      text[] not null default '{}',
  member_emails         jsonb not null default '{}'::jsonb,
  events                text[] not null default '{}',          -- subset of {'ceremony','reception'}
  relationship          text,
  meal_preference       text,
  dietary_restrictions  text,
  children_count        integer not null default 0,
  children_ages         text,
  song_request          text,
  transport_needed      boolean not null default false,
  accommodation_needed  boolean not null default false,
  special_requests      text,
  message               text,
  user_agent            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists rsvps_created_at_idx on rsvps (created_at desc);

-- Key/value settings. `form_config` holds { rsvpDisabled: boolean, fields: { [fieldName]: boolean } }.
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into settings (key, value) values (
  'form_config',
  '{"rsvpDisabled": false, "fields": {"phone": true, "relationship": true, "mealPreference": true, "dietary": true, "childrenCount": true, "songRequest": true, "transportNeeded": false, "accommodationNeeded": true, "specialRequests": true, "message": true}}'::jsonb
) on conflict (key) do nothing;

-- Delivery log for confirmation + broadcast emails.
create table if not exists email_logs (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid references guests(id) on delete set null,
  guest_name  text,
  type        text not null,            -- rsvp_confirmed | rsvp_updated | broadcast
  recipients  text[] not null,
  success     boolean not null,
  status_code integer,
  error       text,
  sent_at     timestamptz not null default now()
);
create index if not exists email_logs_sent_at_idx on email_logs (sent_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- Decor portal (/decor): Pinterest inspiration mirror + decorators' selections
-- ───────────────────────────────────────────────────────────────────────────

-- Categories. Pinterest board sections are mirrored here (pinterest_id set);
-- custom categories created in the portal have pinterest_id = null.
create table if not exists inspo_sections (
  id            uuid primary key default gen_random_uuid(),
  pinterest_id  text unique,
  title         text not null,
  slug          text not null unique,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Pins mirrored from the board. image_url is our Vercel Blob copy; source_image_url is Pinterest's.
-- removed_at is set when a pin disappears from the board (kept so selections referencing it survive).
create table if not exists inspo_pins (
  id               uuid primary key default gen_random_uuid(),
  pinterest_id     text not null unique,
  section_id       uuid references inspo_sections(id) on delete set null,
  title            text,
  description      text,
  image_url        text not null,
  source_image_url text,
  width            integer,
  height           integer,
  dominant_color   text,
  pin_url          text,
  link             text,
  pinned_at        timestamptz,
  synced_at        timestamptz not null default now(),
  removed_at       timestamptz
);
create index if not exists inspo_pins_section_idx on inspo_pins (section_id);

-- Items the decorators (or the couple) choose. One row per item; photos in decor_item_photos.
create table if not exists decor_items (
  id              uuid primary key default gen_random_uuid(),
  section_id      uuid references inspo_sections(id) on delete set null,
  inspo_pin_id    uuid references inspo_pins(id) on delete set null,
  name            text not null,
  description     text,
  quantity        integer not null default 1 check (quantity >= 0),
  unit            text,                              -- e.g. "pcs", "sets", "metres"
  estimated_cost  numeric(12,2),
  currency        text not null default 'EGP',
  status          text not null default 'proposed' check (status in ('proposed','approved','ordered','declined')),
  vendor          text,
  link            text,
  notes           text,
  added_by        text,                              -- free-text name of whoever added it
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists decor_items_section_idx on decor_items (section_id);
create index if not exists decor_items_created_idx on decor_items (created_at desc);

create table if not exists decor_item_photos (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references decor_items(id) on delete cascade,
  url         text not null,
  pathname    text,                                  -- blob pathname, for deletion
  width       integer,
  height      integer,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists decor_item_photos_item_idx on decor_item_photos (item_id);

-- settings key 'pinterest_sync' holds { lastSyncedAt, pinCount, sectionCount, source: 'crawl'|'rss', added?, removed? }.
