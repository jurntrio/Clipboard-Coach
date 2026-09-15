-- Club TV screen branding (background + brand colors), a per-sponsor
-- duration override, and sponsor-signage proof-of-play tracking: one row
-- per completed slide play plus a screen heartbeat, so a sponsor report can
-- tell "was actually shown live" apart from "was configured but the
-- screen was off/unreachable".

alter table public.club_tv_screens
  add column if not exists background_image_url text,
  add column if not exists background_color text,
  add column if not exists brand_colors jsonb not null default '[]'::jsonb,
  add column if not exists last_seen_at timestamptz;

comment on column public.club_tv_screens.background_image_url is
  'Optional full-screen background image behind slide content.';
comment on column public.club_tv_screens.background_color is
  'Fallback/base background color when no background image is set.';
comment on column public.club_tv_screens.brand_colors is
  'Up to 4 hex colors used to theme this screen (accents, text bar, etc).';
comment on column public.club_tv_screens.last_seen_at is
  'Updated by the display page heartbeat. Stale/null means the screen is not currently live, and its plays should not be counted.';

alter table public.sponsors
  add column if not exists display_duration_seconds integer
    check (display_duration_seconds is null or display_duration_seconds between 2 and 120);

comment on column public.sponsors.display_duration_seconds is
  'Optional per-sponsor override for how long its slide is shown. Falls back to the sponsors block/screen default when null.';

create table public.club_tv_play_events (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.club_tv_screens(id) on delete cascade,
  block_id uuid references public.club_tv_blocks(id) on delete set null,
  sponsor_id uuid references public.sponsors(id) on delete cascade,
  slide_key text not null,
  started_at timestamptz not null default timezone('utc', now()),
  duration_played_seconds numeric not null check (duration_played_seconds >= 0)
);
create index club_tv_play_events_sponsor_idx
  on public.club_tv_play_events(sponsor_id, started_at);
create index club_tv_play_events_screen_idx
  on public.club_tv_play_events(screen_id, started_at);

comment on table public.club_tv_play_events is
  'One row per completed sponsor slide play on a live screen. Source data for sponsor proof-of-play reports.';

alter table public.club_tv_play_events enable row level security;

-- Play events and heartbeats are written by the public, unauthenticated
-- display page through a dedicated server route (service role), same access
-- model as the rest of Club TV. No direct authenticated table grants here.
notify pgrst, 'reload schema';
