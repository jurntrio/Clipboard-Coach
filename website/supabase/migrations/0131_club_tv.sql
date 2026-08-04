-- Configurable, token-addressed Club TV screens and their ordered content blocks.
create table public.club_tv_screens (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (trim(name) <> ''),
  location text,
  public_token uuid not null default gen_random_uuid() unique,
  orientation text not null default 'landscape' check (orientation in ('landscape','portrait')),
  transition_effect text not null default 'fade' check (transition_effect in ('fade','slide','zoom','none')),
  slide_duration_seconds integer not null default 8 check (slide_duration_seconds between 2 and 120),
  show_clock boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index club_tv_screens_club_idx on public.club_tv_screens(club_id, active);

create table public.club_tv_blocks (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.club_tv_screens(id) on delete cascade,
  block_type text not null check (block_type in ('match','sponsors','players','image')),
  title text,
  display_order integer not null default 0,
  active boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index club_tv_blocks_screen_idx on public.club_tv_blocks(screen_id, active, display_order);
create trigger trg_club_tv_screens_updated_at before update on public.club_tv_screens for each row execute function public.set_updated_at();
create trigger trg_club_tv_blocks_updated_at before update on public.club_tv_blocks for each row execute function public.set_updated_at();
alter table public.club_tv_screens enable row level security;
alter table public.club_tv_blocks enable row level security;
notify pgrst, 'reload schema';
